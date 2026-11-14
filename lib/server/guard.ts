/** Rate limits, input validation and request helpers for API routes. */
import { q, sql } from '../db';
import { ARCHETYPES, ACCESSORIES, LEGS, EYE_COUNT, MOUTH_COUNT, DRAWABLE_STATES, type FighterSpec, type CustomFrames } from '../engine/types';

export async function hit(key: string, windowMs: number): Promise<number> {
  const start = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await q<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, ${start.toISOString()}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`);
  return Number(rows[0]?.count ?? 1);
}

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim();
}

export function siteOrigin(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** pump.fun reads the coin metadata from our URL at creation time, so it must be publicly reachable. */
export function isPublicOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname;
    return !(h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '[::1]' || h.startsWith('192.168.') || h.startsWith('10.'));
  } catch {
    return false;
  }
}

export const LOCAL_LAUNCH_REASON = 'LAUNCHES ONLY RUN ON THE PUBLIC SITE. PUMP.FUN MUST BE ABLE TO READ THE COIN IMAGE.';

export function cleanTicker(t: unknown): string | null {
  if (typeof t !== 'string') return null;
  const s = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 3 && s.length <= 8 ? s : null;
}

export function cleanText(t: unknown, max: number): string | null {
  if (typeof t !== 'string') return null;
  const s = t.replace(/[\u0000-\u001f]/g, ' ').trim();
  return s.length > 0 && s.length <= max ? s : null;
}

export function validSpec(s: unknown, ticker: string): FighterSpec | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  if (!ARCHETYPES.includes(o.archetype as never)) return null;
  if (!ACCESSORIES.includes(o.accessory as never)) return null;
  if (!LEGS.includes(o.legs as never)) return null;
  const eyes = Number(o.eyes);
  const mouth = Number(o.mouth);
  if (!Number.isInteger(eyes) || eyes < 0 || eyes >= EYE_COUNT) return null;
  if (!Number.isInteger(mouth) || mouth < 0 || mouth >= MOUTH_COUNT) return null;
  return { archetype: o.archetype as FighterSpec['archetype'], accessory: o.accessory as FighterSpec['accessory'], legs: o.legs as FighterSpec['legs'], eyes, mouth, ticker };
}

export function validFrames(f: unknown): CustomFrames | null {
  if (!f || typeof f !== 'object') return null;
  const out: CustomFrames = {};
  let any = false;
  for (const st of DRAWABLE_STATES) {
    const list = (f as Record<string, unknown>)[st];
    if (!Array.isArray(list)) continue;
    const frames = list.slice(0, 4).filter((x): x is string => typeof x === 'string' && /^[0-6]{1024}$/.test(x));
    if (frames.length) {
      out[st] = frames;
      any = true;
    }
  }
  return any && out.idle ? out : null;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}
