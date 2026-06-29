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

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cached = cacheGet<object>('list-values');
  if (cached) return NextResponse.json(cached);

  try {
    const token = await getServiceToken();

    const [relRaw, genderRaw, maritalRaw, statesRaw] = await Promise.all([
      fetchJson(token, `${BASE}/api/ListValues/GetBeneficiaryRelationship`),
      fetchJson(token, `${BASE}/api/ListValues/GetGender`),
      fetchJson(token, `${BASE}/api/ListValues/GetMaritalStatus`),
      fetchJson(token, `${BASE}/api/ListValues/GetStates`),
    ]);

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

    const body = { relationships, genders, maritalStatuses, states };
    cacheSet('list-values', body);
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), relationships: [], genders: [], maritalStatuses: [], states: [] },
      { status: 500 }
    );
  }
}
