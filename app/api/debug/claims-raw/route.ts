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

function toRows(raw: unknown, depth = 0): Record<string, unknown>[] {
  if (!raw || depth > 6) return [];
  if (Array.isArray(raw)) return raw.filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
  if (typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  for (const v of Object.values(r)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') return v as Record<string, unknown>[];
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const n = toRows(v, depth + 1);
      if (n.length) return n;
    }
  }
  return [];
}

// GET /api/debug/claims-raw
// Returns:
//   - all field names present across the first 20 rows
//   - 5 sample rows that are MISSING diagnosis/ICD fields (so you can see what keys exist)
//   - 5 sample rows that DO have diagnosis (for comparison)
//   - raw top-level response keys
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const groupId = session.user.companyId;
  if (!groupId) return NextResponse.json({ error: 'No group ID in session' }, { status: 400 });

  const params   = new URL(req.url).searchParams;
  const year     = params.get('year') ?? new Date().getFullYear().toString();
  const claimId  = params.get('claimId') ?? null;
  const fromDate = `${year}-01-01`;
  const toDate   = `${year}-12-31`;

  try {
    const token = await getServiceToken();

    // Hit both endpoints so you can compare field names
    const [diagRes, headerRes] = await Promise.all([
      fetch(`${BASE}/api/CorporatePortal/GetPaidClaimsWithDiagnosis?groupId=${groupId}&fromDate=${fromDate}&toDate=${toDate}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
      fetch(`${BASE}/api/EnrolleeClaims/ClaimsHeaderEnquiry?groupid=${groupId}&fromdate=${fromDate}&todate=${toDate}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }),
    ]);

    const [diagRaw, headerRaw] = await Promise.all([
      diagRes.text().then((t) => { try { return JSON.parse(t); } catch { return t; } }),
      headerRes.text().then((t) => { try { return JSON.parse(t); } catch { return t; } }),
    ]);

    const diagRows   = toRows(diagRaw);
    const headerRows = toRows(headerRaw);

    // ICD-related key candidates to check
    const icdKeys = ['ICDCode','ICD_Code','icd_code','Icdcode','icdCode','DiagnosisCode','diagnosis_code','ICD',
      'ICDDescription','ICD_Description','icd_description','IcdDescription','icdDescription',
      'DiagnosisDesc','DiagnosisDescription','diagnosis_desc','DiagnosisName','Diagnosis',
      'ProcedureName','ServiceName','FilterType','ServiceType','ClaimType','icd10','ICD10',
      'Icd10code','icd10code','icd_10','diagnosis','DIAGNOSIS'];

    function analyseRows(rows: Record<string, unknown>[]) {
      if (!rows.length) return { totalRows: 0, allFieldNames: [], sampleMissingDiag: [], sampleWithDiag: [], icdFieldsFound: [] };

      // Collect all unique field names across first 50 rows
      const fieldSet = new Set<string>();
      rows.slice(0, 50).forEach((r) => Object.keys(r).forEach((k) => fieldSet.add(k)));
      const allFieldNames = [...fieldSet].sort();

      // Which ICD candidate keys actually appear in the data
      const icdFieldsFound = icdKeys.filter((k) => fieldSet.has(k));

      // Rows missing all ICD fields vs rows that have at least one
      const hasIcd = (r: Record<string, unknown>) =>
        icdKeys.some((k) => r[k] != null && String(r[k]).trim() !== '' && String(r[k]).trim() !== 'null');

      const withDiag    = rows.filter(hasIcd).slice(0, 5);
      const missingDiag = rows.filter((r) => !hasIcd(r)).slice(0, 5);

      return { totalRows: rows.length, allFieldNames, icdFieldsFound, sampleWithDiag: withDiag, sampleMissingDiag: missingDiag };
    }

    // If claimId filter supplied, return only matching rows from both endpoints
    if (claimId) {
      const match = (rows: Record<string, unknown>[]) =>
        rows.filter((r) => String(r['claim_id'] ?? r['ClaimID'] ?? r['ClaimId'] ?? '') === claimId);
      return NextResponse.json({
        groupId,
        claimId,
        dateRange: { fromDate, toDate },
        GetPaidClaimsWithDiagnosis: {
          httpStatus: diagRes.status,
          rows: match(diagRows),
        },
        ClaimsHeaderEnquiry: {
          httpStatus: headerRes.status,
          rows: match(headerRows),
        },
      });
    }

    return NextResponse.json({
      groupId,
      dateRange: { fromDate, toDate },
      GetPaidClaimsWithDiagnosis: {
        httpStatus: diagRes.status,
        topLevelKeys: diagRaw && typeof diagRaw === 'object' ? Object.keys(diagRaw as object) : [],
        ...analyseRows(diagRows),
      },
      ClaimsHeaderEnquiry: {
        httpStatus: headerRes.status,
        topLevelKeys: headerRaw && typeof headerRaw === 'object' ? Object.keys(headerRaw as object) : [],
        ...analyseRows(headerRows),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
