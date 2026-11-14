'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sprite from './Sprite';
import { buildCoin } from '@/lib/engine/build';
import { useReducedMotion } from '@/lib/client/prefs';
import { play } from '@/lib/client/sound';

const EXAMPLES = [
  'a robot that lost all its money',
  'my cat thinks she is a wizard',
  'gm from a frog who never sleeps',
  'a ghost that only haunts red candles',
  'an astronaut who forgot the way home',
];

export default function HomeHero({ stats }: { stats: { fighters: number; feesLamports: number; burnedTokens: number } }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [text, setText] = useState('');
  const [ex, setEx] = useState(0);
  const [booted, setBooted] = useState(false);
  const preview = buildCoin(text.trim() || EXAMPLES[ex], 0);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), reduced ? 0 : 320);
    return () => clearTimeout(t);
  }, [reduced]);
  useEffect(() => {
    if (text || reduced) return;
    const t = setInterval(() => setEx((x) => (x + 1) % EXAMPLES.length), 3500);
    return () => clearInterval(t);
  }, [text, reduced]);

  const go = () => {
    const q = text.trim();
    if (!q) return;
    play('coin');
    router.push(`/launch?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="mx-auto max-w-content px-4 pt-8 pb-12 grid gap-8 lg:grid-cols-[1fr_420px] items-center">
      <div className="order-2 lg:order-1 flex flex-col gap-6">
        <h1 className="font-head text-[32px] sm:text-[48px] leading-[1.3] text-coin">INSERT COIN</h1>
        <p className="text-[24px] text-light max-w-[560px]">
          Drop a post or an idea. Get a pixel fighter, a Solana coin, and an agent that works with its creator fees.
        </p>
        <div className="grid grid-cols-3 gap-4 max-w-[560px]">
          <Counter label="FIGHTERS ALIVE" value={stats.fighters > 0 ? String(stats.fighters) : null} />
          <Counter label="CREATOR FEES COLLECTED" value={stats.feesLamports > 0 ? `${(stats.feesLamports / 1e9).toFixed(2)} SOL` : null} />
          <Counter label="TOKENS BURNED" value={stats.burnedTokens > 0 ? compact(stats.burnedTokens) : null} />
        </div>
      </div>

      <div className="order-1 lg:order-2 cabinet w-full max-w-[420px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-head text-[8px] text-edge">PLAYER 1</span>
          <span className="font-head text-[8px] text-edge">CREDIT 0{text ? 1 : 0}</span>
        </div>
        <div className="screen p-4 min-h-[360px] flex flex-col gap-4">
          <div className={booted ? '' : 'boot'} style={{ background: booted ? 'transparent' : '#D6E8C3' }}>
            {booted && (
              <div className="flex flex-col items-center gap-4">
                <span className="font-head text-[20px] text-coin blink">INSERT COIN</span>
                <div className="dissolve bg-tile p-2">
                  <Sprite spec={preview.candidates[0]} scale={4} state="idle" />
                </div>
                <span className="font-head text-[8px] text-light">{text ? `${preview.name.toUpperCase()} · $${preview.ticker}` : 'ENGINE PREVIEW · NOT A COIN'}</span>
              </div>
            )}
          </div>
          <form
            className="flex flex-col gap-2 mt-auto"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <label htmlFor="hero-input" className="sr-only">Paste an X post link or type an idea</label>
            <textarea
              id="hero-input"
              className="field text-[20px] h-24 resize-none"
              maxLength={280}
              placeholder="paste an X post link or type an idea..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  go();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-light text-[16px]">{text.length}/280 · try: {EXAMPLES[ex]}</span>
              <button className="btn btn-primary" disabled={!text.trim()}>INSERT</button>
            </div>
          </form>
        </div>
        <div className="flex items-center justify-between mt-6 px-2" aria-hidden>
          <div className="dpad" />
          <div className="w-3 h-12 bg-ink border-2 border-edge" title="coin slot" />
          <div className="flex gap-2"><div className="round-btn" /><div className="round-btn mt-4" /></div>
        </div>
      </div>
    </section>
  );
}

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

/** A zero counter reads INCOMING until the first real on-chain value lands. */
function Counter({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="card-dark p-2 sm:p-4 flex flex-col gap-2">
      <span className="font-head text-[8px] text-light leading-4">{label}</span>
      {value === null ? (
        <span className="font-head text-[10px] sm:text-[12px] text-coin blink">INCOMING</span>
      ) : (
        <span className="font-head text-[12px] sm:text-[16px] text-coin">{value}</span>
      )}
    </div>
  );
}
