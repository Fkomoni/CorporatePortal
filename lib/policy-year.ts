// Start date of the group's CURRENT policy year: the earliest date cover may
// be backdated to on any enrolment flow (invite links, Add Member, Add Family,
// and approving a pending enrolee). Backdating past the policy year start would
// place cover in a period the group wasn't yet covered for / wasn't premium-rated
// for, so it's refused outright rather than merely warned about.
//
// Sourced from GetGroupPremium's policy period, same field fallbacks the claims
// and company-profile endpoints already use. Falls back to 1 January of the
// current calendar year when Prognosis returns no usable policy date.
import { getServiceToken } from '@/lib/corporate-welcome';
import { cacheGet, cacheSet } from '@/lib/server-cache';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  const r = raw as Record<string, unknown>;
  for (const k of ['result', 'Result', 'data', 'Data']) {
    if (Array.isArray(r?.[k])) return r[k] as Record<string, unknown>[];
  }
  return [];
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function jan1ThisYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

/**
 * Returns the current policy year's start date as `yyyy-mm-dd`.
 *
 * If the recorded policy period has already lapsed (the group has rolled into a
 * renewal Prognosis hasn't reflected yet), the recorded start is still returned
 *: it's the most defensible floor we have, and being slightly permissive is
 * preferable to blocking a legitimate backdate.
 */
export async function getPolicyYearStart(groupId: string): Promise<string> {
  if (!groupId) return jan1ThisYear();

  const cacheKey = `policy-year-start-${groupId}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/CorporateProfile/GetGroupPremium?groupid=${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const raw = await res.text().then((t) => { try { return JSON.parse(t); } catch { return null; } });
    const rows = toRows(raw);
    const start = rows.length > 0
      ? parseDate(str(rows[0], 'Fromdate', 'Client_DateAccepted', 'Member_Effectivedate', 'StartDate', 'InceptionDate'))
      : null;
    const iso = start ? start.toISOString().slice(0, 10) : jan1ThisYear();
    cacheSet(cacheKey, iso);
    return iso;
  } catch (e) {
    console.warn(`[policy-year] Could not resolve policy year start for group ${groupId}, defaulting to ${jan1ThisYear()}:`, e);
    return jan1ThisYear();
  }
}

/** Human-readable form for error messages, e.g. "1 January 2026". */
export function formatPolicyYearStart(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
