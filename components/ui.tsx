'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Sprite from './Sprite';
import { buildCoin } from '@/lib/engine/build';
import { crtPref, soundPref, useToggle, useReducedMotion } from '@/lib/client/prefs';
import { play } from '@/lib/client/sound';

/** 16x16 pixel coin with a vertical slot and a 1 px highlight. */
export function Logo({ size = 32 }: { size?: number }) {
  const rows = [
    '.....######.....',
    '...##cccccc##...',
    '..#cpcccccccc#..',
    '.#cpcccccccccc#.',
    '.#ccccccc#cccc#.',
    '#cccccccc#ccccc#',
    '#cccccccc#ccccc#',
    '#cccccccc#ccccc#',
    '#cccccccc#ccccc#',
    '#cccccccc#ccccc#',
    '#cccccccc#ccccc#',
    '.#ccccccc#cccc#.',
    '.#cccccccccccd#.',
    '..#ccccccccdd#..',
    '...##ddddddd#...',
    '.....######.....',
  ];
  const fill: Record<string, string> = { '#': '#1B2B1F', c: '#F2B705', p: '#FFF3B0', d: '#A87A00' };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => r.split('').map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill[ch]} />)))}
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 select-none" aria-label="Insert Coin home">
      <Logo size={32} />
      <span className="font-head text-[12px] text-coin hidden sm:inline">INSERT COIN</span>
    </Link>
  );
}

const NAV = [
  ['/', 'HOME'], ['/agents', 'AGENTS'], ['/arcade', 'ARCADE'], ['/terminals', 'TERMINALS'], ['/studio', 'STUDIO'], ['/how', 'HOW IT WORKS'],
] as const;

export function Header() {
  const [sound, setSound] = useToggle(soundPref);
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-page/95 border-b-4 border-ink">
      <div className="mx-auto max-w-content px-4 h-16 flex items-center justify-between gap-4">
        <Wordmark />
        <nav className="hidden lg:flex items-center gap-4 font-head text-[10px]">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="text-light hover:text-coin">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm"
            onClick={() => { setSound(!sound); if (!sound) setTimeout(() => play('coin'), 30); }}
            aria-pressed={sound}
            title={sound ? 'Sound on' : 'Sound off'}
          >
            {sound ? 'SND ON' : 'SND OFF'}
          </button>
          <Link href="/launch" className="btn btn-sm btn-coin">+ LAUNCH</Link>
          <button className="btn btn-sm lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">≡</button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden border-t-4 border-ink bg-ink px-4 py-4 grid gap-4 font-head text-[12px]">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="text-paper hover:text-coin py-2">{label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const [crt, setCrt] = useToggle(crtPref);
  return (
    <footer className="border-t-4 border-ink mt-16">
      <div className="mx-auto max-w-content px-4 py-8 grid gap-4 md:grid-cols-[1fr_auto] items-start">
        <p className="text-light text-[18px] max-w-[720px]">
          Insert Coin is a creative launch tool. Coins and trading agents are highly risky and can lose everything. Nothing here is
          financial advice and no returns are promised. Not affiliated with any console maker or other launchpad.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-sm" onClick={() => setCrt(!crt)} aria-pressed={crt}>CRT {crt ? 'ON' : 'OFF'}</button>
          <Link className="btn btn-sm" href="/owner">OWNER</Link>
          <Link className="btn btn-sm" href="/how">FAQ</Link>
        </div>
      </div>
    </footer>
  );
}

/** Applies the CRT preference to <body>. */
export function CrtSync() {
  const [crt] = useToggle(crtPref);
  useEffect(() => {
    document.body.classList.toggle('crt', crt);
  }, [crt]);
  return null;
}

// ---------- states ----------
export function PixelBar({ steps = 3, label = 'LOADING...' }: { steps?: number; label?: string }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setN((x) => (x + 1) % (steps + 1)), 300);
    return () => clearInterval(t);
  }, [steps, reduced]);
  return (
    <div className="flex flex-col items-center gap-4 py-8" role="status" aria-live="polite">
      <span className="font-head text-[12px] text-light">{label}</span>
      <div className="flex gap-1 border-4 border-light p-1">
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} className="w-8 h-4" style={{ background: i < (reduced ? steps : n) ? '#8DB580' : 'transparent' }} />
        ))}
      </div>
    </div>
  );
}

const SLEEPER = buildCoin('sleepy arcade cat', 3).candidates[0];

export function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <Sprite spec={SLEEPER} state="sleep" scale={4} />
      <p className="font-head text-[12px] text-light max-w-[480px] leading-6">{text}</p>
      {children}
    </div>
  );
}

export function ErrorBox({ reason, onRetry }: { reason: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center" role="alert">
      <span className="font-head text-[16px] text-btn blink">ERROR</span>
      <p className="text-paper text-[20px] max-w-[520px]">{reason}</p>
      {onRetry && <button className="btn" onClick={onRetry}>TRY AGAIN</button>}
    </div>
  );
}

export function Section({ id, kicker, title, children, className }: { id?: string; kicker?: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-content px-4 py-12 ${className ?? ''}`}>
      {kicker && <div className="font-head text-[10px] text-coin mb-2">{kicker}</div>}
      <h2 className="font-head text-[16px] sm:text-[24px] leading-[1.4] text-paper mb-8">{title}</h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-head text-[8px] text-dark">{label}</span>
      <span className={`font-head text-[12px] ${tone === 'up' ? 'text-dark' : tone === 'down' ? 'text-btn' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

export function CopyButton({ text, label = 'COPY' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        play('coin');
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? 'COPIED' : label}
    </button>
  );
}

export function Confetti({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  const [pieces, setPieces] = useState<{ x: number; y: number; c: string; vx: number; vy: number }[]>([]);
  useEffect(() => {
    if (!on || reduced) return;
    const cols = ['#1B2B1F', '#3E6B48', '#8DB580', '#D6E8C3', '#F2B705'];
    let ps = Array.from({ length: 80 }, () => ({
      x: 50, y: 40, c: cols[Math.floor(Math.random() * cols.length)], vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4 - 1,
    }));
    setPieces(ps);
    const start = performance.now();
    const t = setInterval(() => {
      ps = ps.map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.35 }));
      setPieces(ps);
      if (performance.now() - start > 1000) { clearInterval(t); setPieces([]); }
    }, 50);
    return () => clearInterval(t);
  }, [on, reduced]);
  if (!pieces.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      {pieces.map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: 8, height: 8, background: p.c }} />
      ))}
    </div>
  );
}

export function Typewriter({ text, speed = 25, className }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setN(text.length); return; }
    setN(0);
    const t = setInterval(() => setN((x) => { if (x >= text.length) { clearInterval(t); return x; } return x + 1; }), speed);
    return () => clearInterval(t);
  }, [text, speed, reduced]);
  return <span className={className}>{text.slice(0, n)}</span>;
}
