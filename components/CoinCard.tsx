import Link from 'next/link';
import Sprite from './Sprite';
import type { CoinCard as Card } from '@/lib/server/views';
import { fmtUsd, fmtNum } from '@/lib/market';
import { STRATEGIES, type StrategyId } from '@/lib/agent/strategies';
import { LEVELS } from '@/lib/agent/events';

export function agentStatus(c: Pick<Card, 'paused' | 'halted' | 'sleeping'>): 'ACTIVE' | 'PAUSED' | 'SLEEPING' | 'HALTED' {
  if (c.halted) return 'HALTED';
  if (c.paused) return 'PAUSED';
  if (c.sleeping) return 'SLEEPING';
  return 'ACTIVE';
}

export function modeLabel(c: Pick<Card, 'agentMode' | 'splitBurnPct' | 'strategy'>): string[] {
  const strat = STRATEGIES[c.strategy as StrategyId]?.label.toUpperCase() ?? c.strategy.toUpperCase();
  if (c.agentMode === 'burn') return ['BURN'];
  if (c.agentMode === 'trade') return ['TRADE', strat];
  return [`HYBRID ${c.splitBurnPct}/${100 - c.splitBurnPct}`, strat];
}

export default function CoinCard({ c }: { c: Card }) {
  const status = agentStatus(c);
  const winRate = c.closedTrades ? `${Math.round((c.wins / c.closedTrades) * 100)}%` : '—';
  const pnl = c.closedTrades ? `${c.pnlLamports >= 0 ? '+' : ''}${(c.pnlLamports / 1e9).toFixed(3)} SOL` : '—';
  return (
    <Link href={`/c/${c.ticker}`} className="card p-4 flex flex-col gap-4 hover:bg-[#e4f0d6]" aria-label={`${c.name} $${c.ticker}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="bg-tile p-2">
          <Sprite spec={c.spec} frames={c.frames} level={c.level} scale={2} state={c.sleeping ? 'sleep' : 'idle'} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`font-head text-[8px] px-2 py-1 border-2 border-ink ${status === 'ACTIVE' ? 'bg-light' : status === 'HALTED' ? 'bg-btn text-paper' : 'bg-shell'}`}>{status}</span>
          <span className="font-head text-[8px] text-dark">LVL {c.level} {LEVELS[c.level]}</span>
        </div>
      </div>
      <div>
        <div className="font-head text-[12px] leading-5 truncate">{c.name}</div>
        <div className="font-head text-[10px] text-dark">${c.ticker}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {modeLabel(c).map((m) => (
          <span key={m} className="font-head text-[8px] bg-ink text-paper px-2 py-1">{m}</span>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[18px]">
        <dt className="text-dark">Mcap</dt><dd className="text-right">{fmtUsd(c.mcap)}</dd>
        <dt className="text-dark">Fees</dt><dd className="text-right">{(c.feesLamports / 1e9).toFixed(3)} SOL</dd>
        {c.agentMode !== 'trade' && (<><dt className="text-dark">Burned</dt><dd className="text-right">{fmtNum(c.burnedTokens)} ({c.burns}x)</dd></>)}
        {c.agentMode !== 'burn' && (<><dt className="text-dark">PnL</dt><dd className="text-right">{pnl}</dd><dt className="text-dark">Win rate</dt><dd className="text-right">{winRate}</dd></>)}
      </dl>
    </Link>
  );
}
