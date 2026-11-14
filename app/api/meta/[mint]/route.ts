import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { siteOrigin, json } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Token metadata JSON (the coin's `uri`). Served by us, keyless, built from the stored coin row. */
export async function GET(req: Request, { params }: { params: { mint: string } }) {
  try {
    const db = await getDb();
    const [c] = await db
      .select({ name: schema.coins.name, ticker: schema.coins.ticker, story: schema.coins.story, mint: schema.coins.mint })
      .from(schema.coins)
      .where(eq(schema.coins.mint, params.mint));
    if (!c) return json({ error: 'not found' }, 404);
    const origin = siteOrigin(req);
    return json(
      {
        name: c.name,
        symbol: c.ticker,
        description: `${c.story}\n\nMade with Insert Coin`,
        image: `${origin}/api/img/${c.mint}`,
        showName: true,
        createdOn: origin,
        website: `${origin}/c/${c.ticker}`,
      },
      200,
      { 'cache-control': 'public, max-age=300, s-maxage=86400', 'access-control-allow-origin': '*' },
    );
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}
