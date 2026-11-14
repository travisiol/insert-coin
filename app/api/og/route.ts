import { coinByTicker } from '@/lib/server/views';
import { renderFrame, SCREEN_PALETTE, hexToRgb } from '@/lib/engine/sprite';
import { buildCoin } from '@/lib/engine/build';
import { glyph } from '@/lib/engine/font';
import { encodePNG } from '@/lib/png';
import { LEVELS } from '@/lib/agent/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const W = 1200;
const H = 630;

/** Pixel-art OG card drawn directly into an RGBA buffer: fighter x8 + name + $TICKER + level, on paper green. */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('t');
  let name = 'INSERT COIN';
  let ticker = '';
  let level = -1;
  let px = renderFrame({ spec: buildCoin('insert coin', 0).candidates[0] }, 'idle', 0);
  if (t) {
    try {
      const c = await coinByTicker(t);
      if (c) {
        name = c.name;
        ticker = c.ticker;
        level = c.level;
        px = renderFrame({ spec: c.spec, custom: c.frames, level: c.level }, 'idle', 0);
      }
    } catch {
      /* default card */
    }
  }

  const buf = new Uint8Array(W * H * 4);
  const rect = (x: number, y: number, w: number, h: number, hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        const o = (yy * W + xx) * 4;
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
      }
    }
  };
  const text = (s: string, x: number, y: number, scale: number, hex: string) => {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const gl = glyph(ch);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (gl[r * 3 + c] === '1') rect(cx + c * scale, y + r * scale, scale, scale, hex);
      cx += 4 * scale;
    }
  };

  rect(0, 0, W, H, '#1B2B1F');
  rect(24, 24, W - 48, H - 48, '#D6E8C3');
  // fighter at x10 on an ink tile
  rect(64, 147, 336, 336, '#1B2B1F');
  for (let i = 0; i < 1024; i++) if (px[i]) rect(72 + (i % 32) * 10, 155 + Math.floor(i / 32) * 10, 10, 10, SCREEN_PALETTE[px[i]]);

  const x0 = 448;
  const maxChars = Math.floor((W - x0 - 64) / 28);
  const words = name.toUpperCase().split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= maxChars) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w.slice(0, maxChars));
  }
  let y = 150;
  for (const l of lines.slice(0, 3)) {
    text(l, x0, y, 7, '#1B2B1F');
    y += 56;
  }
  if (ticker) {
    text(`$${ticker}`, x0, y + 16, 8, '#3E6B48');
    y += 72;
  } else {
    text('DROP A POST. GET A FIGHTER.', x0, y + 16, 4, '#3E6B48');
    y += 48;
  }
  if (level >= 0) {
    const label = `LVL ${level} ${LEVELS[level]}`;
    const w = label.length * 20 + 28;
    rect(x0, y + 24, w + 8, 56, '#1B2B1F');
    rect(x0 + 4, y + 28, w, 48, '#F2B705');
    text(label, x0 + 18, y + 40, 5, '#1B2B1F');
  }
  text('INSERT COIN', W - 64 - 11 * 16, H - 80, 4, '#3E6B48');

  const png = encodePNG(buf, W, H);
  return new Response(new Uint8Array(png), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=600, s-maxage=3600' },
  });
}
