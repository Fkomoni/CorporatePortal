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

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId') ?? session.user.companyId ?? '';
  if (!groupId) {
    return NextResponse.json(
      { error: 'No groupId: pass ?groupId= or ensure your account has a companyId' },
      { status: 400 }
    );
  }

  const url = `${BASE}/api/CorporateProfile/GetGroupClaims?groupid=${groupId}`;

  try {
    const token = await getServiceToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const rawText = await res.text();
    let parsed: unknown = null;
    let parseError: string | null = null;
    try { parsed = JSON.parse(rawText); } catch (e) { parseError = String(e); }

    // Flatten all fields from first row (if array) for easy field-name inspection
    const firstRow: Record<string, unknown> =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed[0] as Record<string, unknown>
        : parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : {};

    const allFields: Record<string, unknown> = {};
    const flatten = (obj: unknown, prefix = '') => {
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => flatten(item, `[${i}]`));
      } else if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const key = prefix ? `${prefix}.${k}` : k;
          allFields[key] = v;
          if (v && typeof v === 'object') flatten(v, key);
        }
      }
    };
    flatten(firstRow);

    return NextResponse.json({
      requestedGroupId: groupId,
      sessionCompanyId: session.user.companyId,
      sessionPolicyNumber: session.user.policyNumber,
      apiUrl: url,
      httpStatus: res.status,
      parseError,
      isArray: Array.isArray(parsed),
      rowCount: Array.isArray(parsed) ? parsed.length : null,
      firstRow,
      allFieldsOfFirstRow: allFields,
      // Full raw (up to 8000 chars) so you can see all rows
      raw: rawText.slice(0, 8000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), apiUrl: url },
      { status: 500 }
    );
  }
}
