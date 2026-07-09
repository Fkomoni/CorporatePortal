// Processes ScheduledTermination rows whose effectiveDate has arrived and
// sends them to Prognosis's TerminateMember. Meant to run daily (or more
// often) via a Render Cron Job. Protected by CRON_SECRET, same pattern as
// /api/cron/sync-corporates.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callTerminateMember } from '@/lib/terminate-member';

export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? searchParams.get('secret') ?? '';
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const due = await prisma.scheduledTermination.findMany({
    where: { status: 'pending', effectiveDate: { lte: today } },
    orderBy: { effectiveDate: 'asc' },
  });

  const results: { id: string; cifNumber: string; success: boolean; error?: string }[] = [];

  for (const item of due) {
    const result = await callTerminateMember(item.cifNumber);
    await prisma.scheduledTermination.update({
      where: { id: item.id },
      data: {
        status: result.success ? 'completed' : 'failed',
        processedAt: new Date(),
        error: result.success ? null : (result.error ?? 'Unknown error'),
      },
    });
    results.push({ id: item.id, cifNumber: item.cifNumber, success: result.success, error: result.error });
  }

  console.log(`[process-terminations] due=${due.length} completed=${results.filter(r => r.success).length} failed=${results.filter(r => !r.success).length}`);

  return NextResponse.json({ processed: results.length, results });
}
