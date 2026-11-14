'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { renderFrame, FRAME_COUNT, FRAME_MS, SCREEN_PALETTE, hexToRgb } from '@/lib/engine/sprite';
import type { FighterSpec, FighterState, CustomFrames } from '@/lib/engine/types';
import { ZONES, eventText, eventAnim, feedLine, type Zone, LEVELS } from '@/lib/agent/events';
import { mulberry32 } from '@/lib/engine/rng';
import type { FeedEvent } from '@/lib/server/views';
import { useEventStream } from './LiveFeed';
import { useReducedMotion } from '@/lib/client/prefs';
import { fmtUsd, fmtPct } from '@/lib/market';
import { PixelBar, Empty, ErrorBox } from './ui';
import { play } from '@/lib/client/sound';

const TILE = 16;
const MAP_W = 96;
const MAP_H = 64;

export interface WorldCoin {
  id: number; mint: string; name: string; ticker: string; spec: FighterSpec; frames: CustomFrames | null; level: number;
  status: string; agentMode: string; sleeping: boolean; paused: boolean; halted: boolean; zone: Zone; mcap: number | null; change1h: number | null;
}
interface World { coins: WorldCoin[]; events: FeedEvent[]; lastEventId: number; error?: string }

interface Entity {
  coin: WorldCoin;
  x: number; y: number; tx: number; ty: number; dir: number;
  anim: FighterState | null; animUntil: number;
  bubble: string | null; bubbleUntil: number;
}

const PAL = Object.fromEntries(Object.entries(SCREEN_PALETTE).map(([k, v]) => [Number(k), hexToRgb(v)])) as Record<number, [number, number, number]>;
const frameCache = new Map<string, HTMLCanvasElement>();
function frameCanvas(c: WorldCoin, state: FighterState, f: number): HTMLCanvasElement {
  const key = `${c.id}:${c.level}:${state}:${f}`;
  let cv = frameCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(32, 32);
  const px = renderFrame({ spec: c.spec, custom: c.frames, level: c.level }, state, f);
  for (let i = 0; i < 1024; i++) if (px[i]) { const [r, g, b] = PAL[px[i]]; img.data.set([r, g, b, 255], i * 4); }
  ctx.putImageData(img, 0, 0);
  frameCache.set(key, cv);
  return cv;
}

function headFont(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-head') || 'monospace';
}
function bodyFont(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-body') || 'monospace';
}

/** Pre-render the tile map once. */
function buildMap(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * TILE; cv.height = MAP_H * TILE;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const rng = mulberry32(42);
  // floor
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    g.fillStyle = (x + y) % 2 ? '#2C4A34' : '#294530';
    g.fillRect(x * TILE, y * TILE, TILE, TILE);
    if (rng() < 0.04) { g.fillStyle = '#3E6B48'; g.fillRect(x * TILE + 6, y * TILE + 6, 2, 2); }
  }
  const patterns: Record<Zone, (x: number, y: number) => void> = {
    hall: (x, y) => { g.fillStyle = (x + y) % 2 ? '#3E6B48' : '#2E5038'; g.fillRect(x, y, TILE, TILE); if ((x / TILE + y / TILE) % 6 === 0) { g.fillStyle = '#F2B705'; g.fillRect(x + 7, y + 7, 2, 2); } },
    furnace: (x, y) => { g.fillStyle = '#2B1E22'; g.fillRect(x, y, TILE, TILE); g.fillStyle = (x / TILE + y / TILE) % 3 === 0 ? '#B0306A' : '#3A2228'; g.fillRect(x + 2, y + 12, 12, 2); },
    launch: (x, y) => { g.fillStyle = '#25392A'; g.fillRect(x, y, TILE, TILE); g.fillStyle = '#8DB580'; if ((x / TILE) % 4 === 0) g.fillRect(x, y + 7, TILE, 2); },
    trading: (x, y) => { g.fillStyle = '#294530'; g.fillRect(x, y, TILE, TILE); g.fillStyle = '#3E6B48'; g.fillRect(x, y, TILE, 1); g.fillRect(x, y, 1, TILE); },
    lobby: (x, y) => { g.fillStyle = ((x + y) / TILE) % 2 ? '#3E6B48' : '#35603F'; g.fillRect(x, y, TILE, TILE); },
    gameover: (x, y) => { g.fillStyle = '#141414'; g.fillRect(x, y, TILE, TILE); g.fillStyle = '#2B2B2B'; g.fillRect(x + 4, y + 4, 8, 8); },
  };
  for (const [key, z] of Object.entries(ZONES) as [Zone, (typeof ZONES)[Zone]][]) {
    for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) patterns[key](x * TILE, y * TILE);
    // walls
    g.fillStyle = '#8DB580';
    g.fillRect(z.x * TILE, z.y * TILE, z.w * TILE, 4);
    g.fillRect(z.x * TILE, (z.y + z.h) * TILE - 4, z.w * TILE, 4);
    g.fillRect(z.x * TILE, z.y * TILE, 4, z.h * TILE);
    g.fillRect((z.x + z.w) * TILE - 4, z.y * TILE, 4, z.h * TILE);
    // sign
    g.font = `16px ${headFont()}`;
    const w = g.measureText(z.label).width + 24;
    const sx = (z.x + z.w / 2) * TILE - w / 2;
    const sy = z.y * TILE - 12;
    g.fillStyle = '#1B2B1F'; g.fillRect(sx - 4, sy - 4, w + 8, 36);
    g.fillStyle = key === 'furnace' ? '#B0306A' : key === 'hall' ? '#F2B705' : '#D6E8C3'; g.fillRect(sx, sy, w, 28);
    g.fillStyle = '#1B2B1F'; g.textBaseline = 'middle'; g.fillText(z.label, sx + 12, sy + 15);
  }
  return cv;
}

