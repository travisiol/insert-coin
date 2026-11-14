import { launchConfigured } from '@/lib/server/secrets';
import { funderSpentToday, DAILY_FUNDER_BUDGET_LAMPORTS, LAUNCH_FUNDING_LAMPORTS } from '@/lib/server/launch';
import { json, siteOrigin, isPublicOrigin, LOCAL_LAUNCH_REASON } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Can a launch happen right now? Never reveals secret values, only whether they are set. */
export async function GET(req: Request) {
  if (!isPublicOrigin(siteOrigin(req))) return json({ canLaunch: false, reason: LOCAL_LAUNCH_REASON });
  const cfg = launchConfigured();
  if (!cfg.ok) return json({ canLaunch: false, reason: 'LAUNCHES ARE NOT CONFIGURED ON THIS SERVER YET.' });
  try {
    const spent = await funderSpentToday();
    if (spent + LAUNCH_FUNDING_LAMPORTS > DAILY_FUNDER_BUDGET_LAMPORTS) return json({ canLaunch: false, reason: 'LAUNCHES PAUSED UNTIL TOMORROW.' });
    return json({ canLaunch: true, reason: null });
  } catch {
    return json({ canLaunch: false, reason: 'DATABASE UNAVAILABLE.' });
  }
}
