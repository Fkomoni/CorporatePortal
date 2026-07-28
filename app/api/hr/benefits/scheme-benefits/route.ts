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
// "Unlimited" — only currency-format it when it's actually numeric.
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
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const schemeId = searchParams.get('schemeId');
  const benefit = searchParams.get('benefit'); // optional single-benefit filter
  const memberType = searchParams.get('memberType'); // optional
  if (!schemeId) return NextResponse.json({ error: 'schemeId is required' }, { status: 400 });

  try {
    const token = await getServiceToken();
    const qs = new URLSearchParams({ schemeId });
    if (benefit) qs.set('benefit', benefit);
    if (memberType) qs.set('memberType', memberType);

    const res = await fetch(
      `${BASE}/api/EnrolleeProfile/GetSchemeBenefits?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }

    const r = raw as Record<string, unknown>;
    const rows: BenefitRow[] = Array.isArray(r?.result) ? r.result as BenefitRow[]
      : Array.isArray(r?.Result) ? r.Result as BenefitRow[]
      : Array.isArray(raw) ? raw as BenefitRow[]
      : [];

    // One row per (Benefit, MemberType) — consolidate to one card per Benefit,
    // preferring the principal's own row as the representative limit/waiting
    // period since that's what HR cares about at a glance.
    const byBenefit = new Map<string, BenefitRow[]>();
    for (const row of rows) {
      const name = String(row.Benefit ?? '').trim();
      if (!name) continue;
      if (!byBenefit.has(name)) byBenefit.set(name, []);
      byBenefit.get(name)!.push(row);
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

    return NextResponse.json({ categories, rawSample: rows.slice(0, 3), totalRows: rows.length });
  } catch (err) {
    console.error('[hr/benefits/scheme-benefits] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch scheme benefits' },
      { status: 500 },
    );
  }
}
