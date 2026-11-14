/** Read models for pages and APIs. Never exposes secrets or owner key hashes. */
import { q, sql } from '../db';
import type { FighterSpec, CustomFrames } from '../engine/types';
import type { Personality } from '../engine/personality';
import type { EventType } from '../agent/events';
import { pairsFor, type DexPair } from '../market';

export interface CoinCard {
  id: number;
  mint: string;
  name: string;
  ticker: string;
  story: string;
  spec: FighterSpec;
  frames: CustomFrames | null;
  level: number;
  status: string;
  agentMode: string;
  strategy: string;
  splitBurnPct: number;
  profitRoute: string;
  paused: boolean;
  halted: boolean;
  haltReason: string | null;
  sleeping: boolean;
  tradeLive: boolean;
  createdAt: string;
  feesLamports: number;
  burnedTokens: number;
  buybacks: number;
  burns: number;
  pnlLamports: number;
  closedTrades: number;
  wins: number;
  openTrades: number;
  hasBurn: boolean;
  hasTrade: boolean;
  mcap: number | null;
  volume24h: number | null;
  change1h: number | null;
  priceUsd: string | null;
}

interface CoinRow {
  id: number; mint: string; name: string; ticker: string; story: string; sprite_json: FighterSpec; frames_json: CustomFrames | null;
  level: number; status: string; agent_mode: string; strategy: string; split_burn_pct: number; profit_route: string; paused: boolean;
  halted: boolean; halt_reason: string | null; sleeping: boolean; trade_live: boolean; created_at: string | Date;
  fees: string | null; burned: string | null; buybacks: string | null; burns: string | null;
  pnl: string | null; closed: string | null; wins: string | null; open_trades: string | null;
}

const CARD_SQL = sql`
  select c.id, c.mint, c.name, c.ticker, c.story, c.sprite_json, c.frames_json, c.level, c.status, c.agent_mode, c.strategy,
    c.split_burn_pct, c.profit_route, c.paused, c.halted, c.halt_reason, c.sleeping, c.trade_live, c.created_at,
    (select coalesce(sum(l.sol_delta_lamports), 0) from ledger l where l.coin_id = c.id and l.kind = 'fee_received') as fees,
    (select coalesce(-sum(l.token_delta), 0) from ledger l where l.coin_id = c.id and l.kind = 'burn') as burned,
    (select count(*) from events e where e.coin_id = c.id and e.type = 'buyback') as buybacks,
    (select count(*) from events e where e.coin_id = c.id and e.type = 'burn') as burns,
    (select coalesce(sum(t.pnl_lamports), 0) from trades t where t.coin_id = c.id and t.dry_run = false and t.closed_at is not null) as pnl,
    (select count(*) from trades t where t.coin_id = c.id and t.dry_run = false and t.closed_at is not null) as closed,
    (select count(*) from trades t where t.coin_id = c.id and t.dry_run = false and t.closed_at is not null and t.pnl_lamports > 0) as wins,
    (select count(*) from trades t where t.coin_id = c.id and t.closed_at is null and t.dry_run = false) as open_trades
  from coins c`;

function toCard(r: CoinRow, p?: DexPair): CoinCard {
  return {
    id: r.id, mint: r.mint, name: r.name, ticker: r.ticker, story: r.story, spec: r.sprite_json, frames: r.frames_json,
    level: r.level, status: r.status, agentMode: r.agent_mode, strategy: r.strategy, splitBurnPct: r.split_burn_pct,
    profitRoute: r.profit_route, paused: r.paused, halted: r.halted, haltReason: r.halt_reason, sleeping: r.sleeping,
    tradeLive: r.trade_live, createdAt: new Date(r.created_at).toISOString(),
    feesLamports: Number(r.fees ?? 0), burnedTokens: Number(r.burned ?? 0), buybacks: Number(r.buybacks ?? 0),
    burns: Number(r.burns ?? 0), pnlLamports: Number(r.pnl ?? 0), closedTrades: Number(r.closed ?? 0), wins: Number(r.wins ?? 0),
    openTrades: Number(r.open_trades ?? 0), hasBurn: Number(r.burns ?? 0) > 0, hasTrade: Number(r.closed ?? 0) + Number(r.open_trades ?? 0) > 0,
    mcap: p?.marketCap ?? p?.fdv ?? null, volume24h: p?.volume?.h24 ?? null, change1h: p?.priceChange?.h1 ?? null, priceUsd: p?.priceUsd ?? null,
  };
}

