// Automated corporate onboarding sync.
//
// Pulls all active policies from Prognosis and compares them against
// CorporateSyncState to detect:
//   1. NEW groups (never seen before)          → send welcome email to HR
//   2. HR EMAIL CHANGES on existing groups     → send welcome to the new HR
//
// Designed to be called on a schedule (e.g. a Render Cron Job hitting this
// URL hourly). Protected by CRON_SECRET.
//
// Modes:
//   ?seed=1  → record all current groups as the baseline WITHOUT sending any
//              emails. Run this ONCE before enabling the schedule, otherwise
//              the first run treats every existing client as "new".
//   ?send=1  → actually send emails. Without it the endpoint runs in dry-run
//              mode and only reports what it WOULD do.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCorporateWelcome, getServiceToken } from '@/lib/corporate-welcome';

export const maxDuration = 300;

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

interface PolicyRow {
  groupId: string;
  companyName: string;
  policyNumber: string;
  adminEmail: string;
  contactName: string;
  phone: string;
  active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(p: Record<string, any>): PolicyRow {
  const termDate = p.Termdate ? new Date(p.Termdate) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return {
    groupId: String(p.GROUP_ID ?? p.GroupID ?? p.id ?? ''),
    companyName: String(p.GROUP_NAME ?? p.GroupName ?? p.CompanyName ?? ''),
    policyNumber: String(p.PolicyNumber ?? p.GROUP_CODE ?? ''),
    adminEmail: String(p.Company_Email1 ?? p.AdminEmail ?? p.ContactEmail ?? p.Email ?? '').trim().toLowerCase(),
    contactName: String(p.Contact_name ?? p.ContactName ?? ''),
    phone: String(p.Phone1 ?? p.Phone ?? p.Mobile ?? ''),
    active: !!termDate && termDate >= today,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? searchParams.get('secret') ?? '';
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seedMode = searchParams.get('seed') === '1';
  const sendMode = searchParams.get('send') === '1';

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/CorporateProfile/GetAllPolicies`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return NextResponse.json({ error: `GetAllPolicies HTTP ${res.status}` }, { status: 502 });

    const raw = await res.json().catch(() => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Record<string, any>[] =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.data) ? raw.data :
      Array.isArray(raw?.Data) ? raw.Data :
      Array.isArray(raw?.result) ? raw.result :
      Array.isArray(raw?.Result) ? raw.Result : [];

    // Latest row per group (one row per annual renewal)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestByGroup = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const key = String(row.GROUP_ID ?? row.GroupID ?? row.id ?? '');
      if (!key) continue;
      const existing = latestByGroup.get(key);
      if (!existing || new Date(row.Accepton ?? 0) > new Date(existing.Accepton ?? 0)) {
        latestByGroup.set(key, row);
      }
    }

    const policies = [...latestByGroup.values()].map(normalize).filter((p) => p.groupId && p.active);

    // Existing sync state, keyed by groupId
    const states = await prisma.corporateSyncState.findMany();
    const stateMap = new Map(states.map((s) => [s.groupId, s]));

    const results = {
      totalActiveGroups: policies.length,
      mode: seedMode ? 'seed' : sendMode ? 'send' : 'dry-run',
      newGroups: [] as { groupId: string; companyName: string; email: string; emailSent?: boolean; error?: string }[],
      emailChanges: [] as { groupId: string; companyName: string; oldEmail: string; newEmail: string; emailSent?: boolean; error?: string }[],
      skippedNoEmail: 0,
    };

    for (const p of policies) {
      const state = stateMap.get(p.groupId);

      // ── Seed mode: record baseline, never send ──
      if (seedMode) {
        await prisma.corporateSyncState.upsert({
          where: { groupId: p.groupId },
          update: { adminEmail: p.adminEmail || null, companyName: p.companyName, policyNumber: p.policyNumber, lastSyncedAt: new Date() },
          create: { groupId: p.groupId, adminEmail: p.adminEmail || null, companyName: p.companyName, policyNumber: p.policyNumber },
        });
        continue;
      }

      // ── New group ──
      if (!state) {
        if (!p.adminEmail) { results.skippedNoEmail++; continue; }
        const entry: (typeof results.newGroups)[number] = { groupId: p.groupId, companyName: p.companyName, email: p.adminEmail };
        if (sendMode) {
          const r = await sendCorporateWelcome({
            policyNumber: p.policyNumber, groupId: p.groupId, companyName: p.companyName,
            email: p.adminEmail, contactName: p.contactName, mobile: p.phone,
          });
          entry.emailSent = r.emailSent;
          if (r.error) entry.error = r.error;
          await prisma.corporateSyncState.create({
            data: {
              groupId: p.groupId, adminEmail: p.adminEmail, companyName: p.companyName,
              policyNumber: p.policyNumber, welcomeSentAt: r.emailSent ? new Date() : null,
            },
          });
        }
        results.newGroups.push(entry);
        continue;
      }

      // ── HR email change ──
      const prevEmail = (state.adminEmail ?? '').toLowerCase();
      if (p.adminEmail && prevEmail && p.adminEmail !== prevEmail) {
        const entry: (typeof results.emailChanges)[number] = {
          groupId: p.groupId, companyName: p.companyName, oldEmail: prevEmail, newEmail: p.adminEmail,
        };
        if (sendMode) {
          const r = await sendCorporateWelcome({
            policyNumber: p.policyNumber, groupId: p.groupId, companyName: p.companyName,
            email: p.adminEmail, contactName: p.contactName, mobile: p.phone,
          });
          entry.emailSent = r.emailSent;
          if (r.error) entry.error = r.error;
          await prisma.corporateSyncState.update({
            where: { groupId: p.groupId },
            data: {
              adminEmail: p.adminEmail, companyName: p.companyName, policyNumber: p.policyNumber,
              welcomeSentAt: r.emailSent ? new Date() : state.welcomeSentAt, lastSyncedAt: new Date(),
            },
          });
          // The old email's login account must stop working once the HR
          // contact changes — otherwise the previous person keeps access
          // indefinitely alongside the newly invited one.
          try {
            await prisma.user.updateMany({
              where: { email: prevEmail, companyId: p.groupId },
              data: { active: false },
            });
          } catch (e) {
            console.error(`[sync-corporates] Failed to deactivate old email ${prevEmail} for group ${p.groupId}:`, e);
          }
        }
        results.emailChanges.push(entry);
        continue;
      }

      // ── No change: touch lastSyncedAt (cheap keep-alive, only in send mode) ──
      if (sendMode) {
        await prisma.corporateSyncState.update({
          where: { groupId: p.groupId },
          data: { lastSyncedAt: new Date(), companyName: p.companyName, policyNumber: p.policyNumber },
        });
      }
    }

    if (seedMode) {
      return NextResponse.json({ seeded: policies.length, mode: 'seed', note: 'Baseline recorded. No emails sent. You can now schedule this endpoint with ?send=1.' });
    }

    console.log(`[sync-corporates] mode=${results.mode} new=${results.newGroups.length} emailChanges=${results.emailChanges.length}`);
    return NextResponse.json(results);
  } catch (err) {
    console.error('[sync-corporates] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 });
  }
}
