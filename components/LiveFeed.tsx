'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FeedEvent } from '@/lib/server/views';
import { feedLine } from '@/lib/agent/events';
import { Typewriter, Empty } from './ui';
import { play } from '@/lib/client/sound';

/** Subscribe to /api/stream (SSE). Calls onEvent for each new real event. */
export function useEventStream(onEvent: (e: FeedEvent) => void, opts: { coinId?: number; after?: number } = {}) {
  useEffect(() => {
    const qs = new URLSearchParams();
    if (opts.coinId) qs.set('coin', String(opts.coinId));
    if (opts.after) qs.set('after', String(opts.after));
    const es = new EventSource(`/api/stream?${qs.toString()}`);
    es.addEventListener('ev', (m) => {
      try {
        onEvent(JSON.parse((m as MessageEvent).data) as FeedEvent);
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.coinId, opts.after]);
}

function ago(ts: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const TONE: Partial<Record<FeedEvent['type'], string>> = {
  profit: 'text-light', fee: 'text-light', loss: 'text-btn', burn: 'text-coin', buyback: 'text-coin', bonded: 'text-coin', level_up: 'text-coin',
};

export default function LiveFeed({ initial, coinId, max = 12 }: { initial: FeedEvent[]; coinId?: number; max?: number }) {
  const [events, setEvents] = useState<FeedEvent[]>(initial);
  const [fresh, setFresh] = useState<number | null>(null);
  useEventStream(
    (e) => {
      setEvents((cur) => (cur.some((x) => x.id === e.id) ? cur : [e, ...cur].slice(0, max)));
      setFresh(e.id);
      play(e.type === 'burn' ? 'burn' : e.type === 'level_up' ? 'levelup' : 'type');
    },
    { coinId, after: initial[0]?.id ?? 0 },
  );
  if (!events.length) return <Empty text="NO AGENT ACTIVITY YET. EVERY LINE HERE WILL BE A CONFIRMED ON-CHAIN ACTION." />;
  return (
    <ul className="card-dark p-4 font-body text-[20px] flex flex-col gap-2 max-h-[420px] overflow-auto" aria-live="polite">
      {events.slice(0, max).map((e) => {
        const text = feedLine(e.type, e.payload, e.ticker);
        return (
          <li key={e.id} className="flex gap-4 items-baseline">
            <span className="text-dark w-10 shrink-0">{ago(e.ts)}</span>
            <Link href={`/c/${e.ticker}`} className={`flex-1 hover:underline ${TONE[e.type] ?? 'text-paper'}`}>
              {fresh === e.id ? <Typewriter text={text} /> : text}
            </Link>
            {e.txSig && (
              <a className="text-light text-[16px] hover:text-coin" href={`https://solscan.io/tx/${e.txSig}`} target="_blank" rel="noreferrer">
                TX
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
