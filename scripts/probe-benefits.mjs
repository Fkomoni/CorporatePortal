#!/usr/bin/env node
// Probes EnrolleeProfile/GetEnrolleeBenefitsByScheme_<Category> from a shell.
//
// Runs on Render without a browser session: it logs in with the same
// PROGNOSIS_USERNAME / PROGNOSIS_PASSWORD the app uses, so there is nothing to
// pass but the schemes you want.
//
// GetEnrolleeBenefitsByScheme_<Category> takes a schemeId and nothing else. It
// does not know or care which group a scheme belongs to, so any scheme ID works
// with no group involved:
//
//   node scripts/probe-benefits.mjs 1322
//   node scripts/probe-benefits.mjs 204166 204167 204168      # any group
//   node scripts/probe-benefits.mjs 1322 --category=Dental --raw
//
// --identify says what an unknown number is, by trying it as a scheme ID and as
// a group ID and reporting which one answers:
//
//   node scripts/probe-benefits.mjs --identify=204166,204167
//
// The remaining flags are only for turning an alphanumeric scheme code such as
// AFRICMAX into its numeric PlanID, which does need to know the group:
//
//   node scripts/probe-benefits.mjs --group=1001               # list its schemes
//   node scripts/probe-benefits.mjs --code=AFRICMAX --group=1001

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '').replace(/\/$/, '');

const CATEGORIES = [
  'Dental', 'Optical', 'Maternity', 'InPatient', 'OutPatient',
  'Surgery', 'Diagnostics', 'Pharmacy', 'Wellness', 'Immunisation',
  'Physiotherapy', 'Psychiatry', 'Oncology', 'Dialysis', 'Evacuation',
];

const args = process.argv.slice(2);
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};
const ids = args.filter((a) => !a.startsWith('--'));
const codes = flag('code').split(',').map((s) => s.trim()).filter(Boolean);
const group = flag('group');
const identify = flag('identify').split(',').map((s) => s.trim()).filter(Boolean);
const wanted = flag('category').split(',').map((s) => s.trim()).filter(Boolean);
const categories = wanted.length ? wanted : CATEGORIES;
const showRaw = args.includes('--raw');

async function login() {
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Login returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const p = data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data;
  const token = p?.accessToken ?? p?.token ?? p?.AccessToken ?? p?.Token ?? p?.bearer ?? p?.Bearer ?? '';
  if (!token) throw new Error(`No token in login response: ${text.slice(0, 200)}`);
  return String(token);
}

const listOf = (raw) => {
  if (Array.isArray(raw)) return raw;
  for (const k of ['result', 'Result', 'data', 'Data']) if (Array.isArray(raw?.[k])) return raw[k];
  return [];
};

const pick = (row, ...keys) => {
  for (const k of keys) if (row?.[k] != null && String(row[k]).trim()) return String(row[k]).trim();
  return '';
};

