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
// --discover finds which category suffixes exist for a scheme by asking
// GetSchemeBenefits what its benefits are called and probing those names, rather
// than guessing:
//
//   node scripts/probe-benefits.mjs 204166 --discover
//
// The remaining flags are only for turning an alphanumeric scheme code such as
// AFRICMAX into its numeric PlanID, which does need to know the group:
//
//   node scripts/probe-benefits.mjs --group=1001               # list its schemes
//   node scripts/probe-benefits.mjs --code=AFRICMAX --group=1001

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '').replace(/\/$/, '');

// Confirmed by probing: these two answer. Dental was the endpoint supplied;
// Surgery was found by trial. The rest of the original guess list was wrong, so
// guessing is not how the remaining suffixes should be found. Use --discover,
// which derives candidates from the benefit and department names the scheme
// itself reports through GetSchemeBenefits.
const CATEGORIES = ['Dental', 'Surgery'];

// Tried by --discover in addition to whatever it derives. Kept separate from
// CATEGORIES so a default run never probes a name nobody has confirmed.
const GUESSES = [
  'Optical', 'Maternity', 'InPatient', 'OutPatient', 'Inpatient', 'Outpatient',
  'Diagnostics', 'Pharmacy', 'Drugs', 'Wellness', 'Immunisation', 'Immunization',
  'Physiotherapy', 'Psychiatry', 'Oncology', 'Dialysis', 'Evacuation',
  'Consultation', 'Laboratory', 'Radiology', 'Antenatal', 'Delivery',
  'Accident', 'Emergency', 'Admission', 'Ward', 'Specialist', 'Medical',
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
const discover = args.includes('--discover');
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

async function schemeBenefits(token, schemeId) {
  const url = `${BASE}/api/CorporatePortal/GetSchemeBenefits?schemeId=${encodeURIComponent(schemeId)}&languageId=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const text = await res.text();
  let raw = null;
  try { raw = JSON.parse(text); } catch { /* empty list below */ }
  return { status: res.status, rows: listOf(raw) };
}

/**
 * Candidate suffixes derived from the scheme's own benefit and department names,
 * rather than invented. GetSchemeBenefits is the endpoint the Benefits page
 * already uses, so this asks the same source what the categories are called.
 */
function candidatesFrom(rows) {
  const out = new Set();
  const add = (v) => {
    const t = String(v ?? '').trim();
    if (!t || t.toLowerCase() === 'null') return;
    // "Major Disease Benefit" -> MajorDiseaseBenefit, and the first word alone,
    // since the two confirmed suffixes are single words.
    const words = t.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return;
    out.add(words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''));
    out.add(words[0][0].toUpperCase() + words[0].slice(1).toLowerCase());
  };
  for (const r of rows) {
    add(r.Benefit); add(r.benefit);
    add(r.BenefitGroup); add(r.Category); add(r.Department); add(r.DeptName);
  }
  return [...out];
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

  if (discover) {
    if (!ids.length) { console.log('--discover needs at least one scheme ID.'); return; }
    for (const id of ids) {
      console.log(`\n${'='.repeat(72)}\ndiscovering suffixes for schemeId ${id}\n${'='.repeat(72)}`);
      const sb = await schemeBenefits(token, id);
      const derived = candidatesFrom(sb.rows);
      console.log(`  GetSchemeBenefits: HTTP ${sb.status}, ${sb.rows.length} rows`);
      console.log(`  names it reports:  ${[...new Set(sb.rows.map((r) => r.Benefit).filter(Boolean))].join(', ') || '(none)'}`);
      console.log(`  derived candidates: ${derived.join(', ') || '(none)'}`);
      const tryList = [...new Set([...CATEGORIES, ...derived, ...GUESSES])];
      console.log(`  probing ${tryList.length} suffixes...\n`);
      const hits = [];
      for (const c of tryList) {
        const r = await probe(token, id, c);
        if (r.status === 200 && r.rows.length > 0) {
          hits.push(c);
          console.log(`    ${c.padEnd(22)} ${r.rows.length} rows  benefits: ${[...new Set(r.rows.map((x) => x.Benefit).filter(Boolean))].join(', ')}`);
        }
      }
      console.log(`\n  suffixes that answer: ${hits.join(', ') || 'none'}`);
      const missed = derived.filter((d) => !hits.includes(d));
      if (missed.length) console.log(`  reported as benefits but not as endpoints: ${missed.join(', ')}`);
    }
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
      console.log(`\n  ${category}  (${r.rows.length} rows, ${r.ms}ms)`);

      // Group by benefit first, then by member type within it. Grouping by
      // member type alone collapsed a scheme whose rows all carry a null
      // MemberType into one line reading "limit=400,000 | 0", which says two
      // limits exist for two benefits without saying which is which. The
      // benefit is the thing a limit belongs to; the member type only
      // subdivides it, and on many schemes it is absent entirely.
      for (const benefit of benefits.length ? benefits : ['(no benefit name)']) {
        const forBenefit = r.rows.filter((x) => (x.Benefit || '(no benefit name)') === benefit);
        console.log(`      ${benefit}`);
        const types = [...new Set(forBenefit.map((x) => x.MemberType ?? null))]
          .sort((a, b) => String(a).localeCompare(String(b)));
        for (const mt of types) {
          const rowsFor = forBenefit.filter((x) => (x.MemberType ?? null) === mt);
          const fmt = (v) => (v === '' || v == null ? '(blank)' : String(v));
          const limits = [...new Set(rowsFor.map((x) => fmt(x.Limit)))].join(' | ');
          const used = [...new Set(rowsFor.map((x) => fmt(x.Used)))].join(' | ');
          const depts = [...new Set(rowsFor.map((x) => x.DeptCode ?? ''))].filter(Boolean).join(',');
          const visits = [...new Set(rowsFor.map((x) => x.VisitsLimit ?? 0))].filter((v) => v).join(',');
          const wait = [...new Set(rowsFor.map((x) => x.WaitingPeriod ?? 0))].filter((v) => v).join(',');
          const excl = rowsFor.some((x) => x.IsExcluded) ? '  EXCLUDED' : '';
          // "no member type" is a fact about the scheme, not a missing value.
          const label = mt == null ? 'all members' : mt;
          console.log(
            `        ${String(label).padEnd(12)} limit=${limits.padEnd(12)} used=${used.padEnd(8)}` +
            ` dept=${depts || '-'}` +
            (visits ? ` visits=${visits}` : '') +
            (wait ? ` wait=${wait}d` : '') +
            (mt == null ? '' : ` typeId=${rowsFor[0]?.MemberTypeId ?? '-'} principal=${rowsFor[0]?.IsPrincipal ?? '-'}`) +
            excl,
          );
        }
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
