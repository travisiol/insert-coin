'use client';
import { useState } from 'react';
import Sprite from './Sprite';
import { buildCoin, accessoriesFor } from '@/lib/engine/build';
import { ARCHETYPES, LEGS, STATES, type FighterState, type FighterSpec } from '@/lib/engine/types';
import { LEVELS } from '@/lib/agent/events';

const BASE = buildCoin('insert coin arcade', 0).candidates[0];
function demo(i: number, ticker = 'YOURS'): FighterSpec {
  const a = ARCHETYPES[i % ARCHETYPES.length];
  const accs = accessoriesFor(a);
  return { ...BASE, archetype: a, accessory: accs[(i * 5) % accs.length], legs: LEGS[i % LEGS.length], eyes: (i * 3) % 10, mouth: (i * 7) % 8, ticker };
}

/** Archetype carousel: hover (or focus) a fighter to play its idle animation. */
export function ArchetypeCarousel() {
  const [hover, setHover] = useState<number | null>(0);
  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x" role="list">
        {ARCHETYPES.map((a, i) => (
          <button
            key={a}
            role="listitem"
            className="card p-2 flex flex-col items-center gap-2 shrink-0 snap-start"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            aria-label={`${a} archetype`}
          >
            <div className="bg-tile p-2"><Sprite spec={demo(i)} scale={3} animate={hover === i} state={hover === i ? 'walk' : 'idle'} /></div>
            <span className="font-head text-[8px] uppercase">{a}</span>
          </button>
        ))}
      </div>
      <p className="font-head text-[8px] text-light mt-2">ENGINE PREVIEW · NOT A COIN</p>
    </div>
  );
}

const STATE_INFO: Record<FighterState, string> = {
  idle: 'waiting, blinking',
  walk: 'crossing the arcade',
  trading: 'a position opened',
  profit: 'closed in profit',
  loss: 'closed at a loss',
  buyback: 'bought its coin back',
  burn: 'burned what it bought',
  bonded: 'graduated the curve',
  sleep: 'no events for 72 h',
};

export function StatesGrid() {
  const spec = demo(3, 'BOT');
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-4">
      {STATES.map((s) => (
        <div key={s} className="card-dark p-2 flex flex-col items-center gap-2 text-center">
          <div className="bg-tile p-1"><Sprite spec={spec} state={s} scale={2} /></div>
          <span className="font-head text-[8px] text-coin uppercase">{s}</span>
          <span className="text-[16px] text-light leading-4">{STATE_INFO[s]}</span>
        </div>
      ))}
    </div>
  );
}

export function LevelsRow() {
  const spec = demo(0, 'LVL');
  const req = ['launched', 'first on-chain agent action', '$25K mcap or 50 actions', 'bonded', '$250K mcap or 1% supply burned'];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {LEVELS.map((l, i) => (
        <div key={l} className="card p-4 flex flex-col items-center gap-2 text-center">
          <div className="bg-tile p-2"><Sprite spec={spec} level={i} scale={2} /></div>
          <span className="font-head text-[8px]">LVL {i}</span>
          <span className="font-head text-[10px] leading-4">{l}</span>
          <span className="text-[16px] text-dark leading-4">{req[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function AgentCards() {
  const cards: { title: string; state: FighterState; text: string; i: number }[] = [
    { title: 'BURN', state: 'burn', i: 8, text: 'Fees buy the coin back and burn exactly what was bought.' },
    { title: 'TRADE', state: 'trading', i: 10, text: 'Six rule-based strategies with take-profit, stop-loss and daily loss limits. Real SOL, real risk.' },
    { title: 'HYBRID', state: 'buyback', i: 5, text: 'Split the fees any way you like and choose where trading results go.' },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.title} className="card p-6 flex flex-col gap-4">
          <div className="bg-tile p-4 flex justify-center"><Sprite spec={demo(c.i, c.title === 'HYBRID' ? 'HYBR' : c.title)} state={c.state} scale={4} /></div>
          <h3 className="font-head text-[16px]">{c.title}</h3>
          <p className="text-[20px]">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

export function StepSprite({ state, i, ticker }: { state: FighterState; i: number; ticker: string }) {
  return <Sprite spec={demo(i, ticker)} state={state} scale={3} />;
}
