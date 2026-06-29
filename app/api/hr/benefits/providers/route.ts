import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? process.env.PROGNOSIS_API_BASE ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Username: process.env.PROGNOSIS_USERNAME,
      Password: process.env.PROGNOSIS_PASSWORD,
    }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Provider auth non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.token ?? payload?.Token ?? payload?.access_token ??
    payload?.accessToken ?? payload?.AccessToken ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
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
    // PascalCase / API variants
    'ProviderName', 'Provider_Name', 'Name', 'provider',
    'HospitalName', 'Hospital_Name',
    'EyeClinicName', 'Eye_Clinic_Name',
    'DentalClinicName', 'Dental_Clinic_Name',
    'SpaName', 'Spa_Name', 'GymName', 'Gym_Name', 'SpaAndGymName',
    'ClinicName', 'Clinic_Name', 'FacilityName',
  );
  if (!name) return null;

  const id      = s(r, 'ProviderID', 'Provider_ID', 'ID', 'Id', 'ProviderCode', 'Code', 'providercode', 'provider_id');
  const address = s(r, 'ProviderAddress', 'Address', 'Address1', 'Address2', 'Street', 'StreetAddress');
  const city    = s(r, 'CityOfOrigin', 'Town', 'City', 'CityName', 'TownName', 'LGA', 'region', 'Region');
  const state   = s(r, 'StateOfOrigin', 'State', 'StateName', 'State_Name', 'StateOfResidence');
  const phone   = s(r, 'PhoneNumber', 'Phone', 'phone1', 'Phone1', 'phone2', 'Phone2', 'TelephoneNo', 'Telephone', 'Mobile', 'ContactPhone');
  const rawStatus = s(r, 'status_id', 'ProviderStatus', 'Status', 'IsActive', 'Active', 'AccreditationStatus');
  const status  = ['true', '1', 'active', 'accredited', 'yes'].includes(rawStatus.toLowerCase())
    ? 'Active'
    : rawStatus || 'Active';

  const specialtyStr = s(r, 'Specialization', 'Specialty', 'Specialties', 'SpecialtyName', 'Category');
  const specialties = specialtyStr ? specialtyStr.split(/[,;/]/).map((x) => x.trim()).filter(Boolean) : [];

  return { id: id || name, name, address, city, state, phone, type, status, specialties };
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  for (const k of ['data', 'Data', 'result', 'Result', 'providers', 'Providers']) {
    if (Array.isArray(r?.[k])) return r[k] as unknown[];
  }
  return [];
}

async function fetchListValues(token: string, endpoint: string, schemeId: string, type: string, paramOverrides?: Record<string, string>): Promise<{ providers: Provider[]; error?: string }> {
  const base = { schemeid: schemeId, MinimumID: '1', NoOfRecords: '9999', pageSize: '9999' };
  const params = new URLSearchParams({ ...base, ...paramOverrides });
  const url = `${BASE}${endpoint}?${params}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch {
      console.warn(`[providers] Non-JSON from ${endpoint} (${res.status}):`, text.slice(0, 200));
      return { providers: [], error: `${endpoint} returned non-JSON (HTTP ${res.status})` };
    }
    if (!res.ok) {
      const msg = (raw as Record<string,unknown>)?.message ?? (raw as Record<string,unknown>)?.Message ?? text.slice(0, 200);
      console.warn(`[providers] HTTP ${res.status} from ${endpoint}:`, msg);
      return { providers: [], error: `${endpoint} HTTP ${res.status}: ${String(msg)}` };
    }
    const providers = extractArray(raw).map((r) => normalise(r, type)).filter((p): p is Provider => p !== null);
    console.log(`[providers] ${endpoint} schemeId=${schemeId} → ${providers.length} ${type} providers`);
    return { providers };
  } catch (e) {
    console.warn(`[providers] Error fetching ${endpoint}:`, e);
    return { providers: [], error: String(e) };
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

    const [hospResult, eyeResult, dentalResult, spaResult] = await Promise.all([
      fetchListValues(token, '/api/ListValues/GetGeneralHospitalByPlanCode', schemeId, 'Hospital'),
      fetchListValues(token, '/api/ListValues/GetEyeClinicByPlanCode',       schemeId, 'Optical'),
      fetchListValues(token, '/api/ListValues/GetDentalClinicByPlanCode',    schemeId, 'Dental'),
      fetchListValues(token, '/api/ListValues/GetGeneralGymandSpaByPlanCode', schemeId, 'Spa/Gym', { SchemeID: schemeId, schemeid: schemeId, MinimumID: '0', NoOfRecords: '9999', pageSize: '0' }),
    ]);

    const hospitals     = hospResult.providers;
    const eyeClinics    = eyeResult.providers;
    const dentalClinics = dentalResult.providers;
    const spaGyms       = spaResult.providers;
    const providers     = [...hospitals, ...eyeClinics, ...dentalClinics, ...spaGyms];

    // Surface the first error if everything came back empty
    const errors = [hospResult.error, eyeResult.error, dentalResult.error, spaResult.error].filter(Boolean);
    if (providers.length === 0 && errors.length > 0) {
      console.error('[hr/benefits/providers] All endpoints failed for schemeId', schemeId, errors);
      return NextResponse.json(
        { error: `Provider data unavailable: ${errors[0]}`, providers: [], counts: { hospitals: 0, eyeClinics: 0, dentalClinics: 0, spaGyms: 0 }, total: 0 },
        { status: 502 },
      );
    }

    return NextResponse.json({
      providers,
      counts: {
        hospitals: hospitals.length,
        eyeClinics: eyeClinics.length,
        dentalClinics: dentalClinics.length,
        spaGyms: spaGyms.length,
      },
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
