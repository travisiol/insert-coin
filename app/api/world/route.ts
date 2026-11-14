import { listCoins, recentEvents } from '@/lib/server/views';
import { zoneFor } from '@/lib/agent/events';
import { json } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Snapshot of the arcade: zone + state of every confirmed coin, plus the latest real events. */
export async function GET() {
  try {
    const [coins, events] = await Promise.all([listCoins(), recentEvents({ limit: 40 })]);
    return json(
      {
        coins: coins.map((c) => ({
          id: c.id, mint: c.mint, name: c.name, ticker: c.ticker, spec: c.spec, frames: c.frames, level: c.level,
          status: c.status, agentMode: c.agentMode, sleeping: c.sleeping, paused: c.paused, halted: c.halted,
          zone: zoneFor(c), mcap: c.mcap, change1h: c.change1h,
        })),
        events,
        lastEventId: events[0]?.id ?? 0,
      },
      200,
      { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=20' },
    );
  } catch (e) {
    return json({ coins: [], events: [], lastEventId: 0, error: e instanceof Error ? e.message : 'unavailable' }, 503);
  }
}
