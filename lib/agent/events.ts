/** Shared event vocabulary: what each recorded event means on screen. Pure, safe for client. */
import type { FighterState } from '../engine/types';

export type EventType =
  | 'launched' | 'fee' | 'allocated' | 'buyback' | 'burn' | 'trade_open' | 'profit' | 'loss' | 'bonded' | 'level_up' | 'sleep' | 'wake';

export interface EventLike {
  id: number;
  coinId: number;
  ts: string | Date;
  type: EventType;
  payload: Record<string, unknown>;
  txSig: string | null;
  ticker?: string;
}

export const LEVELS = ['SPAWN', 'PLAYER ONE', 'COMBO', 'BOSS', 'HIGH SCORE'] as const;

function n(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0);
}

export function compact(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
  return x.toFixed(a < 10 ? 2 : 0);
}

export function sol(lamports: number, d = 4): string {
  return `${(lamports / 1e9).toFixed(d)} SOL`;
}

/** Bubble text: quotes the recorded event only. */
export function eventText(type: EventType, payload: Record<string, unknown>, ticker: string): string {
  const T = `$${ticker}`;
  switch (type) {
    case 'launched': return `${T} launched`;
    case 'fee': return `+${sol(n(payload.lamports))} fees`;
    case 'allocated': return `${sol(n(payload.burn), 4)} to burn / ${sol(n(payload.trade), 4)} to trade`;
    case 'buyback': return `bought back ${compact(n(payload.tokens))} ${T}`;
    case 'burn': return `burned ${compact(n(payload.tokens))} ${T}`;
    case 'trade_open': return `opened ${String(payload.strategy ?? '').toUpperCase()} on $${String(payload.symbol ?? '?')}`;
    case 'profit': return `+${sol(n(payload.lamports))} on $${String(payload.symbol ?? '?')}`;
    case 'loss': return `-${sol(Math.abs(n(payload.lamports)))} on $${String(payload.symbol ?? '?')}`;
    case 'bonded': return `${T} BONDED`;
    case 'level_up': return `LEVEL UP! LVL ${n(payload.level)} ${LEVELS[n(payload.level)] ?? ''}`;
    case 'sleep': return `${T} fell asleep`;
    case 'wake': return `${T} woke up`;
  }
}

/** Feed line: event text prefixed with $TICKER unless it already names it. */
export function feedLine(type: EventType, payload: Record<string, unknown>, ticker: string): string {
  const t = eventText(type, payload, ticker);
  return t.includes(`$${ticker}`) ? t : `$${ticker} ${t}`;
}

/** The animation an event triggers. */
export function eventAnim(type: EventType): FighterState {
  switch (type) {
    case 'fee': return 'trading';
    case 'allocated': return 'idle';
    case 'buyback': return 'buyback';
    case 'burn': return 'burn';
    case 'trade_open': return 'trading';
    case 'profit': return 'profit';
    case 'loss': return 'loss';
    case 'bonded': return 'bonded';
    case 'level_up': return 'profit';
    case 'sleep': return 'sleep';
    case 'launched':
    case 'wake':
    default: return 'idle';
  }
}

export type Zone = 'launch' | 'furnace' | 'trading' | 'hall' | 'lobby' | 'gameover';

export const ZONES: Record<Zone, { label: string; x: number; y: number; w: number; h: number }> = {
  hall: { label: 'HIGH SCORE HALL', x: 30, y: 2, w: 36, h: 16 },
  furnace: { label: 'FURNACE', x: 2, y: 20, w: 26, h: 22 },
  launch: { label: 'LAUNCH PAD', x: 32, y: 22, w: 32, h: 16 },
  trading: { label: 'TRADING FLOOR', x: 68, y: 20, w: 26, h: 22 },
  lobby: { label: 'LOBBY', x: 30, y: 42, w: 36, h: 10 },
  gameover: { label: 'GAME OVER ROOM', x: 30, y: 54, w: 36, h: 8 },
};

export interface ZoneInput {
  status: string;
  level: number;
  agentMode: string;
  sleeping: boolean;
  createdAt: string | Date;
  hasBurn: boolean;
  hasTrade: boolean;
}

/** Zone from recorded facts only. */
export function zoneFor(c: ZoneInput): Zone {
  if (c.sleeping) return 'gameover';
  if (c.status === 'bonded' || c.level >= 3) return 'hall';
  const fresh = Date.now() - new Date(c.createdAt).getTime() < 24 * 3600_000;
  if (c.agentMode !== 'trade' && c.hasBurn) return 'furnace';
  if (c.agentMode !== 'burn' && c.hasTrade) return 'trading';
  if (fresh) return 'launch';
  return 'lobby';
}
