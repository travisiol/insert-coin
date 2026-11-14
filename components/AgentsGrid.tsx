'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import CoinCard, { agentStatus } from './CoinCard';
import type { CoinCard as Card } from '@/lib/server/views';
import { Empty } from './ui';

const SORTS = {
  volume: ['24H VOLUME', (c: Card) => c.volume24h ?? 0],
  mcap: ['MCAP', (c: Card) => c.mcap ?? 0],
  pnl: ['PNL', (c: Card) => c.pnlLamports],
  buybacks: ['BUYBACKS', (c: Card) => c.buybacks],
  burns: ['BURNS', (c: Card) => c.burnedTokens],
  fees: ['FEES', (c: Card) => c.feesLamports],
  new: ['NEWEST', (c: Card) => new Date(c.createdAt).getTime()],
} as const;
type SortKey = keyof typeof SORTS;

export default function AgentsGrid({ coins, initialSort = 'volume' }: { coins: Card[]; initialSort?: string }) {
  const [sort, setSort] = useState<SortKey>((initialSort in SORTS ? initialSort : 'volume') as SortKey);
  const [status, setStatus] = useState<'all' | 'ACTIVE' | 'PAUSED' | 'SLEEPING'>('all');
  const [mode, setMode] = useState<'all' | 'burn' | 'trade' | 'hybrid'>('all');
  const list = useMemo(() => {
    const fn = SORTS[sort][1];
    return coins
      .filter((c) => status === 'all' || agentStatus(c) === status || (status === 'PAUSED' && agentStatus(c) === 'HALTED'))
      .filter((c) => mode === 'all' || c.agentMode === mode)
      .sort((a, b) => fn(b) - fn(a));
  }, [coins, sort, status, mode]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4 items-end">
        <label>
          <span className="label text-light">SORT BY</span>
          <select className="field text-[18px] py-1" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="label text-light">STATUS</span>
          <select className="field text-[18px] py-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {['all', 'ACTIVE', 'PAUSED', 'SLEEPING'].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </label>
        <label>
          <span className="label text-light">MODE</span>
          <select className="field text-[18px] py-1" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            {['all', 'burn', 'trade', 'hybrid'].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </label>
        <span className="font-head text-[10px] text-light ml-auto">{list.length} FIGHTERS</span>
      </div>
      {list.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => <CoinCard key={c.id} c={c} />)}</div>
      ) : (
        <Empty text={coins.length ? 'NO FIGHTER MATCHES THESE FILTERS.' : 'NO FIGHTERS YET. LAUNCH THE FIRST ONE.'}>
          {!coins.length && <Link href="/launch" className="btn btn-coin">LAUNCH</Link>}
        </Empty>
      )}
    </div>
  );
}
