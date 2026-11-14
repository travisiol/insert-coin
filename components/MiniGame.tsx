'use client';
import { useEffect, useRef, useState } from 'react';
import { renderFrame, SCREEN_PALETTE, hexToRgb } from '@/lib/engine/sprite';
import type { FighterSpec, CustomFrames } from '@/lib/engine/types';
import { GW, GH, GROUND, HERO_X, RUN_SECONDS, newGame, press, release, advance, score, type GameState } from '@/lib/game/runner';
import { play } from '@/lib/client/sound';

const PAL = Object.fromEntries(Object.entries(SCREEN_PALETTE).map(([k, v]) => [Number(k), hexToRgb(v)])) as Record<number, [number, number, number]>;

function frame(spec: FighterSpec, frames: CustomFrames | null | undefined, f: number, state: 'walk' | 'loss' | 'profit') {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(32, 32);
  const px = renderFrame({ spec, custom: frames }, state, f);
  for (let i = 0; i < 1024; i++) if (px[i]) { const [r, g, b] = PAL[px[i]]; img.data.set([r, g, b, 255], i * 4); }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export default function MiniGame({ spec, frames, ticker, url }: { spec: FighterSpec; frames?: CustomFrames | null; ticker: string; url: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const game = useRef<GameState | null>(null);
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready');
  const [final, setFinal] = useState(0);
  const [best, setBest] = useState(0);
  const [scale, setScale] = useState(2);
  const bestKey = `ic:best:${ticker}`;

  useEffect(() => {
    setBest(Number(localStorage.getItem(bestKey) ?? 0));
  }, [bestKey]);

  // integer scale to fit
  useEffect(() => {
    const fit = () => {
      const w = wrap.current?.clientWidth ?? GW * 2;
      setScale(Math.max(1, Math.min(3, Math.floor((w - 16) / GW))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const walk = [0, 1, 2, 3].map((f) => frame(spec, frames, f, 'walk'));
    const hurt = frame(spec, frames, 0, 'loss');
    const happy = frame(spec, frames, 0, 'profit');
    const headFam = getComputedStyle(document.documentElement).getPropertyValue('--font-head') || 'monospace';
    const acc = { v: 0 };
    let last = performance.now();
    let raf = 0;

    const draw = (s: GameState | null, t: number) => {
      g.fillStyle = '#2C4A34';
      g.fillRect(0, 0, GW, GH);
      const dist = s?.dist ?? (t / 1000) * 30;
      // parallax skyline
      g.fillStyle = '#3E6B48';
      for (let i = 0; i < 12; i++) {
        const bx = ((i * 48 - (dist * 0.3) % 48) + 576) % 576 - 48;
        const bh = 20 + ((i * 37) % 40);
        g.fillRect(Math.round(bx), GROUND - bh - 20, 32, bh);
      }
      // ground
      g.fillStyle = '#8DB580';
      g.fillRect(0, GROUND, GW, 2);
      g.fillStyle = '#3E6B48';
      for (let x = -((dist | 0) % 16); x < GW; x += 16) g.fillRect(x, GROUND + 6, 8, 2);
      if (s) {
        for (const o of s.course) {
          const sx = Math.round(o.x - s.dist);
          if (sx > GW) break;
          if (sx + o.w < 0 || o.taken) continue;
          if (o.kind === 'coin') {
            g.fillStyle = '#A87A00'; g.fillRect(sx, o.y, o.w, o.h);
            g.fillStyle = '#F2B705'; g.fillRect(sx + 1, o.y + 1, o.w - 3, o.h - 3);
            g.fillStyle = '#1B2B1F'; g.fillRect(sx + 4, o.y + 2, 1, 5);
          } else if (o.kind === 'rug') {
            g.fillStyle = '#B0306A'; g.fillRect(sx, o.y, o.w, o.h);
            g.fillStyle = '#D6E8C3'; for (let i = 2; i < o.w; i += 6) g.fillRect(sx + i, o.y + 1, 2, 2);
          } else {
            g.fillStyle = '#D6E8C3'; g.fillRect(sx, o.y, o.w, o.h);
            g.fillStyle = '#1B2B1F'; g.fillRect(sx + 2, o.y + 2, o.w - 4, o.h - 4);
            g.fillStyle = '#8DB580'; g.fillRect(sx + 4, o.y + 4, o.w - 8, 2);
          }
        }
        const img = s.over ? (s.won ? happy : hurt) : walk[Math.floor(s.t * 10) % 4];
        g.drawImage(img, HERO_X - 16, Math.round(s.y - 30), 32, 32);
        // HUD
        g.fillStyle = '#D6E8C3';
        g.font = `8px ${headFam}`;
        g.textBaseline = 'top';
        g.fillText(`SCORE ${score(s)}`, 8, 8);
        g.fillText(`TIME ${Math.max(0, Math.ceil(RUN_SECONDS - s.t))}`, GW - 72, 8);
      } else {
        g.drawImage(walk[Math.floor(t / 150) % 4], HERO_X - 16, GROUND - 30, 32, 32);
      }
    };

    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const s = game.current;
      if (s && !s.over) {
        const ev = advance(s, acc, dt);
        if (ev.coin) play('coin');
        if (ev.hit) play('hit');
        if (ev.end) {
          const sc = score(s);
          setFinal(sc);
          setPhase('over');
          setBest((b) => {
            const nb = Math.max(b, sc);
            localStorage.setItem(bestKey, String(nb));
            return nb;
          });
          if (s.won) play('levelup');
        }
      }
      draw(s, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spec, frames, bestKey]);

  const start = () => {
    game.current = newGame(ticker);
    setPhase('play');
  };
  const down = () => {
    if (phase === 'ready') { start(); return; }
    if (phase === 'over') return;
    if (game.current && press(game.current)) play('jump');
  };
  const up = () => { if (game.current) release(game.current); };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (!wrap.current || !isVisible(wrap.current)) return;
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        if (!e.repeat) down();
      }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') up(); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  });

  const share = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I scored ${final} playing $${ticker} on Insert Coin ${url}`)}`;

  return (
    <div ref={wrap} className="w-full flex flex-col items-center gap-4">
      <div className="relative screen crt-layer" style={{ width: GW * scale + 16, height: GH * scale + 16 }}>
        <canvas
          ref={cv}
          width={GW}
          height={GH}
          className="pixelated touch-none block"
          style={{ width: GW * scale, height: GH * scale }}
          onPointerDown={(e) => { e.preventDefault(); down(); }}
          onPointerUp={up}
          onPointerLeave={up}
          aria-label={`Mini-game starring $${ticker}`}
        />
        {phase !== 'play' && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 text-center p-4 pointer-events-none">
            {phase === 'ready' ? (
              <span className="font-head text-[10px] sm:text-[12px] text-coin blink leading-6">PRESS SPACE OR TAP TO JUMP</span>
            ) : (
              <div className="flex flex-col gap-4 items-center">
                <span className="font-head text-[12px] sm:text-[16px] text-paper">GAME OVER — SCORE {final}</span>
                <span className="font-head text-[8px] text-light">BEST {best}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {phase === 'over' && (
        <div className="flex gap-2 flex-wrap justify-center">
          <button className="btn btn-coin" onClick={start}>PLAY AGAIN</button>
          <a className="btn" href={share} target="_blank" rel="noreferrer">SHARE SCORE</a>
        </div>
      )}
      <span className="text-light text-[18px]">30-second run · same course for everyone · hold to jump higher · best {best}</span>
    </div>
  );
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}