function randomPointIn(z: Zone, rng: () => number): [number, number] {
  const r = ZONES[z];
  return [(r.x + 2 + rng() * (r.w - 5)) * TILE, (r.y + 3 + rng() * (r.h - 6)) * TILE];
}

export default function Arcade({ mini = false, focus }: { mini?: boolean; focus?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [world, setWorld] = useState<World | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorldCoin | null>(null);
  const [ticker, setTicker] = useState<FeedEvent[]>([]);
  const ents = useRef<Map<number, Entity>>(new Map());
  const cam = useRef({ x: 0, y: 0, zoom: mini ? 1 : 2 });
  const map = useRef<HTMLCanvasElement | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch('/api/world');
      const j = (await r.json()) as World;
      if (!r.ok && j.error) throw new Error(j.error);
      setWorld(j);
      setTicker((cur) => (cur.length ? cur : j.events.slice(0, 20)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The arcade is unreachable.');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // sync entities with world snapshot
  useEffect(() => {
    if (!world) return;
    const m = ents.current;
    const seen = new Set<number>();
    for (const c of world.coins) {
      seen.add(c.id);
      const e = m.get(c.id);
      if (!e) {
        const rng = mulberry32(c.id * 7919);
        const [x, y] = randomPointIn(c.zone, rng);
        m.set(c.id, { coin: c, x, y, tx: x, ty: y, dir: 1, anim: null, animUntil: 0, bubble: null, bubbleUntil: 0 });
      } else {
        if (e.coin.zone !== c.zone) { const [tx, ty] = randomPointIn(c.zone, Math.random); e.tx = tx; e.ty = ty; }
        e.coin = c;
      }
    }
    for (const id of Array.from(m.keys())) if (!seen.has(id)) m.delete(id);
    if (focus) {
      const f = Array.from(m.values()).find((e) => e.coin.ticker.toUpperCase() === focus.toUpperCase());
      if (f && wrap.current) {
        const z = cam.current.zoom;
        cam.current.x = f.x * z - wrap.current.clientWidth / 2;
        cam.current.y = f.y * z - wrap.current.clientHeight / 2;
        setSelected(f.coin);
      }
    }
  }, [world, focus]);

  // live events -> animation + bubble quoting the event
  useEventStream(
    (ev) => {
      setTicker((cur) => [ev, ...cur].slice(0, 30));
      const e = ents.current.get(ev.coinId);
      if (!e) return;
      e.anim = eventAnim(ev.type);
      e.animUntil = performance.now() + 4000;
      e.bubble = eventText(ev.type, ev.payload, ev.ticker);
      e.bubbleUntil = performance.now() + 6000;
      if (ev.type === 'burn') play('burn');
      if (ev.type === 'level_up') play('levelup');
    },
    { after: world?.lastEventId ?? 0 },
  );

  // initial bubbles from the latest recorded events (one per coin, last 10 min)
  useEffect(() => {
    if (!world) return;
    const now = performance.now();
    for (const ev of world.events.slice().reverse()) {
      if (Date.now() - new Date(ev.ts).getTime() > 600_000) continue;
      const e = ents.current.get(ev.coinId);
      if (e) { e.bubble = eventText(ev.type, ev.payload, ev.ticker); e.bubbleUntil = now + 6000; }
    }
  }, [world]);

  // render loop
  useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box || !world) return;
    if (!map.current) map.current = buildMap();
    const g = cv.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(100, t - last);
      last = t;
      const W = box.clientWidth;
      const H = box.clientHeight;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const { zoom } = cam.current;
      const maxX = Math.max(0, MAP_W * TILE * zoom - W);
      const maxY = Math.max(0, MAP_H * TILE * zoom - H);
      cam.current.x = Math.max(0, Math.min(maxX, cam.current.x));
      cam.current.y = Math.max(0, Math.min(maxY, cam.current.y));
      const ox = Math.round(-cam.current.x);
      const oy = Math.round(-cam.current.y);
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#141414';
      g.fillRect(0, 0, W, H);
      g.drawImage(map.current!, ox, oy, MAP_W * TILE * zoom, MAP_H * TILE * zoom);
      const list = Array.from(ents.current.values()).sort((a, b) => a.y - b.y);
      for (const e of list) {
        const c = e.coin;
        let state: FighterState = c.sleeping ? 'sleep' : 'idle';
        const animating = e.anim && t < e.animUntil;
        if (animating) state = e.anim!;
        else if (!c.sleeping && !reduced) {
          const dx = e.tx - e.x;
          const dy = e.ty - e.y;
          const d = Math.hypot(dx, dy);
          if (d < 2) {
            if (Math.random() < 0.004) { const [tx, ty] = randomPointIn(c.zone, Math.random); e.tx = tx; e.ty = ty; }
          } else {
            const sp = 0.02 * dt;
            e.x += (dx / d) * Math.min(sp, d);
            e.y += (dy / d) * Math.min(sp, d);
            e.dir = dx < 0 ? -1 : 1;
            state = 'walk';
          }
        }
        const f = Math.floor(t / FRAME_MS[state]) % FRAME_COUNT[state];
        const img = frameCanvas(c, state, reduced ? 0 : f);
        const sx = Math.round(ox + (e.x - 16) * zoom);
        const sy = Math.round(oy + (e.y - 32) * zoom);
        g.save();
        if (e.dir < 0) { g.translate(sx + 32 * zoom, sy); g.scale(-1, 1); g.drawImage(img, 0, 0, 32 * zoom, 32 * zoom); }
        else g.drawImage(img, sx, sy, 32 * zoom, 32 * zoom);
        g.restore();
        if (selected?.id === c.id) { g.strokeStyle = '#F2B705'; g.lineWidth = 2; g.strokeRect(sx - 2, sy - 2, 32 * zoom + 4, 32 * zoom + 4); }
        // nameplate
        g.font = `${8 * Math.max(1, zoom / 2)}px ${headFont()}`;
        g.textBaseline = 'top';
        const label = `$${c.ticker}`;
        const lw = g.measureText(label).width;
        g.fillStyle = '#1B2B1F';
        g.fillRect(sx + 16 * zoom - lw / 2 - 2, sy + 32 * zoom + 2, lw + 4, 10 * Math.max(1, zoom / 2));
        g.fillStyle = '#D6E8C3';
        g.fillText(label, sx + 16 * zoom - lw / 2, sy + 32 * zoom + 3);
        // bubble quoting a real event
        if (e.bubble && t < e.bubbleUntil) {
          g.font = `${16 * Math.max(1, zoom / 2)}px ${bodyFont()}`;
          const bw = g.measureText(e.bubble).width + 12;
          const bh = 18 * Math.max(1, zoom / 2);
          const bx = sx + 16 * zoom - bw / 2;
          const by = sy - bh - 8;
          g.fillStyle = '#1B2B1F'; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
          g.fillStyle = '#D6E8C3'; g.fillRect(bx, by, bw, bh);
          g.fillRect(sx + 16 * zoom - 3, by + bh, 6, 4);
          g.fillStyle = '#1B2B1F'; g.fillText(e.bubble, bx + 6, by + 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, reduced, selected]);

  // pan / zoom / click
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false }; cv.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      cam.current.x = drag.cx - dx; cam.current.y = drag.cy - dy;
    };
    const up = (e: PointerEvent) => {
      if (drag && !drag.moved) {
        const r = cv.getBoundingClientRect();
        const z = cam.current.zoom;
        const wx = (e.clientX - r.left + cam.current.x) / z;
        const wy = (e.clientY - r.top + cam.current.y) / z;
        const hit = Array.from(ents.current.values()).find((en) => wx >= en.x - 16 && wx <= en.x + 16 && wy >= en.y - 32 && wy <= en.y + 4);
        setSelected(hit ? hit.coin : null);
      }
      drag = null;
    };
    const zoomAt = (delta: number, px: number, py: number) => {
      const z0 = cam.current.zoom;
      const z1 = Math.max(1, Math.min(4, z0 + delta));
      if (z1 === z0) return;
      cam.current.x = ((cam.current.x + px) / z0) * z1 - px;
      cam.current.y = ((cam.current.y + py) / z0) * z1 - py;
      cam.current.zoom = z1;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    };
    // pinch
    const touches = new Map<number, { x: number; y: number }>();
    let pinch0 = 0;
    const tstart = (e: TouchEvent) => { for (const t of Array.from(e.touches)) touches.set(t.identifier, { x: t.clientX, y: t.clientY }); if (e.touches.length === 2) pinch0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
    const tmove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch0) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const r = cv.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      if (d / pinch0 > 1.4) { zoomAt(1, cx, cy); pinch0 = d; }
      else if (d / pinch0 < 0.7) { zoomAt(-1, cx, cy); pinch0 = d; }
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.addEventListener('touchstart', tstart, { passive: true });
    cv.addEventListener('touchmove', tmove, { passive: true });
    return () => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('wheel', wheel);
      cv.removeEventListener('touchstart', tstart);
      cv.removeEventListener('touchmove', tmove);
    };
  }, [world]);

  // center the map on first load
  useEffect(() => {
    if (!world || !wrap.current || focus) return;
    const z = cam.current.zoom;
    cam.current.x = (MAP_W * TILE * z - wrap.current.clientWidth) / 2;
    cam.current.y = (MAP_H * TILE * z - wrap.current.clientHeight) / 2;
  }, [world, focus]);

  return (
    <div className={`relative ${mini ? 'h-[360px]' : 'h-[calc(100vh-64px)]'} screen crt-layer`} style={{ borderWidth: mini ? 8 : 0 }}>
      <div ref={wrap} className="absolute inset-0">
        <canvas ref={canvas} className="pixelated w-full h-full touch-none block" aria-label="Shared pixel arcade with every fighter" />
      </div>
      {!world && !err && <div className="absolute inset-0 grid place-items-center"><PixelBar /></div>}
      {err && <div className="absolute inset-0 grid place-items-center bg-ink"><ErrorBox reason={err} onRetry={load} /></div>}
      {world && !world.coins.length && !err && (
        <div className="absolute inset-0 grid place-items-center bg-ink/80">
          <Empty text="THE ARCADE IS WARMING UP. LAUNCH THE FIRST FIGHTER.">
            <Link href="/launch" className="btn btn-coin">LAUNCH</Link>
          </Empty>
        </div>
      )}
      {!mini && (
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button className="btn btn-sm" onClick={() => { cam.current.zoom = Math.min(4, cam.current.zoom + 1); }} aria-label="Zoom in">+</button>
          <button className="btn btn-sm" onClick={() => { cam.current.zoom = Math.max(1, cam.current.zoom - 1); }} aria-label="Zoom out">-</button>
        </div>
      )}
      {mini && (
        <Link href="/arcade" className="absolute top-4 right-4 z-10 btn btn-sm">ENTER FULL ARCADE</Link>
      )}
      {selected && (
        <aside className="absolute z-10 left-4 top-4 card p-4 w-[260px] flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-head text-[10px] leading-5">{selected.name}</div>
              <div className="font-head text-[8px] text-dark">${selected.ticker} · LVL {selected.level} {LEVELS[selected.level]}</div>
            </div>
            <button className="font-head text-[10px]" onClick={() => setSelected(null)} aria-label="Close">X</button>
          </div>
          <div className="text-[18px]">Mcap {fmtUsd(selected.mcap)} · 1h <span className={(selected.change1h ?? 0) >= 0 ? 'text-dark' : 'text-btn'}>{fmtPct(selected.change1h)}</span></div>
          <div className="text-[18px]">Zone: {ZONES[selected.zone].label}</div>
          <div className="flex gap-2 flex-wrap">
            <Link className="btn btn-sm" href={`/c/${selected.ticker}`}>OPEN</Link>
            <Link className="btn btn-sm" href={`/t/${selected.ticker}`}>TERMINAL</Link>
            <Link className="btn btn-sm btn-coin" href={`/c/${selected.ticker}#play`}>PLAY</Link>
          </div>
        </aside>
      )}
      {!mini && ticker.length > 0 && (
        <div className="absolute bottom-0 inset-x-0 bg-ink border-t-4 border-dark overflow-hidden z-10 h-10 flex items-center">
          <div className="marquee whitespace-nowrap flex gap-12 text-[20px]">
            {[...ticker, ...ticker].map((ev, i) => (
              <span key={i} className={ev.type === 'loss' ? 'text-btn' : ev.type === 'burn' || ev.type === 'bonded' ? 'text-coin' : 'text-light'}>
                {feedLine(ev.type, ev.payload, ev.ticker)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
