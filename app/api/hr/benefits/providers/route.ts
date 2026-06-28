import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = 'https://prognosis-api.leadwayhealth.com';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/UserAccount/SignIn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      userName: process.env.PROGNOSIS_USERNAME,
      password: process.env.PROGNOSIS_PASSWORD,
    }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Provider auth non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from UserAccount/SignIn');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

export interface Provider {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  type: string;
  status: string;
  specialties: string[];
}

function s(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function normalise(row: unknown, type: string): Provider | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const name = s(r,
    'ProviderName', 'Provider_Name', 'Name', 'HospitalName', 'Hospital_Name',
    'EyeClinicName', 'Eye_Clinic_Name', 'DentalClinicName', 'Dental_Clinic_Name',
    'ClinicName', 'Clinic_Name', 'FacilityName',
  );
  if (!name) return null;

  const id = s(r, 'ProviderID', 'Provider_ID', 'ID', 'Id', 'ProviderCode', 'Code');
  const address = s(r, 'Address', 'Address1', 'Address2', 'Street', 'StreetAddress');
  const city    = s(r, 'Town', 'City', 'CityName', 'TownName', 'LGA');
  const state   = s(r, 'State', 'StateName', 'State_Name', 'StateOfResidence');
  const phone   = s(r, 'PhoneNumber', 'Phone', 'Phone1', 'TelephoneNo', 'Telephone', 'Mobile', 'ContactPhone');
  const rawStatus = s(r, 'ProviderStatus', 'Status', 'IsActive', 'Active', 'AccreditationStatus');
  const status  = ['true', '1', 'active', 'accredited', 'yes'].includes(rawStatus.toLowerCase())
    ? 'Active'
    : rawStatus || 'Active';

  const specialtyStr = s(r, 'Specialization', 'Specialty', 'Specialties', 'SpecialtyName', 'Category');
  const specialties = specialtyStr ? specialtyStr.split(/[,;/]/).map((x) => x.trim()).filter(Boolean) : [];

  return { id: id || name, name, address, city, state, phone, type, status, specialties };
}

async function fetchProviders(token: string, endpoint: string, schemeId: string, type: string): Promise<Provider[]> {
  const params = new URLSearchParams({ SchemeID: schemeId, MinimumID: '0', NoOfRecords: '500', pageSize: '500' });
  const url = `${BASE}${endpoint}?${params}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch {
      console.warn(`[providers] Non-JSON from ${endpoint} (${res.status})`);
      return [];
    }
    const arr: unknown[] = Array.isArray(raw) ? raw
      : Array.isArray((raw as Record<string,unknown>)?.data)   ? (raw as Record<string,unknown>).data   as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.Data)   ? (raw as Record<string,unknown>).Data   as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.result) ? (raw as Record<string,unknown>).result as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.Result) ? (raw as Record<string,unknown>).Result as unknown[]
      : [];
    return arr.map((r) => normalise(r, type)).filter((p): p is Provider => p !== null);
  } catch (e) {
    console.warn(`[providers] Error fetching ${endpoint}:`, e);
    return [];
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get('schemeId');
  if (!schemeId) return NextResponse.json({ error: 'schemeId is required' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [hospitals, eyeClinics, dentalClinics] = await Promise.all([
      fetchProviders(token, '/api/Provider/GetProvidersByPlanCode',    schemeId, 'Hospital'),
      fetchProviders(token, '/api/Provider/GetEyeClinicByPlanCode',    schemeId, 'Optical'),
      fetchProviders(token, '/api/Provider/GetDentalClinicByPlanCode', schemeId, 'Dental'),
    ]);

    const providers = [...hospitals, ...eyeClinics, ...dentalClinics];

    return NextResponse.json({
      providers,
      counts: { hospitals: hospitals.length, eyeClinics: eyeClinics.length, dentalClinics: dentalClinics.length },
      total: providers.length,
    });
  } catch (err) {
    console.error('[hr/benefits/providers] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch providers' },
      { status: 500 },
    );
  }
}
