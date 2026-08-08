// What relationship does Prognosis actually hold for one enrolee?
//
// Registration sends Relationship_ID and Prognosis stores it, but nothing in the
// portal reads it straight back for a single member, so a principal registered
// with the wrong ID looked fine on the way in and blank afterwards. This asks
// every endpoint that carries a relationship for one enrolee and prints what
// each one says, rather than trusting a single source.
//
//   /api/hr/members/relationship-check?enrolleeId=21000645/0
//     &raw=1        include each endpoint's full response
//
// Read-only. It also prints the main-member entry from
// GetBeneficiaryRelationship, so the value seen on the member can be compared
// against the ID registration would send today.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getServiceToken } from '@/lib/corporate-welcome';
import { getPrincipalRelationshipId, findPrincipalRelationshipId } from '@/lib/principal-relationship';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

async function hit(token: string, path: string) {
  const url = `${BASE}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }
    return { path, status: res.status, ms: Date.now() - started, body };
  } catch (e) {
    return { path, status: 0, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

function toRows(raw: unknown, depth = 0): Record<string, unknown>[] {
  if (!raw || depth > 5) return [];
  if (Array.isArray(raw)) return raw.filter((v) => v && typeof v === 'object') as Record<string, unknown>[];
  if (typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  for (const v of Object.values(r)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object' && v[0] !== null) return v as Record<string, unknown>[];
  }
  for (const v of Object.values(r)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = toRows(v, depth + 1);
      if (nested.length) return nested;
    }
  }
  // A single object with no array anywhere is still one row.
  return Object.keys(r).length ? [r] : [];
}

/** Every key whose name mentions a relationship, with its value as stored. */
function relationshipFields(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (/relation/i.test(k)) out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

const idKeys = ['Enrolleeid', 'EnrolleeID', 'enrolleeid', 'Member_EnrolleeID', 'MemberEnrolleeID', 'EnrolleeId'];

function matchesEnrolee(row: Record<string, unknown>, enrolleeId: string): boolean {
  const want = enrolleeId.trim().toLowerCase();
  for (const k of idKeys) {
    const v = row[k];
    if (v != null && String(v).trim().toLowerCase() === want) return true;
  }
  return false;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const q = new URL(req.url).searchParams;
  const enrolleeId = (q.get('enrolleeId') ?? '').trim();
  const includeRaw = q.get('raw') === '1';
  const groupId = q.get('groupId') ?? session.user.companyId ?? '';
  if (!enrolleeId) {
    return NextResponse.json({ hint: 'Pass ?enrolleeId=21000645/0' }, { status: 400 });
  }

  try {
    const token = await getServiceToken();

    // The per-member endpoints, plus the group roster which is the one confirmed
    // to carry both the label and the numeric ID on the same row.
    const [bio, relList, active, inactive] = await Promise.all([
      hit(token, `/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`),
      hit(token, '/api/ListValues/GetBeneficiaryRelationship'),
      hit(token, `/api/CorporateProfile/ClientPlanBeneficiariesNoPagitation?group_id=${encodeURIComponent(groupId)}&memberstatus=active`),
      hit(token, `/api/CorporateProfile/ClientPlanBeneficiariesNoPagitation?group_id=${encodeURIComponent(groupId)}&memberstatus=inactive`),
    ]);

    const findings: Record<string, unknown>[] = [];

    const bioRows = toRows(bio.body);
    const bioRow = bioRows.find((r) => matchesEnrolee(r, enrolleeId)) ?? bioRows[0];
    if (bioRow) {
      findings.push({
        source: 'GetEnrolleeBioDataByEnrolleeID',
        httpStatus: bio.status,
        relationship: relationshipFields(bioRow),
        keys: Object.keys(bioRow),
      });
    } else {
      findings.push({ source: 'GetEnrolleeBioDataByEnrolleeID', httpStatus: bio.status, relationship: {}, note: 'no row matched' });
    }

    // The member may be on either list, so both are searched and whichever holds
    // them is reported with its status.
    for (const [label, result] of [['active', active], ['inactive', inactive]] as const) {
      const row = toRows(result.body).find((r) => matchesEnrolee(r, enrolleeId));
      if (row) {
        findings.push({
          source: `ClientPlanBeneficiariesNoPagitation (${label})`,
          httpStatus: result.status,
          relationship: relationshipFields(row),
          isDependant: row.IsDependant ?? null,
          memberStatus: row.member_status_descr ?? row.MemberStatus_Desc ?? null,
          name: `${row.firstname ?? ''} ${row.surname ?? ''}`.trim(),
          cifNumber: row.cif_number ?? null,
          parentCif: row.parentcif ?? null,
        });
      }
    }

    // What registration would send for a principal today, for comparison.
    const wouldSend = await getPrincipalRelationshipId(token);
    const mainMemberInList = findPrincipalRelationshipId(relList.body);

    // A principal whose relationship came back empty is the failure this exists
    // to detect, so it is called out rather than left to be read off the rows.
    const values = findings.flatMap((f) => Object.values((f.relationship ?? {}) as Record<string, unknown>));
    const anyPopulated = values.some((v) => v != null && String(v).trim() !== '' && String(v).trim() !== '0');
    const looksPrincipal = enrolleeId.trim().endsWith('/0');

    return NextResponse.json({
      enrolleeId,
      groupId,
      verdict: !anyPopulated
        ? `No endpoint holds a relationship for this enrolee.${looksPrincipal ? ' It is a principal (/0), so this is the blank-relationship case: it was registered with a Relationship_ID Prognosis does not recognise.' : ''}`
        : 'A relationship is stored. Compare the values below against the main-member ID.',
      mainMemberIdInList: mainMemberInList,
      registrationWouldSend: wouldSend,
      findings,
      ...(includeRaw ? { raw: { bio, relList, active, inactive } } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
