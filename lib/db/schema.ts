import {
  pgTable, serial, bigserial, text, integer, boolean, timestamp, jsonb, bigint, numeric, doublePrecision, primaryKey,
} from 'drizzle-orm/pg-core';
import type { FighterSpec, CustomFrames } from '../engine/types';
import type { Personality } from '../engine/personality';

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  pubkey: text('pubkey').notNull().unique(),
  encSecret: text('enc_secret').notNull(),
  iv: text('iv').notNull(),
  tag: text('tag').notNull(),
  kind: text('kind').$type<'creator' | 'trading'>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AgentMode = 'burn' | 'trade' | 'hybrid';
export type ProfitRoute = 'burn' | 'reinvest' | 'beneficiary';
export type CoinStatus = 'launching' | 'live' | 'bonded' | 'failed';

export const coins = pgTable('coins', {
  id: serial('id').primaryKey(),
  mint: text('mint').notNull().unique(),
  name: text('name').notNull(),
  ticker: text('ticker').notNull().unique(),
  story: text('story').notNull(),
  inputText: text('input_text').notNull(),
  salt: integer('salt').notNull().default(0),
  spriteJson: jsonb('sprite_json').$type<FighterSpec>().notNull(),
  framesJson: jsonb('frames_json').$type<CustomFrames | null>(),
  archetype: text('archetype').notNull(),
  status: text('status').$type<CoinStatus>().notNull().default('launching'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  creatorWalletId: integer('creator_wallet_id').notNull(),
  tradingWalletId: integer('trading_wallet_id').notNull(),
  ownerKeyHash: text('owner_key_hash').notNull(),
  agentMode: text('agent_mode').$type<AgentMode>().notNull().default('burn'),
  splitBurnPct: integer('split_burn_pct').notNull().default(100),
  splitTradePct: integer('split_trade_pct').notNull().default(0),
  strategy: text('strategy').notNull().default('momentum'),
  profitRoute: text('profit_route').$type<ProfitRoute>().notNull().default('reinvest'),
  beneficiaryAddress: text('beneficiary_address'),
  level: integer('level').notNull().default(0),
  terminalJson: jsonb('terminal_json').$type<Personality>().notNull(),
  paused: boolean('paused').notNull().default(false),
  halted: boolean('halted').notNull().default(false),
  haltReason: text('halt_reason'),
  failCount: integer('fail_count').notNull().default(0),
  tradeLive: boolean('trade_live').notNull().default(false),
  tradingPausedUntil: timestamp('trading_paused_until', { withTimezone: true }),
  sleeping: boolean('sleeping').notNull().default(false),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }).notNull().defaultNow(),
  launchSig: text('launch_sig'),
  pairAddress: text('pair_address'),
});

export type LedgerKind =
  | 'fee_received' | 'allocated' | 'buyback' | 'burn' | 'trade_open' | 'trade_close' | 'withdraw' | 'network_fee' | 'launch';

export const ledger = pgTable('ledger', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  coinId: integer('coin_id').notNull(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  wallet: text('wallet').$type<'creator' | 'trading' | 'funder' | 'none'>().notNull(),
  kind: text('kind').$type<LedgerKind>().notNull(),
  solDeltaLamports: bigint('sol_delta_lamports', { mode: 'number' }).notNull().default(0),
  tokenDelta: numeric('token_delta').notNull().default('0'),
  txSig: text('tx_sig'),
  metaJson: jsonb('meta_json').$type<Record<string, unknown>>().notNull().default({}),
});

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  coinId: integer('coin_id').notNull(),
  tokenMint: text('token_mint').notNull(),
  tokenSymbol: text('token_symbol'),
  strategy: text('strategy').notNull(),
  dryRun: boolean('dry_run').notNull().default(true),
  entrySig: text('entry_sig'),
  entryPrice: doublePrecision('entry_price').notNull(),
  sizeLamports: bigint('size_lamports', { mode: 'number' }).notNull(),
  tokenAmount: numeric('token_amount').notNull().default('0'),
  tp: doublePrecision('tp').notNull(),
  sl: doublePrecision('sl').notNull(),
  trail: doublePrecision('trail'),
  peakPrice: doublePrecision('peak_price'),
  maxHoldMin: integer('max_hold_min').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  exitSig: text('exit_sig'),
  exitPrice: doublePrecision('exit_price'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  pnlLamports: bigint('pnl_lamports', { mode: 'number' }),
  reason: text('reason'),
});

export type EventType =
  | 'launched' | 'fee' | 'allocated' | 'buyback' | 'burn' | 'trade_open' | 'profit' | 'loss' | 'bonded' | 'level_up' | 'sleep' | 'wake';

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  coinId: integer('coin_id').notNull(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  type: text('type').$type<EventType>().notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
  txSig: text('tx_sig'),
});

export const milestones = pgTable('milestones', {
  coinId: integer('coin_id').notNull(),
  level: integer('level').notNull(),
  reachedAt: timestamp('reached_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.coinId, t.level] }) }));

export const rateLimits = pgTable('rate_limits', {
  key: text('key').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.key, t.windowStart] }) }));

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Coin = typeof coins.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type LedgerRow = typeof ledger.$inferSelect;
export type TradeRow = typeof trades.$inferSelect;
