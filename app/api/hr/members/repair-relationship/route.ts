// Repairs principals whose relationship is missing or wrong on Prognosis.
//
// Between 27 July and the fix, every principal registration sent
// Relationship_ID "1", which is in Prognosis's relationship table for nothing,
// so it stored no relationship at all. Separately, editing any principal's
// biodata rewrote their relationship as 41 (Other), because the write path fell
// through to its dependant label mapping. Registration and editing are both
// fixed now; this puts right the records they already damaged.
//
//   GET  /api/hr/members/repair-relationship        list what would change
//   POST /api/hr/members/repair-relationship        apply it
//        { "enrolleeIds": ["21000645/0"] }          or just these
//        { "limit": 25 }                            cap a run
//
// GET never writes. POST re-sends each affected principal's own record through
// the same builder the edit screen uses, with every other field carried
// through unchanged, so the only thing that moves is Relationship_ID.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { cacheBust } from '@/lib/server-cache';
import { getServiceToken } from '@/lib/corporate-welcome';
import { getPrincipalRelationshipId } from '@/lib/principal-relationship';
import { buildMemberWritePayload, s, n } from '@/lib/member-write-payload';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

interface Affected {
  enrolleeId: string;
  name: string;
  cifNumber: string;
  currentRelationship: string;
  currentRelationshipId: string;
  enrolled: string;
}

function rosterRows(raw: unknown): Record<string, unknown>[] {
  const r = raw as Record<string, unknown> | null;
  for (const k of ['result', 'Result', 'data', 'Data']) {
    if (Array.isArray(r?.[k])) return r![k] as Record<string, unknown>[];
  }
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

/** Every principal on the group whose relationship is not the main-member ID. */
async function findAffected(token: string, groupId: string, mainMemberId: string): Promise<Affected[]> {
  const seen = new Set<string>();
  const out: Affected[] = [];
  for (const status of ['active', 'inactive']) {
    const res = await fetch(
      `${BASE}/api/CorporateProfile/ClientPlanBeneficiariesNoPagitation?group_id=${encodeURIComponent(groupId)}&memberstatus=${status}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    for (const row of rosterRows(await res.json().catch(() => null))) {
      // Principals only: a dependant's relationship is its own and correct.
      if (s(row['IsDependant']).toLowerCase() === 'yes') continue;
      const enrolleeId = s(row['Enrolleeid'] ?? row['EnrolleeID']);
      if (!enrolleeId || seen.has(enrolleeId)) continue;
      seen.add(enrolleeId);

      const relId = s(row['Relationship_id'] ?? row['Relationship_ID']);
      // 0 and '' both mean nothing was stored. Anything that is not the
      // main-member ID is wrong on a principal, 41 included.
      if (relId && relId !== '0' && relId === mainMemberId) continue;

      out.push({
        enrolleeId,
        name: `${s(row['firstname'])} ${s(row['surname'])}`.trim(),
        cifNumber: s(row['cif_number']),
        currentRelationship: s(row['RelationshipToPrincipal']) || '(none)',
        currentRelationshipId: relId || '(none)',
        enrolled: s(row['dateenrolled']).slice(0, 10),
      });
    }
  }
  return out;
}

async function bio(token: string, enrolleeId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${BASE}/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  const raw = await res.json().catch(() => null);
  const p = raw as Record<string, unknown> | null;
  const field = p?.result ?? p?.Result ?? p?.data ?? p?.Data;
  const row = (Array.isArray(field) ? field[0] : field) ?? p;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }
  const groupId = new URL(req.url).searchParams.get('groupId') ?? session.user.companyId ?? '';
  try {
    const token = await getServiceToken();
    const mainMemberId = await getPrincipalRelationshipId(token);
    const affected = await findAffected(token, groupId, mainMemberId);
    return NextResponse.json({
      groupId,
      mainMemberId,
      affectedCount: affected.length,
      note: affected.length
        ? `${affected.length} principal(s) would be set to Relationship_ID ${mainMemberId}. Nothing has been changed. POST to this URL to apply.`
        : 'Every principal on this group already carries the main-member relationship. Nothing to repair.',
      affected,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: { enrolleeIds?: string[]; limit?: number; groupId?: string } = {};
  try { body = await req.json(); } catch { /* an empty body means repair everything */ }

  const groupId = body.groupId ?? session.user.companyId ?? '';

  try {
    const token = await getServiceToken();
    const mainMemberId = await getPrincipalRelationshipId(token);

    let targets = await findAffected(token, groupId, mainMemberId);
    if (body.enrolleeIds?.length) {
      const wanted = new Set(body.enrolleeIds.map((x) => x.trim().toLowerCase()));
      targets = targets.filter((t) => wanted.has(t.enrolleeId.toLowerCase()));
    }
    if (body.limit && body.limit > 0) targets = targets.slice(0, body.limit);

    const repaired: string[] = [];
    const failed: { enrolleeId: string; error: string }[] = [];

    // Sequential on purpose. This writes whole member records, and a burst of
    // parallel writes against Prognosis is not worth the seconds it would save.
    for (const t of targets) {
      try {
        const row = await bio(token, t.enrolleeId);
        if (!row) { failed.push({ enrolleeId: t.enrolleeId, error: 'could not read current record' }); continue; }

        const cifNumber = row['Member_MemberUniqueID'] ?? row['Cif_Number'] ?? t.cifNumber;
        const payload = buildMemberWritePayload({
          row, enrolleeId: t.enrolleeId, groupId, cifNumber,
          isPrincipal: true, mainMemberId,
          overrides: { reason: 'Relationship repair: main member' },
        });
        // Guard against writing a record the read did not populate: a blank
        // name or scheme means the bio call returned something unusable, and
        // sending it would overwrite good data with empty fields.
        if (!s(payload.FirstName) || !n(payload.schemeid)) {
          failed.push({ enrolleeId: t.enrolleeId, error: 'current record incomplete, refusing to write' });
          continue;
        }

        const res = await fetch(`${BASE}/api/EnrolleeProfile/UpdateBiodata`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        // This family answers HTTP 200 with the failure in the body, so the
        // status code alone would report every rejection as a repair.
        if (!res.ok || /"?status"?\s*:\s*(4|5)\d\d|error|invalid|fail/i.test(text)) {
          failed.push({ enrolleeId: t.enrolleeId, error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
          continue;
        }
        console.log(`[repair-relationship] ${t.enrolleeId} (${t.name}) ${t.currentRelationshipId} → ${mainMemberId}`);
        repaired.push(t.enrolleeId);
      } catch (e) {
        failed.push({ enrolleeId: t.enrolleeId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (repaired.length) cacheBust(`members:${groupId}`);
    void logAudit({
      session, action: 'REPAIR_RELATIONSHIP', resource: 'members', request: req,
      details: { groupId, mainMemberId, repaired: repaired.length, failed: failed.length },
    });

    return NextResponse.json({
      groupId,
      mainMemberId,
      attempted: targets.length,
      repaired: repaired.length,
      failedCount: failed.length,
      repairedEnrolleeIds: repaired,
      ...(failed.length ? { failed } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
