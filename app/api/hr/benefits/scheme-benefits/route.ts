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

export interface SchemeBenefit {
  category: string;
  benefitName: string;
  limit: string;
  isCovered: boolean;
  waitingPeriod: string | null;
  description: string;
}

export interface BenefitCategory {
  category: string;
  limit: string;
  waitingPeriod: string | null;
  covered: string[];
  excluded: string[];
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function isCoveredValue(row: Record<string, unknown>): boolean {
  const v = row['IsCovered'] ?? row['isCovered'] ?? row['is_covered'] ?? row['Covered'] ?? row['covered'] ?? row['Status'] ?? row['status'] ?? true;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return !['false', '0', 'no', 'excluded', 'not covered'].includes(s);
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
    const res = await fetch(
      `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${schemeId}&languageId=1`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }

    const arr: unknown[] = Array.isArray(raw) ? raw
      : Array.isArray((raw as Record<string,unknown>)?.data) ? (raw as Record<string,unknown>).data as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.Data) ? (raw as Record<string,unknown>).Data as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.result) ? (raw as Record<string,unknown>).result as unknown[]
      : [];

    // Group flat benefit rows into categories
    const categoryMap = new Map<string, BenefitCategory>();

    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      const row = r as Record<string, unknown>;

      const category    = str(row, 'Category', 'BenefitCategory', 'benefit_category', 'ServiceType', 'Group', 'BenefitGroup') || 'General';
      const benefitName = str(row, 'BenefitName', 'benefit_name', 'Name', 'Description', 'ServiceName', 'Benefit');
      const limit       = str(row, 'Limit', 'BenefitLimit', 'benefit_limit', 'Amount', 'CoverLimit', 'MaxAmount', 'LimitAmount');
      const waitingPeriod = str(row, 'WaitingPeriod', 'waiting_period', 'WaitPeriod') || null;
      const covered     = isCoveredValue(row);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, limit: limit || '', waitingPeriod: waitingPeriod || null, covered: [], excluded: [] });
      }

      const cat = categoryMap.get(category)!;
      // Use the category-level limit from the first row that has one
      if (!cat.limit && limit) cat.limit = limit;
      if (!cat.waitingPeriod && waitingPeriod) cat.waitingPeriod = waitingPeriod;

      if (benefitName) {
        if (covered) {
          cat.covered.push(benefitName);
        } else {
          cat.excluded.push(benefitName);
        }
      }
    }

    const categories = [...categoryMap.values()];

    return NextResponse.json({ categories, rawSample: arr.slice(0, 3), totalRows: arr.length });
  } catch (err) {
    console.error('[hr/benefits/scheme-benefits] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch scheme benefits' },
      { status: 500 },
    );
  }
}
