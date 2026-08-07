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

export interface BenefitCategory {
  category: string;
  limit: string;
  waitingPeriod: string | null;
  covered: string[];
  excluded: string[];
}

// Limit is often a bare number (e.g. 50000) but can also be a word like
// "Unlimited": only currency-format it when it's actually numeric.
function formatLimit(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (isNaN(n)) return String(raw).trim();
  if (n === 0) return '';
  return `₦${n.toLocaleString('en-NG')}`;
}

function formatWaitingPeriod(raw: unknown): string | null {
  const n = Number(raw);
  if (!raw || isNaN(n) || n === 0) return null;
  return `${n} day${n === 1 ? '' : 's'}`;
}

interface BenefitRow {
  RowId?: number;
  Benefit?: string;
  Limit?: unknown;
  MemberTypeId?: number;
  MemberType?: string;
  IsPrincipal?: boolean;
  WaitingPeriod?: number;
  IsExcluded?: boolean;
  DeptCode?: string | null;
}

// Confirmed valid `benefit` query values for GetSchemeBenefits. Prognosis only
// populates the `Benefit` name on a row when this param is passed: an
// unfiltered call returns every row with Benefit:"" and is useless for
// building categories, so we fetch all 5 confirmed types and merge them.
// ChronicMedicines and Surgery both come back tagged Benefit:"Major Disease
// Benefit" (distinguished only by DeptCode CHMEDS/SURG), while MajorDisease
// returns the full superset including those same rows: so we claim rows for
// Chronic Medications / Surgery first (by RowId) and only let the remaining,
// unclaimed rows fall through as "Major Disease Benefit".
const BENEFIT_QUERIES: { param: string; label: string }[] = [
  { param: 'Dental', label: 'Dentistry' },
  { param: 'LensFrames', label: 'Lens and Frames' },
  { param: 'ChronicMedicines', label: 'Chronic Medications' },
  { param: 'Surgery', label: 'Surgery' },
  { param: 'MajorDisease', label: 'Major Disease Benefit' },
];

async function fetchBenefit(token: string, schemeId: string, benefitParam: string, memberType?: string | null): Promise<BenefitRow[]> {
  const qs = new URLSearchParams({ schemeId, benefit: benefitParam });
  if (memberType) qs.set('memberType', memberType);
  const res = await fetch(
    `${BASE}/api/EnrolleeProfile/GetSchemeBenefits?${qs.toString()}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  const text = await res.text();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response for benefit=${benefitParam} (${res.status}): ${text.slice(0, 200)}`);
  }
  const r = raw as Record<string, unknown>;
  return Array.isArray(r?.result) ? r.result as BenefitRow[]
    : Array.isArray(r?.Result) ? r.Result as BenefitRow[]
    : Array.isArray(raw) ? raw as BenefitRow[]
    : [];
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get('schemeId');
  const memberType = searchParams.get('memberType'); // optional
  if (!schemeId) return NextResponse.json({ error: 'schemeId is required' }, { status: 400 });

  try {
    const token = await getServiceToken();

    const results = await Promise.all(
      BENEFIT_QUERIES.map(({ param }) => fetchBenefit(token, schemeId, param, memberType)),
    );

    const claimedRowIds = new Set<number>();
    const byBenefit = new Map<string, BenefitRow[]>();
    let totalRows = 0;

    for (let i = 0; i < BENEFIT_QUERIES.length; i++) {
      const { label } = BENEFIT_QUERIES[i];
      const rows = results[i];
      totalRows += rows.length;
      const group = byBenefit.get(label) ?? [];
      for (const row of rows) {
        if (row.RowId != null) {
          if (claimedRowIds.has(row.RowId)) continue;
          claimedRowIds.add(row.RowId);
        }
        group.push(row);
      }
      if (group.length > 0) byBenefit.set(label, group);
    }

    const categories: BenefitCategory[] = [...byBenefit.entries()].map(([name, group]) => {
      const nonExcluded = group.filter((g) => !g.IsExcluded);
      const representative = nonExcluded.find((g) => g.IsPrincipal) ?? nonExcluded[0] ?? group[0];
      const isFullyExcluded = nonExcluded.length === 0;
      return {
        category: name,
        limit: isFullyExcluded ? '' : formatLimit(representative?.Limit),
        waitingPeriod: isFullyExcluded ? null : formatWaitingPeriod(representative?.WaitingPeriod),
        covered: [],
        excluded: isFullyExcluded ? ['Not covered on this plan'] : [],
      };
    });

    return NextResponse.json({ categories, totalRows });
  } catch (err) {
    console.error('[hr/benefits/scheme-benefits] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch scheme benefits' },
      { status: 500 },
    );
  }
}