export async function listCoins(opts: { withMarket?: boolean; limit?: number } = {}): Promise<CoinCard[]> {
  const rows = await q<CoinRow>(sql`${CARD_SQL} where c.status in ('live','bonded') order by c.id desc limit ${opts.limit ?? 500}`);
  const pairs = opts.withMarket === false ? {} : await pairsFor(rows.map((r) => r.mint), 60);
  return rows.map((r) => toCard(r, pairs[r.mint]));
}

export async function coinByTicker(ticker: string): Promise<(CoinCard & {
  terminal: Personality; creatorWallet: string; tradingWallet: string; inputText: string; launchSig: string | null; pairAddress: string | null;
}) | null> {
  const rows = await q<CoinRow & { terminal_json: Personality; creator_pk: string; trading_pk: string; input_text: string; launch_sig: string | null; pair_address: string | null }>(sql`
    select x.*, c.terminal_json, c.input_text, c.launch_sig, c.pair_address, cw.pubkey as creator_pk, tw.pubkey as trading_pk
    from (${CARD_SQL} where upper(c.ticker) = upper(${ticker}) and c.status <> 'failed') x
    join coins c on c.id = x.id
    join wallets cw on cw.id = c.creator_wallet_id
    join wallets tw on tw.id = c.trading_wallet_id`);
  const r = rows[0];
  if (!r) return null;
  const pairs = await pairsFor([r.mint], 60);
  return {
    ...toCard(r, pairs[r.mint]), terminal: r.terminal_json, creatorWallet: r.creator_pk, tradingWallet: r.trading_pk,
    inputText: r.input_text, launchSig: r.launch_sig, pairAddress: r.pair_address ?? pairs[r.mint]?.pairAddress ?? null,
  };
}

export async function globalStats(): Promise<{ fighters: number; feesLamports: number; burnedTokens: number }> {
  const [r] = await q<{ fighters: string; fees: string; burned: string }>(sql`
    select (select count(*) from coins where status in ('live','bonded')) as fighters,
           (select coalesce(sum(sol_delta_lamports), 0) from ledger where kind = 'fee_received') as fees,
           (select coalesce(-sum(token_delta), 0) from ledger where kind = 'burn') as burned`);
  return { fighters: Number(r?.fighters ?? 0), feesLamports: Number(r?.fees ?? 0), burnedTokens: Number(r?.burned ?? 0) };
}

export interface FeedEvent {
  id: number;
  coinId: number;
  ticker: string;
  ts: string;
  type: EventType;
  payload: Record<string, unknown>;
  txSig: string | null;
}

export async function recentEvents(opts: { coinId?: number; afterId?: number; limit?: number } = {}): Promise<FeedEvent[]> {
  const rows = await q<{ id: string; coin_id: number; ticker: string; ts: string | Date; type: EventType; payload_json: Record<string, unknown>; tx_sig: string | null }>(sql`
    select e.id, e.coin_id, c.ticker, e.ts, e.type, e.payload_json, e.tx_sig from events e join coins c on c.id = e.coin_id
    where (${opts.coinId ?? null}::int is null or e.coin_id = ${opts.coinId ?? null}::int)
      and e.id > ${opts.afterId ?? 0}
    order by e.id desc limit ${opts.limit ?? 50}`);
  return rows.map((r) => ({
    id: Number(r.id), coinId: r.coin_id, ticker: r.ticker, ts: new Date(r.ts).toISOString(), type: r.type, payload: r.payload_json, txSig: r.tx_sig,
  }));
}

export interface LedgerView { id: number; ts: string; wallet: string; kind: string; sol: number; tokens: number; txSig: string | null; meta: Record<string, unknown> }

