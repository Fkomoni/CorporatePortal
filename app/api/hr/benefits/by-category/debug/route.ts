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
//   /api/hr/benefits/by-category/debug
//     ?schemeId=1322,1400          numeric PlanIDs, comma-separated
//     ?schemeCode=204166,204167    scheme codes, resolved to PlanIDs first
//     &category=Dental,Optical     default: every suffix in CATEGORIES
//     &raw=1                       include the full upstream payload
//
// With neither schemeId nor schemeCode it lists the signed-in company's schemes
// with both identifiers, so you can see what to pass.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPrognosisToken, PROGNOSIS_BASE as BASE } from '@/lib/prognosis';

// Suffixes worth trying. Unknown ones simply 404 and are reported as absent,
// which is the point: this is how the real list gets established.
const CATEGORIES = [
  'Dental', 'Optical', 'Maternity', 'InPatient', 'OutPatient',
  'Surgery', 'Diagnostics', 'Pharmacy', 'Wellness', 'Immunisation',
  'Physiotherapy', 'Psychiatry', 'Oncology', 'Dialysis', 'Evacuation',
];

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

    // One entry per member type, because that is the axis the app is missing:
    // a category does not have "a limit", it has a limit per family size.
    const byMemberType = [...new Set(list.map((r) => r.MemberType ?? 'null'))].sort().map((mt) => {
      const forType = list.filter((r) => (r.MemberType ?? 'null') === mt);
      return {
        memberType: mt,
        memberTypeId: forType[0]?.MemberTypeId ?? null,
        isPrincipal: forType[0]?.IsPrincipal ?? null,
        limits: [...new Set(forType.map((r) => String(r.Limit ?? '')))],
        deptCodes: [...new Set(forType.map((r) => r.DeptCode ?? ''))],
        rows: forType.length,
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
      byMemberType,
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
    const groupId = session.user.companyId ?? '';
    const catalogue = await listSchemes(token, groupId);

    // Scheme codes are not what the endpoint takes, so resolve them first.
    const resolved: { schemeId: string; from: string; schemeName?: string }[] = [];
    const unresolved: string[] = [];
    for (const code of codes) {
      const hit = catalogue.schemes.find((s) => s.schemeCode === code);
      if (hit?.schemeId) resolved.push({ schemeId: hit.schemeId, from: `code ${code}`, schemeName: hit.schemeName });
      else unresolved.push(code);
    }
    for (const id of ids) {
      const hit = catalogue.schemes.find((s) => s.schemeId === id);
      resolved.push({ schemeId: id, from: `schemeId ${id}`, schemeName: hit?.schemeName });
    }

    if (resolved.length === 0) {
      return NextResponse.json({
        hint: 'Pass ?schemeId=1322 or ?schemeCode=204166 (comma-separated). Add &category=Dental to narrow, &raw=1 for the full payload.',
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
      ...(unresolved.length ? { unresolvedCodes: unresolved, note: 'Those codes are not on this company\'s scheme list.' } : {}),
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
