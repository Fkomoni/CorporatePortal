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

function formatLimit(raw: unknown): string {
  const n = Number(raw);
  if (!raw || isNaN(n) || n === 0) return '';
  return `₦${n.toLocaleString('en-NG')}`;
}

function formatWaitingPeriod(raw: unknown): string | null {
  const n = Number(raw);
  if (!raw || isNaN(n) || n === 0) return null;
  return `${n} day${n === 1 ? '' : 's'}`;
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

    // Unwrap {status, data} envelope or bare array
    const arr: unknown[] = Array.isArray(raw) ? raw
      : Array.isArray((raw as Record<string,unknown>)?.data) ? (raw as Record<string,unknown>).data as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.Data) ? (raw as Record<string,unknown>).Data as unknown[]
      : Array.isArray((raw as Record<string,unknown>)?.result) ? (raw as Record<string,unknown>).result as unknown[]
      : [];

    const categoryMap = new Map<string, BenefitCategory>();
    // Track seen (category, benefitName) pairs to deduplicate across member-type/age-band rows
    const seenItems = new Set<string>();

    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      const row = r as Record<string, unknown>;

      // Real API fields: SERVICE = category name, DEPARTMENT = benefit item, LIMIT = ₦ limit
      const category = (
        String(row['SERVICE'] ?? row['Service'] ?? row['Category'] ?? row['BenefitCategory'] ?? row['ServiceType'] ?? '').trim()
      ) || 'General';

      const benefitName = (
        String(row['DEPARTMENT'] ?? row['Department'] ?? row['BenefitName'] ?? row['Name'] ?? row['Description'] ?? '').trim()
      );

      const limitStr = formatLimit(row['LIMIT'] ?? row['Limit'] ?? row['BenefitLimit'] ?? row['Amount']);
      const waitStr  = formatWaitingPeriod(row['WaitingPeriod'] ?? row['waiting_period'] ?? row['WaitPeriod']);

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, limit: '', waitingPeriod: null, covered: [], excluded: [] });
      }

      const cat = categoryMap.get(category)!;
      if (!cat.limit && limitStr) cat.limit = limitStr;
      if (!cat.waitingPeriod && waitStr) cat.waitingPeriod = waitStr;

      // Deduplicate benefit items across member-type / age-band rows (M+1, M+2, age bands, etc.)
      if (benefitName) {
        const key = `${category}||${benefitName}`;
        if (!seenItems.has(key)) {
          seenItems.add(key);
          cat.covered.push(benefitName);
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
