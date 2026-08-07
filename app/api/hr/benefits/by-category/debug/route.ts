// Probe for EnrolleeProfile/GetEnrolleeBenefitsByScheme_<Category>.
//
// This family is not what the app uses. The Benefits page reads
// CorporatePortal/GetSchemeBenefits, which gives one flat list per scheme. This
// one returns a row per category *per member type* (M, M+1 ... M+6) with Limit,
// Used, Balance, waiting period and exclusion flags, which is the breakdown a
// per-member benefit view actually needs.
//
// Read-only, and it exists to answer three questions before anything is built on
// it: which category suffixes exist, whether every scheme answers them, and
// whether the numbers differ by member type.
//
// The endpoint takes a schemeId and nothing else: it does not know which group a
// scheme belongs to, so any scheme ID works here whether or not it belongs to the
// signed-in company.
//
//   /api/hr/benefits/by-category/debug
//     ?schemeId=1322,204166        numeric PlanIDs, any group
//     &category=Dental,Optical     default: every suffix in CATEGORIES
//     &raw=1                       include the full upstream payload
//
// Codes are alphanumeric (AFRICMAX, NGMAXFAM22), not numeric, and turning one
// into a PlanID is the only part that needs a group:
//
//     ?schemeCode=AFRICMAX         resolved against the signed-in company
//     ?schemeCode=AFRICMAX&groupId=1001    or against any group
//
// With neither, it lists the company's schemes with both identifiers.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPrognosisToken, PROGNOSIS_BASE as BASE } from '@/lib/prognosis';

// Confirmed by probing six schemes: only these two answer. Dental was the
// endpoint supplied; Surgery was found by trial. Thirteen other guesses returned
// nothing, so the default no longer carries names nobody has verified. Pass
// &category= to try others, or use scripts/probe-benefits.mjs --discover, which
// derives candidates from the scheme's own benefit names.
const CATEGORIES = ['Dental', 'Surgery'];

interface BenefitRow {
  Benefit?: string; Limit?: string | number; Used?: number; Balance?: string | number;
  MemberType?: string | null; MemberTypeId?: number; IsPrincipal?: boolean | null;
  DeptCode?: string; ServiceTypeCode?: string; IsExcluded?: boolean;
  WaitingPeriod?: number; LimitDays?: number; VisitsLimit?: number;
  Scheme?: number; Service?: number; RowId?: number;
}

function rows(raw: unknown): BenefitRow[] {
  if (Array.isArray(raw)) return raw as BenefitRow[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const k of ['result', 'Result', 'data', 'Data']) {
      if (Array.isArray(r[k])) return r[k] as BenefitRow[];
    }
  }
  return [];
}

