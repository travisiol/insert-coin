import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { renderFrame, toRGBA } from '@/lib/engine/sprite';
import { encodePNG } from '@/lib/png';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 512x512 coin image: the fighter at x16, nearest-neighbor, on paper green. */
export async function GET(_req: Request, { params }: { params: { mint: string } }) {
  try {
    const db = await getDb();
    const [c] = await db
      .select({ spec: schema.coins.spriteJson, frames: schema.coins.framesJson })
      .from(schema.coins)
      .where(eq(schema.coins.mint, params.mint.replace(/\.png$/, '')));
    if (!c) return new Response('not found', { status: 404 });
    const px = renderFrame({ spec: c.spec, custom: c.frames }, 'idle', 0);
    const png = encodePNG(toRGBA(px, 16, '#D6E8C3'), 512, 512);
    return new Response(new Uint8Array(png), {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=604800', 'access-control-allow-origin': '*' },
    });
  } catch {
    return new Response('unavailable', { status: 503 });
  }
}
