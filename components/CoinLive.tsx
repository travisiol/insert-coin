'use client';
import { useState } from 'react';
import Sprite from './Sprite';
import type { FighterSpec, CustomFrames, FighterState } from '@/lib/engine/types';
import type { FeedEvent } from '@/lib/server/views';
import { eventAnim, eventText, LEVELS } from '@/lib/agent/events';
import { useEventStream } from './LiveFeed';
import { Confetti } from './ui';
import { play } from '@/lib/client/sound';

/** The coin's fighter: plays the animation of its latest real event, LEVEL UP banner on level_up. */
export default function CoinLive({
  coinId, spec, frames, level: level0, sleeping, latest,
}: { coinId: number; spec: FighterSpec; frames: CustomFrames | null; level: number; sleeping: boolean; latest: FeedEvent | null }) {
  const recent = latest && Date.now() - new Date(latest.ts).getTime() < 10 * 60_000 ? latest : null;
  const [state, setState] = useState<FighterState>(sleeping ? 'sleep' : recent ? eventAnim(recent.type) : 'idle');
  const [bubble, setBubble] = useState<string | null>(recent ? eventText(recent.type, recent.payload, recent.ticker) : null);
  const [level, setLevel] = useState(level0);
  const [levelUp, setLevelUp] = useState(false);

  useEventStream(
    (e) => {
      setState(eventAnim(e.type));
      setBubble(eventText(e.type, e.payload, e.ticker));
      if (e.type === 'level_up') {
        setLevel(Number(e.payload.level ?? level));
        setLevelUp(true);
        play('levelup');
        setTimeout(() => setLevelUp(false), 1500);
      }
      setTimeout(() => setState((s) => (s === 'sleep' ? s : 'idle')), 6000);
    },
    { coinId, after: latest?.id ?? 0 },
  );

  return (
    <div className="relative flex flex-col items-center gap-4">
      {bubble && (
        <div className="card px-4 py-1 text-[20px] relative">
          {bubble}
          <span className="absolute left-1/2 -bottom-3 w-3 h-3 bg-paper border-r-4 border-b-4 border-ink rotate-45 -translate-x-1/2" aria-hidden />
        </div>
      )}
      <div className="bg-tile p-4 border-4 border-dark">
        <Sprite spec={spec} frames={frames} state={state} level={level} scale={6} />
      </div>
      <span className="font-head text-[10px] bg-coin text-ink px-2 py-1 border-4 border-ink">LVL {level} {LEVELS[level]}</span>
      {levelUp && (
        <>
          <Confetti on />
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="levelup font-head text-[20px] text-coin bg-ink px-4 py-2 border-4 border-coin">LEVEL UP!</span>
          </div>
        </>
      )}
    </div>
  );
}