async function listSchemes(token: string, groupId: string) {
  const res = await fetch(`${BASE}/api/CorporatePortal/GetPolicySchemes?groupId=${encodeURIComponent(groupId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let raw: unknown = null;
  try { raw = JSON.parse(text); } catch { /* reported below */ }
  const list = rows(raw) as unknown as Record<string, unknown>[];
  const str = (r: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) { const v = r[k]; if (v != null && String(v).trim()) return String(v).trim(); }
    return '';
  };
  return {
    ok: res.ok,
    status: res.status,
    schemes: list.map((r) => ({
      schemeId: str(r, 'PlanID', 'PlanId', 'SchemeId', 'schemeId', 'Id', 'id'),
      schemeCode: str(r, 'schemecode', 'SchemeCode', 'schemeCode', 'PlanCode'),
      schemeName: str(r, 'PlanName', 'planName', 'SchemeName', 'Name', 'Description'),
    })),
  };
}

async function probe(token: string, schemeId: string, category: string, includeRaw: boolean) {
  const path = `/api/EnrolleeProfile/GetEnrolleeBenefitsByScheme_${category}?schemeId=${encodeURIComponent(schemeId)}`;
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await res.text();
    let raw: unknown = null;
    try { raw = JSON.parse(text); } catch { /* non-JSON reported via sample */ }
    const list = rows(raw);

    // Grouped by benefit first, then member type within it. Grouping by member
    // type alone collapsed a scheme whose rows all carry a null MemberType into
    // one entry listing several limits with no way to tell which benefit each
    // belonged to. A limit belongs to a benefit; the member type only subdivides
    // it, and on many schemes there is no member type at all.
    const benefitNames = [...new Set(list.map((r) => r.Benefit || '(unnamed)'))];
    const byBenefit = benefitNames.map((benefit) => {
      const forBenefit = list.filter((r) => (r.Benefit || '(unnamed)') === benefit);
      const types = [...new Set(forBenefit.map((r) => r.MemberType ?? null))];
      return {
        benefit,
        hasMemberTypeBreakdown: types.some((t) => t != null),
        byMemberType: types.map((mt) => {
          const forType = forBenefit.filter((r) => (r.MemberType ?? null) === mt);
          return {
            memberType: mt ?? 'all members',
            memberTypeId: forType[0]?.MemberTypeId ?? null,
            isPrincipal: forType[0]?.IsPrincipal ?? null,
            limit: [...new Set(forType.map((r) => (r.Limit === '' || r.Limit == null ? null : r.Limit)))],
            used: [...new Set(forType.map((r) => r.Used ?? 0))],
            deptCodes: [...new Set(forType.map((r) => r.DeptCode ?? '').filter(Boolean))],
            visitsLimit: [...new Set(forType.map((r) => r.VisitsLimit ?? 0))].filter(Boolean),
            waitingPeriod: [...new Set(forType.map((r) => r.WaitingPeriod ?? 0))].filter(Boolean),
            excluded: forType.some((r) => r.IsExcluded === true),
            rows: forType.length,
          };
        }),
      };
    });

    return {
      category,
      path,
      httpStatus: res.status,
      ms: Date.now() - started,
      exists: res.ok && list.length > 0,
      count: list.length,
      benefits: [...new Set(list.map((r) => r.Benefit ?? ''))].filter(Boolean),
      distinctLimits: [...new Set(list.map((r) => String(r.Limit ?? '')))].filter(Boolean),
      anyExcluded: list.some((r) => r.IsExcluded === true),
      byBenefit,
      ...(includeRaw ? { raw } : {}),
      ...(res.ok ? {} : { sample: text.slice(0, 300) }),
    };
  } catch (e) {
    return {
      category, path, httpStatus: 0, ms: Date.now() - started, exists: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const q = new URL(req.url).searchParams;
  const includeRaw = q.get('raw') === '1';
  const wanted = (q.get('category') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const categories = wanted.length ? wanted : CATEGORIES;
  const ids = (q.get('schemeId') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const codes = (q.get('schemeCode') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  try {
    const token = await getPrognosisToken();
    // Codes only exist within a group, so allow pointing at one other than the
    // caller's own. Scheme IDs never need it.
    const groupId = q.get('groupId') ?? session.user.companyId ?? '';
    const catalogue = await listSchemes(token, groupId);

    // Scheme codes are not what the endpoint takes, so resolve them first.
    const resolved: { schemeId: string; from: string; schemeName?: string }[] = [];
    const unresolved: string[] = [];
    for (const code of codes) {
      const hit = catalogue.schemes.find((s) => s.schemeCode === code);
      if (hit?.schemeId) resolved.push({ schemeId: hit.schemeId, from: `code ${code}`, schemeName: hit.schemeName });
      else unresolved.push(code);
    }
    // A scheme ID is probed as given. Looking it up in the catalogue is only to
    // put a name on it, and not finding one is not a reason to skip it.
    for (const id of ids) {
      const hit = catalogue.schemes.find((s) => s.schemeId === id);
      resolved.push({
        schemeId: id,
        from: `schemeId ${id}`,
        schemeName: hit?.schemeName ?? '(not in this group\'s scheme list, probing anyway)',
      });
    }

    if (resolved.length === 0) {
      return NextResponse.json({
        hint: 'Pass ?schemeId=1322 (numeric, any group, comma-separated). Codes are alphanumeric: ?schemeCode=AFRICMAX resolves against a group, add &groupId=1001 for a different one. &category=Dental narrows, &raw=1 dumps the payload.',
        groupId,
        schemesForThisCompany: catalogue,
        categoriesProbedByDefault: CATEGORIES,
        ...(unresolved.length ? { unresolvedCodes: unresolved } : {}),
      });
    }

    const results = [];
    for (const target of resolved) {
      const probes = [];
      for (const category of categories) {
        probes.push(await probe(token, target.schemeId, category, includeRaw));
      }
      results.push({
        ...target,
        categoriesFound: probes.filter((p) => p.exists).map((p) => p.category),
        categoriesAbsent: probes.filter((p) => !p.exists).map((p) => p.category),
        probes: probes.filter((p) => p.exists || wanted.length > 0),
      });
    }

    return NextResponse.json({
      groupId,
      ...(unresolved.length ? {
        unresolvedCodes: unresolved,
        note: `Not on group ${groupId}'s scheme list. Codes are alphanumeric such as AFRICMAX; if these are numeric they are probably scheme IDs, so pass them as ?schemeId= instead.`,
      } : {}),
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
