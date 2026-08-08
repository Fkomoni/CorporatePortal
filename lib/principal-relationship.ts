// The Relationship_ID that marks an enrolee as the main member.
//
// This was hardcoded as "1" on every principal registration. It is not 1.
// Prognosis's own records for group 1003 return, for a principal:
//
//   "RelationshipToPrincipal": "Main member\t", "Relationship_id": 30
//
// and for a dependant:
//
//   "RelationshipToPrincipal": "Son", "Relationship_id": 8
//
// 8 matches the dependant mapping already confirmed elsewhere in this app
// (Spouse=23, Son=8, Daughter=7, other=41), so principals and dependants share
// one ID space: the one GetBeneficiaryRelationship publishes. In that space the
// main member is 30, and 1 is not the value for anything that reads back as a
// main member, which is why the relationship appeared not to be sent at all.
//
// So it is resolved from GetBeneficiaryRelationship rather than hardcoded again.
// If that list ever renames the entry or renumbers it, registrations follow it.
import { getServiceToken } from '@/lib/corporate-welcome';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

/** Used when the list cannot be read. Confirmed from live records, not docs. */
export const PRINCIPAL_RELATIONSHIP_FALLBACK = '30';

/** Matches "Main member", "Main Member\t", "mainmember", "Principal". */
function isMainMember(text: string): boolean {
  const t = text.toLowerCase().replace(/[^a-z]/g, '');
  return t === 'mainmember' || t === 'principal' || t === 'mainmemberprincipal';
}

/**
 * Picks the main-member entry out of a GetBeneficiaryRelationship response.
 * Exported for testing and so callers holding the list already can use it
 * without a second fetch.
 */
export function findPrincipalRelationshipId(raw: unknown): string | null {
  const rows: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : raw && typeof raw === 'object'
      ? (() => {
          const o = raw as Record<string, unknown>;
          for (const k of ['result', 'Result', 'data', 'Data', 'items', 'Items']) {
            if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
          }
          return [];
        })()
      : [];

  for (const r of rows) {
    // The live payload carries a trailing tab on this text, so it is trimmed
    // before matching rather than compared literally.
    const text = String(r.Text ?? r.text ?? r.Relationship ?? r.RelationshipName ?? r.Name ?? '').trim();
    const value = String(r.Value ?? r.value ?? r.Relationship_ID ?? r.Relationship_id ?? r.RelationshipID ?? r.Id ?? '').trim();
    if (text && value && isMainMember(text)) return value;
  }
  return null;
}

// The list changes about as often as the scheme catalogue, so it is cached for
// the same six hours the service token is, rather than fetched on every
// registration.
let cached: string | null = null;
let cachedAt = 0;
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * The Relationship_ID to send for a principal. Never throws: a registration
 * must not fail because a lookup list was briefly unreachable, so the confirmed
 * fallback is used and the substitution is logged.
 */
export async function getPrincipalRelationshipId(token?: string): Promise<string> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  try {
    const t = token ?? (await getServiceToken());
    const res = await fetch(`${BASE}/api/ListValues/GetBeneficiaryRelationship`, {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
    });
    const raw = await res.json().catch(() => null);
    const found = findPrincipalRelationshipId(raw);
    if (found) {
      if (found !== cached) console.log(`[principal-relationship] main member Relationship_ID = ${found}`);
      cached = found;
      cachedAt = Date.now();
      return found;
    }
    console.warn(
      `[principal-relationship] GetBeneficiaryRelationship had no main-member entry, using ${PRINCIPAL_RELATIONSHIP_FALLBACK}`,
    );
  } catch (e) {
    console.warn(
      `[principal-relationship] could not read GetBeneficiaryRelationship, using ${PRINCIPAL_RELATIONSHIP_FALLBACK}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return PRINCIPAL_RELATIONSHIP_FALLBACK;
}
