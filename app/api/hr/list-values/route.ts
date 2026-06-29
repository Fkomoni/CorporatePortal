import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { cacheGet, cacheSet } from '@/lib/server-cache';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Service login non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

async function fetchJson(token: string, url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

export interface RelationshipOption { text: string; value: string; }
export interface GenderOption       { text: string; value: string; }
export interface MaritalOption      { text: string; value: string; }
export interface StateOption        { text: string; value: string; }
export interface RegionOption       { text: string; value: string; }
export interface TownOption         { text: string; value: string; regionId: string; }

function toArr(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const v of Object.values(r)) {
      if (Array.isArray(v) && v.length > 0) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fresh = searchParams.get('fresh') === '1';
  const type = searchParams.get('type');
  const regionId = searchParams.get('regionId');

  // Fetch towns for a specific region (dynamic, not cached)
  if (type === 'towns') {
    try {
      const token = await getServiceToken();
      const url = regionId
        ? `${BASE}/api/CorporatePortal/GetTowns?regionId=${regionId}`
        : `${BASE}/api/CorporatePortal/GetTowns`;
      const raw = await fetchJson(token, url);
      console.log('[list-values/towns]', JSON.stringify(raw)?.slice(0, 300));
      const rows = toArr((raw as Record<string,unknown>)?.result ?? (raw as Record<string,unknown>)?.data ?? raw ?? []);
      const towns: TownOption[] = rows.map((r) => ({
        value:    String(r.TownID ?? r.townid ?? r.Town_ID ?? r.PostalTownID ?? r.Id ?? r.id ?? ''),
        text:     String(r.TownName ?? r.townname ?? r.Town_Name ?? r.Name ?? r.name ?? ''),
        regionId: String(r.RegionID ?? r.regionid ?? r.Region_ID ?? ''),
      })).filter((t) => t.value && t.text);
      return NextResponse.json({ towns });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch towns', towns: [] }, { status: 500 });
    }
  }

  const CACHE_KEY = 'list-values-v2';

  if (!fresh) {
    const cached = cacheGet<object>(CACHE_KEY);
    if (cached) return NextResponse.json({ ...cached, cached: true });
  }

  try {
    const token = await getServiceToken();

    const [relRaw, genderRaw, maritalRaw, statesRaw, regionsRaw] = await Promise.all([
      fetchJson(token, `${BASE}/api/ListValues/GetBeneficiaryRelationship`),
      fetchJson(token, `${BASE}/api/ListValues/GetGender`),
      fetchJson(token, `${BASE}/api/ListValues/GetMaritalStatus`),
      fetchJson(token, `${BASE}/api/ListValues/GetStates`),
      fetchJson(token, `${BASE}/api/CorporatePortal/GetRegion`),
    ]);
    console.log('[list-values/regions raw]', JSON.stringify(regionsRaw)?.slice(0, 300));

    // Relationships → {Text, Value}[]
    const relationships: RelationshipOption[] = Array.isArray(relRaw)
      ? relRaw.map((item: Record<string, unknown>) => ({
          text: String(item.Text ?? item.text ?? '').trim(),
          value: String(item.Value ?? item.value ?? ''),
        })).filter((r) => r.text && r.value)
      : [];

    // Gender → {result: [{Sex_id, Sex}]}
    const genderArr: unknown[] = Array.isArray((genderRaw as Record<string,unknown>)?.result)
      ? (genderRaw as Record<string,unknown>).result as unknown[]
      : Array.isArray(genderRaw) ? genderRaw as unknown[] : [];
    const genders: GenderOption[] = genderArr.map((item) => {
      const r = item as Record<string, unknown>;
      return { text: String(r.Sex ?? r.sex ?? '').trim(), value: String(r.Sex_id ?? r.sex_id ?? '') };
    }).filter((g) => g.text && g.value);

    // Marital status → {result: [{Marital_statusid, MaritalStatus}]}
    const maritalArr: unknown[] = Array.isArray((maritalRaw as Record<string,unknown>)?.result)
      ? (maritalRaw as Record<string,unknown>).result as unknown[]
      : Array.isArray(maritalRaw) ? maritalRaw as unknown[] : [];
    const maritalStatuses: MaritalOption[] = maritalArr.map((item) => {
      const r = item as Record<string, unknown>;
      return { text: String(r.MaritalStatus ?? r.maritalStatus ?? '').trim(), value: String(r.Marital_statusid ?? r.marital_statusid ?? '') };
    }).filter((m) => m.text && m.value);

    // States → [{Text, Value}]
    const statesArr: unknown[] = Array.isArray(statesRaw) ? statesRaw as unknown[] : [];
    const states: StateOption[] = statesArr.map((item) => {
      const r = item as Record<string, unknown>;
      return { text: String(r.Text ?? r.text ?? '').trim(), value: String(r.Value ?? r.value ?? '') };
    }).filter((s) => s.text && s.value);

    // Regions → [{RegionID, RegionName}] (try several key patterns)
    const regionRows = toArr((regionsRaw as Record<string,unknown>)?.result ?? (regionsRaw as Record<string,unknown>)?.data ?? regionsRaw ?? []);
    const regions: RegionOption[] = regionRows.map((r) => ({
      value: String(r.RegionID ?? r.regionid ?? r.Region_ID ?? r.Id ?? r.id ?? ''),
      text:  String(r.RegionName ?? r.regionname ?? r.Region_Name ?? r.Name ?? r.name ?? ''),
    })).filter((r) => r.value && r.text);

    const payload = { relationships, genders, maritalStatuses, states, regions };
    cacheSet(CACHE_KEY, payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), relationships: [], genders: [], maritalStatuses: [], states: [] },
      { status: 500 }
    );
  }
}
