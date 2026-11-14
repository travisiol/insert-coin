import { globalStats, recentEvents } from '@/lib/server/views';
import { json } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [stats, events] = await Promise.all([globalStats(), recentEvents({ limit: 20 })]);
    return json({ ...stats, events }, 200, { 'cache-control': 'public, s-maxage=15' });
  } catch {
    return json({ fighters: 0, feesLamports: 0, burnedTokens: 0, events: [], error: 'unavailable' }, 503);
  }
}
