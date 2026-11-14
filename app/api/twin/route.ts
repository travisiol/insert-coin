import { twinCheck } from '@/lib/market';
import { cleanTicker, json } from '@/lib/server/guard';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const t = cleanTicker(new URL(req.url).searchParams.get('t'));
  if (!t) return json({ error: 'bad ticker' }, 400);
  const r = await twinCheck(t);
  if (!r) return json({ error: 'CHECK UNAVAILABLE' }, 502);
  return json(r, 200, { 'cache-control': 'public, s-maxage=300' });
}