export async function coinLedger(coinId: number, limit = 100): Promise<LedgerView[]> {
  const rows = await q<{ id: string; ts: string | Date; wallet: string; kind: string; sol_delta_lamports: string; token_delta: string; tx_sig: string | null; meta_json: Record<string, unknown> }>(sql`
    select id, ts, wallet, kind, sol_delta_lamports, token_delta, tx_sig, meta_json from ledger where coin_id = ${coinId} order by id desc limit ${limit}`);
  return rows.map((r) => ({
    id: Number(r.id), ts: new Date(r.ts).toISOString(), wallet: r.wallet, kind: r.kind, sol: Number(r.sol_delta_lamports),
    tokens: Number(r.token_delta), txSig: r.tx_sig, meta: r.meta_json,
  }));
}

export interface Scorecard {
  feesIn: number;
  allocatedBurn: number;
  allocatedTrade: number;
  networkFees: number;
  burnedTokens: number;
  buybackSol: number;
  openTrades: { symbol: string; strategy: string; size: number; entry: number; dryRun: boolean; openedAt: string }[];
  closedTrades: { symbol: string; pnl: number; reason: string | null; dryRun: boolean; closedAt: string; exitSig: string | null }[];
  dryRunSignals: number;
  firstDryRunAt: string | null;
}

export async function scorecard(coinId: number): Promise<Scorecard> {
  const [s] = await q<Record<string, string>>(sql`
    select
      coalesce(sum(sol_delta_lamports) filter (where kind = 'fee_received'), 0) as fees,
      coalesce(sum((meta_json->>'lamports')::bigint) filter (where kind = 'allocated' and meta_json->>'to' = 'burn'), 0) as alloc_burn,
      coalesce(sum((meta_json->>'lamports')::bigint) filter (where kind = 'allocated' and meta_json->>'to' = 'trade'), 0) as alloc_trade,
      coalesce(-sum(sol_delta_lamports) filter (where kind = 'network_fee'), 0) as net_fees,
      coalesce(-sum(token_delta) filter (where kind = 'burn'), 0) as burned,
      coalesce(-sum(sol_delta_lamports) filter (where kind = 'buyback'), 0) as buyback_sol
    from ledger where coin_id = ${coinId}`);
  const trades = await q<{ token_symbol: string; strategy: string; size_lamports: string; entry_price: number; dry_run: boolean; opened_at: string | Date; closed_at: string | Date | null; pnl_lamports: string | null; reason: string | null; exit_sig: string | null }>(sql`
    select token_symbol, strategy, size_lamports, entry_price, dry_run, opened_at, closed_at, pnl_lamports, reason, exit_sig
    from trades where coin_id = ${coinId} order by id desc limit 60`);
  const [dr] = await q<{ n: string; first: string | Date | null }>(sql`select count(*) as n, min(opened_at) as first from trades where coin_id = ${coinId} and dry_run = true`);
  return {
    feesIn: Number(s?.fees ?? 0), allocatedBurn: Number(s?.alloc_burn ?? 0), allocatedTrade: Number(s?.alloc_trade ?? 0),
    networkFees: Number(s?.net_fees ?? 0), burnedTokens: Number(s?.burned ?? 0), buybackSol: Number(s?.buyback_sol ?? 0),
    openTrades: trades.filter((t) => !t.closed_at).map((t) => ({
      symbol: t.token_symbol, strategy: t.strategy, size: Number(t.size_lamports), entry: t.entry_price, dryRun: t.dry_run, openedAt: new Date(t.opened_at).toISOString(),
    })),
    closedTrades: trades.filter((t) => t.closed_at).map((t) => ({
      symbol: t.token_symbol, pnl: Number(t.pnl_lamports ?? 0), reason: t.reason, dryRun: t.dry_run, closedAt: new Date(t.closed_at!).toISOString(), exitSig: t.exit_sig,
    })),
    dryRunSignals: Number(dr?.n ?? 0),
    firstDryRunAt: dr?.first ? new Date(dr.first).toISOString() : null,
  };
}

export async function safeView<T>(fn: () => Promise<T>, fallback: T): Promise<{ data: T; error: string | null }> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    return { data: fallback, error: e instanceof Error ? e.message : 'unavailable' };
  }
}