async function schemesFor(token, groupId) {
  const res = await fetch(`${BASE}/api/CorporatePortal/GetPolicySchemes?groupId=${encodeURIComponent(groupId)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let raw = null;
  try { raw = JSON.parse(text); } catch { /* fall through to empty */ }
  return listOf(raw).map((r) => ({
    schemeId: pick(r, 'PlanID', 'PlanId', 'SchemeId', 'schemeId', 'Id', 'id'),
    schemeCode: pick(r, 'schemecode', 'SchemeCode', 'schemeCode', 'PlanCode'),
    schemeName: pick(r, 'PlanName', 'planName', 'SchemeName', 'Name', 'Description'),
  }));
}

async function probe(token, schemeId, category) {
  const url = `${BASE}/api/EnrolleeProfile/GetEnrolleeBenefitsByScheme_${category}?schemeId=${encodeURIComponent(schemeId)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const text = await res.text();
    let raw = null;
    try { raw = JSON.parse(text); } catch { /* non-JSON handled below */ }
    return { category, url, status: res.status, ms: Date.now() - t0, rows: listOf(raw), raw, text };
  } catch (e) {
    return { category, url, status: 0, ms: Date.now() - t0, rows: [], error: String(e) };
  }
}

async function identifyOne(token, n) {
  // As a scheme: the benefits endpoint answers with rows.
  const asScheme = await probe(token, n, 'Dental');
  // As a group: GetPolicySchemes answers with that group's scheme list.
  let asGroup = [];
  try { asGroup = await schemesFor(token, n); } catch { /* reported as none */ }

  const schemeRows = asScheme.rows.length;
  const verdict = schemeRows > 0 && asGroup.length > 0 ? 'BOTH (ambiguous)'
    : schemeRows > 0 ? 'a scheme ID (PlanID)'
    : asGroup.length > 0 ? 'a group ID'
    : 'neither a scheme ID nor a group ID';

  console.log(`\n${n}: ${verdict}`);
  if (schemeRows > 0) {
    const benefits = [...new Set(asScheme.rows.map((r) => r.Benefit).filter(Boolean))];
    const schemeField = [...new Set(asScheme.rows.map((r) => r.Scheme))];
    console.log(`   as scheme: ${schemeRows} Dental rows, benefits ${benefits.join(', ')}, Scheme field ${schemeField.join(',')}`);
  } else {
    console.log(`   as scheme: HTTP ${asScheme.status}, no rows`);
  }
  if (asGroup.length > 0) {
    console.log(`   as group:  ${asGroup.length} scheme(s)`);
    for (const s of asGroup) console.log(`     PlanID ${String(s.schemeId).padEnd(8)} code ${String(s.schemeCode).padEnd(12)} ${s.schemeName}`);
  } else {
    console.log('   as group:  no schemes returned');
  }
}

(async () => {
  const token = await login();
  console.log(`token ok, base ${BASE}\n`);

  if (identify.length) {
    console.log('Identifying, by asking the API rather than guessing:');
    for (const n of identify) await identifyOne(token, n);
    return;
  }

  const targets = ids.map((id) => ({ schemeId: id, label: `schemeId ${id}` }));

  if (codes.length || (!ids.length && group)) {
    if (!group) throw new Error('--code needs --group=<groupId> to resolve codes to PlanIDs.');
    const schemes = await schemesFor(token, group);
    console.log(`schemes for group ${group}:`);
    for (const s of schemes) {
      console.log(`  PlanID ${String(s.schemeId).padEnd(8)} code ${String(s.schemeCode).padEnd(10)} ${s.schemeName}`);
    }
    console.log();
    for (const code of codes) {
      const hit = schemes.find((s) => s.schemeCode === code);
      if (hit) targets.push({ schemeId: hit.schemeId, label: `code ${code} -> PlanID ${hit.schemeId} (${hit.schemeName})` });
      else console.log(`  code ${code}: NOT on this group's scheme list`);
    }
    if (!targets.length) return;
    console.log();
  }

  if (!targets.length) {
    console.log('Nothing to probe. Pass scheme IDs, or --code=... --group=..., or --group=... to list schemes.');
    return;
  }

  for (const t of targets) {
    console.log(`\n${'='.repeat(72)}\n${t.label}\n${'='.repeat(72)}`);
    const found_ = [], absent_ = [];
    for (const category of categories) {
      const r = await probe(token, t.schemeId, category);
      const found = r.status === 200 && r.rows.length > 0;
      (found ? found_ : absent_).push(category);
      if (!found) {
        // Only noise when the caller asked for this category explicitly.
        if (wanted.length) console.log(`  ${category.padEnd(14)} HTTP ${r.status}  no rows${r.text ? `  ${r.text.slice(0, 90)}` : ''}`);
        continue;
      }
      const benefits = [...new Set(r.rows.map((x) => x.Benefit).filter(Boolean))];
      console.log(`\n  ${category}  (${r.rows.length} rows, ${r.ms}ms)  benefits: ${benefits.join(', ')}`);
      const types = [...new Set(r.rows.map((x) => x.MemberType ?? 'null'))].sort();
      for (const mt of types) {
        const forType = r.rows.filter((x) => (x.MemberType ?? 'null') === mt);
        const limits = [...new Set(forType.map((x) => String(x.Limit ?? '')))].join(' | ');
        const depts = [...new Set(forType.map((x) => x.DeptCode ?? ''))].join(',');
        const excl = forType.some((x) => x.IsExcluded) ? '  EXCLUDED' : '';
        console.log(`      ${String(mt).padEnd(6)} id=${String(forType[0]?.MemberTypeId ?? '').padEnd(4)} principal=${String(forType[0]?.IsPrincipal ?? '').padEnd(5)} limit=${limits.padEnd(14)} dept=${depts}${excl}`);
      }
      if (showRaw) console.log(JSON.stringify(r.raw, null, 2));
    }
    // Without this a scheme that answers nothing produces no output at all,
    // which is indistinguishable from the script having failed.
    console.log(`\n  found ${found_.length}: ${found_.join(', ') || 'none'}`);
    console.log(`  absent ${absent_.length}: ${absent_.join(', ') || 'none'}`);
    if (!found_.length) console.log(`  -> ${t.schemeId} returned no benefits for any category. Try --identify=${t.schemeId}`);
  }
})().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
