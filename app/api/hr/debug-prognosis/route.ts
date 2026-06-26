import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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
    throw new Error(`Login non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const [membersRes, premiumRes] = await Promise.all([
      fetch(`${BASE}/api/EnrolleeProfile/GetGroupMembers?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${groupId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const membersText = await membersRes.text();
    const premiumText = await premiumRes.text();

    let membersRaw: unknown = null;
    let premiumRaw: unknown = null;
    try { membersRaw = JSON.parse(membersText); } catch { /* */ }
    try { premiumRaw = JSON.parse(premiumText); } catch { /* */ }

    function summarise(raw: unknown, label: string) {
      if (!raw) return { label, type: 'null/empty' };
      if (Array.isArray(raw)) {
        return {
          label, type: 'array', length: raw.length,
          firstRowKeys: raw[0] ? Object.keys(raw[0] as object) : [],
          firstRow: raw[0] ?? null,
        };
      }
      if (typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        const topKeys = Object.keys(r);
        const result: Record<string, unknown> = { label, type: 'object', topKeys };
        for (const k of topKeys) {
          const v = r[k];
          if (Array.isArray(v)) {
            result[`${k}_isArray`] = true;
            result[`${k}_length`] = v.length;
            result[`${k}_firstRowKeys`] = v[0] ? Object.keys(v[0] as object) : [];
            result[`${k}_firstRow`] = v[0] ?? null;
          } else if (v && typeof v === 'object') {
            result[`${k}_isObject`] = true;
            result[`${k}_keys`] = Object.keys(v as object);
          } else {
            result[k] = v;
          }
        }
        return result;
      }
      return { label, type: typeof raw, value: String(raw).slice(0, 200) };
    }

    return NextResponse.json({
      groupId,
      members: summarise(membersRaw, 'GetGroupMembers'),
      premium: summarise(premiumRaw, 'GetGroupPremium'),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
