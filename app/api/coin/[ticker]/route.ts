import { coinByTicker, coinLedger, recentEvents, scorecard } from '@/lib/server/views';
import { pairsFor } from '@/lib/market';
import { json } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public coin data for the coin page refresh and the terminal. */
export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  try {
    const coin = await coinByTicker(params.ticker);
    if (!coin) return json({ error: 'not found' }, 404);
    const [ledger, events, score, pairs] = await Promise.all([
      coinLedger(coin.id, 10),
      recentEvents({ coinId: coin.id, limit: 20 }),
      scorecard(coin.id),
      pairsFor([coin.mint], 30),
    ]);
    const { inputText: _omit, ...pub } = coin;
    void _omit;
    return json({ coin: pub, ledger, events, score, pair: pairs[coin.mint] ?? null }, 200, { 'cache-control': 'public, s-maxage=15' });
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
