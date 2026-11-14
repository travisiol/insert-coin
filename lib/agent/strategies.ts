/** The 6 trading strategies. Deterministic rules; the Fighter Engine never places a trade. */
import type { DexPair } from '../market';

export const STRATEGY_IDS = ['scalper', 'momentum', 'trend', 'contrarian', 'conservative', 'degen'] as const;
export type StrategyId = (typeof STRATEGY_IDS)[number];

export interface Strategy {
  id: StrategyId;
  label: string;
  entry: string;
  tp: number; // fraction
  sl: number; // fraction
  trail: number | null;
  maxHoldMin: number;
  maxSize: number; // fraction of trading balance
  minLiquidity: number;
  test: (p: DexPair) => { ok: boolean; reason: string };
}

const h = (n: number) => n * 3600_000;
const age = (p: DexPair) => (p.pairCreatedAt ? Date.now() - p.pairCreatedAt : 0);
const ch = (p: DexPair, k: 'm5' | 'h1' | 'h6' | 'h24') => p.priceChange?.[k] ?? 0;
const tx = (p: DexPair, k: 'm5' | 'h1' | 'h6' | 'h24') => p.txns?.[k] ?? { buys: 0, sells: 0 };
const vol = (p: DexPair, k: 'm5' | 'h1' | 'h6' | 'h24') => p.volume?.[k] ?? 0;

export const STRATEGIES: Record<StrategyId, Strategy> = {
  scalper: {
    id: 'scalper', label: 'Scalper', entry: 'Fresh 5-min momentum, buys > 1.5x sells, rising volume',
    tp: 0.04, sl: 0.025, trail: null, maxHoldMin: 30, maxSize: 0.15, minLiquidity: 15_000,
    test: (p) => {
      const t = tx(p, 'm5');
      const ok = ch(p, 'm5') > 1 && t.buys > 1.5 * Math.max(1, t.sells) && vol(p, 'm5') * 12 > vol(p, 'h1');
      return { ok, reason: `5m ${ch(p, 'm5').toFixed(1)}%, buys ${t.buys} / sells ${t.sells}` };
    },
  },
  momentum: {
    id: 'momentum', label: 'Momentum', entry: 'Price and transactions accelerating over 1h',
    tp: 0.12, sl: 0.06, trail: null, maxHoldMin: 360, maxSize: 0.15, minLiquidity: 15_000,
    test: (p) => {
      const t1 = tx(p, 'h1');
      const t6 = tx(p, 'h6');
      const accel = t1.buys + t1.sells > ((t6.buys + t6.sells) / 6) * 1.5;
      const ok = ch(p, 'h1') > 8 && ch(p, 'm5') > 0 && accel;
      return { ok, reason: `1h ${ch(p, 'h1').toFixed(1)}%, 1h txns ${t1.buys + t1.sells}` };
    },
  },
  trend: {
    id: 'trend', label: 'Trend Following', entry: '1h, 6h and 24h all positive, trailing stop',
    tp: 0.25, sl: 0.08, trail: 0.08, maxHoldMin: 2880, maxSize: 0.15, minLiquidity: 15_000,
    test: (p) => {
      const ok = ch(p, 'h1') > 0 && ch(p, 'h6') > 0 && ch(p, 'h24') > 0;
      return { ok, reason: `1h ${ch(p, 'h1').toFixed(1)}% / 6h ${ch(p, 'h6').toFixed(1)}% / 24h ${ch(p, 'h24').toFixed(1)}%` };
    },
  },
  contrarian: {
    id: 'contrarian', label: 'Contrarian', entry: '1h down 20%+ then 5m turns positive while sells fade',
    tp: 0.1, sl: 0.07, trail: null, maxHoldMin: 720, maxSize: 0.1, minLiquidity: 15_000,
    test: (p) => {
      const s5 = tx(p, 'm5').sells;
      const s1 = tx(p, 'h1').sells;
      const ok = ch(p, 'h1') <= -20 && ch(p, 'm5') > 0 && s5 < s1 / 12;
      return { ok, reason: `1h ${ch(p, 'h1').toFixed(1)}%, 5m ${ch(p, 'm5').toFixed(1)}%` };
    },
  },
  conservative: {
    id: 'conservative', label: 'Conservative', entry: 'Liquidity $100K+, 7+ days old, calm uptrend',
    tp: 0.08, sl: 0.04, trail: 0.04, maxHoldMin: 1440, maxSize: 0.05, minLiquidity: 100_000,
    test: (p) => {
      const ok = age(p) >= h(24 * 7) && ch(p, 'h1') > 0 && ch(p, 'h1') < 5 && ch(p, 'h24') > 0 && ch(p, 'h24') < 20;
      return { ok, reason: `age ${Math.floor(age(p) / h(24))}d, 24h ${ch(p, 'h24').toFixed(1)}%` };
    },
  },
  degen: {
    id: 'degen', label: 'Degen', entry: 'Under 6h old, explosive 5-min buying',
    tp: 0.3, sl: 0.12, trail: null, maxHoldMin: 120, maxSize: 0.2, minLiquidity: 5_000,
    test: (p) => {
      const t = tx(p, 'm5');
      const ok = age(p) > 0 && age(p) < h(6) && t.buys >= 30 && t.buys > 3 * Math.max(1, t.sells);
      return { ok, reason: `age ${(age(p) / h(1)).toFixed(1)}h, 5m buys ${t.buys} / sells ${t.sells}` };
    },
  },
};

export const MAX_OPEN_POSITIONS = 3;
export const DAILY_LOSS_LIMIT = 0.1;
