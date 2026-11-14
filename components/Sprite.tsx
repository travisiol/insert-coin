'use client';
import { useEffect, useRef } from 'react';
import { renderFrame, FRAME_COUNT, FRAME_MS, SCREEN_PALETTE, hexToRgb } from '@/lib/engine/sprite';
import type { FighterSpec, FighterState, CustomFrames } from '@/lib/engine/types';
import { subscribeClock, useReducedMotion } from '@/lib/client/prefs';
import { cyrb53 } from '@/lib/engine/rng';

const PAL: Record<number, [number, number, number]> = Object.fromEntries(
  Object.entries(SCREEN_PALETTE).map(([k, v]) => [Number(k), hexToRgb(v)]),
);

export function paintPixels(ctx: CanvasRenderingContext2D, px: Uint8Array, bg?: string) {
  const img = ctx.createImageData(32, 32);
  const bgc = bg ? hexToRgb(bg) : null;
  for (let i = 0; i < 1024; i++) {
    const t = px[i];
    const o = i * 4;
    if (t) {
      const [r, g, b] = PAL[t];
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    } else if (bgc) {
      img.data[o] = bgc[0]; img.data[o + 1] = bgc[1]; img.data[o + 2] = bgc[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export interface SpriteProps {
  spec: FighterSpec;
  frames?: CustomFrames | null;
  state?: FighterState;
  level?: number;
  scale?: number; // integer
  animate?: boolean;
  bg?: string;
  className?: string;
  title?: string;
}

export default function Sprite({ spec, frames, state = 'idle', level = 0, scale = 4, animate = true, bg, className, title }: SpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const key = JSON.stringify(spec) + (frames ? cyrb53(JSON.stringify(frames)) : 0) + state + level + (bg ?? '');

  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    let last = -1;
    const draw = (t: number) => {
      const f = Math.floor(t / FRAME_MS[state]) % FRAME_COUNT[state];
      if (f === last) return;
      last = f;
      paintPixels(c, renderFrame({ spec, custom: frames, level }, state, f), bg);
    };
    draw(0);
    if (!animate || reduced) return;
    return subscribeClock(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, animate, reduced]);

  const s = Math.max(1, Math.round(scale));
  return (
    <canvas
      ref={ref}
      width={32}
      height={32}
      className={`pixelated ${className ?? ''}`}
      style={{ width: 32 * s, height: 32 * s }}
      role="img"
      aria-label={title ?? `${spec.archetype} fighter $${spec.ticker}`}
    />
  );
}
