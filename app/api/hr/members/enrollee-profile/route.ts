import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { logTag } from '@/lib/log-tag';

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

function str(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const enrolleeId = searchParams.get('enrolleeId');
  if (!enrolleeId) return NextResponse.json({ error: 'enrolleeId is required' }, { status: 400 });

  try {
    const token = await getServiceToken();
    const res = await fetch(
      `${BASE}/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const text = await res.text();
    console.log(`[enrollee-profile] ${logTag(session.user.email)} ${enrolleeId} → HTTP ${res.status}: ${text.slice(0, 500)}`);

    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = null; }

    if (!res.ok || !raw) {
      return NextResponse.json({ error: `Failed to fetch enrollee profile (${res.status})` }, { status: res.status });
    }

    // Prognosis may wrap in result/data/Result
    const r = raw as Record<string, unknown>;
    const row = (
      (r?.result ?? r?.Result ?? r?.data ?? r?.Data ?? r) as Record<string, unknown>
    ) ?? {};

    const cifNumber  = str(row, 'Cif_Number', 'CIF_Number', 'CifNo', 'Cif', 'cifNumber', 'MemberCifNo', 'CIF_No');
    const schemeId   = str(row, 'SchemeId', 'Scheme_Id', 'SchemId', 'schemeid', 'SchemeID', 'Schemeid', 'ProductId');
    const schemeName = str(row, 'SchemeName', 'Scheme_Name', 'Scheme', 'PlanName', 'Plan', 'ProductName');
    const groupId    = str(row, 'GroupId', 'Group_Id', 'Groupid', 'groupid', 'GroupID', 'CompanyId', 'Company_Id');
    const employeeCode = str(row, 'EmployeeCode', 'Employee_Code', 'EmployeeNo', 'Employeecode', 'employeecode');

    console.log(`[enrollee-profile] ${logTag(session.user.email)} resolved → cifNumber=${cifNumber} schemeId=${schemeId} schemeName=${schemeName} groupId=${groupId}`);

    return NextResponse.json({ cifNumber, schemeId, schemeName, groupId, employeeCode, raw: row });
  } catch (err) {
    console.error('[enrollee-profile] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch profile' }, { status: 500 });
  }
}
