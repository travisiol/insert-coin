/**
 * One agent tick for one coin. Called by the worker every 60 s.
 * Order: emergency stop -> reconciliation -> fees -> allocation -> buyback & burn -> trading -> bonding/sleep/levels.
 * Every on-chain action is recorded only after confirmation.
 */
import { PublicKey } from '@solana/web3.js';
import { and, eq, isNull, sql, desc } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Coin } from '../db/schema';
import { balance, sendAndConfirm, TxError, LAMPORTS, WSOL } from '../chain/rpc';
import {
  pumpPortalTx, simulatePayerDelta, jupQuote, jupSwap, burnExact, tokenBalanceRaw, transferSol, honeypotCheck, tokenProgramOf,
  ataExists,
} from '../chain/trade';
import { loadKeypair } from '../server/secrets';
import { pairsFor, candidateMints, isBonded, type DexPair } from '../market';
import { ledgerFromTx, ledgerEntry, recordEvent, ledgerSum, burnBudget } from './record';
import { STRATEGIES, MAX_OPEN_POSITIONS, DAILY_LOSS_LIMIT, type StrategyId } from './strategies';

export const NETWORK_RESERVE = 2_000_000; // 0.002 SOL kept for network fees
const MIN_COLLECT = 2_000_000; // skip fee collection under 0.002 SOL
const MIN_BURN = 1_000_000; // 0.001 SOL
const MIN_TRADE = 2_000_000;
const ATA_RENT = 2_100_000;
const PRICE_IMPACT_CAP = 0.02;
const RECON_TOLERANCE = 10_000;
const SLEEP_AFTER_MS = 72 * 3600_000;
const STABLES = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJrF5ZhkJ2Hc7ZGkiC4dQi6YRxL2Qc3s', // USDT
  WSOL,
]);

export interface TickContext {
  log: (msg: string) => void;
  candidatePairs?: DexPair[]; // shared per loop
}

async function setCoin(id: number, patch: Partial<typeof schema.coins.$inferInsert>) {
  const db = await getDb();
  await db.update(schema.coins).set(patch).where(eq(schema.coins.id, id));
}

async function halt(coin: Coin, reason: string, ctx: TickContext) {
  ctx.log(`[${coin.ticker}] HALT: ${reason}`);
  await setCoin(coin.id, { halted: true, haltReason: reason });
}

async function guard<T>(coin: Coin, ctx: TickContext, label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn();
    if (coin.failCount > 0) {
      coin.failCount = 0;
      await setCoin(coin.id, { failCount: 0 });
    }
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.log(`[${coin.ticker}] ${label} failed: ${msg}`);
    if (e instanceof TxError) {
      coin.failCount += 1;
      await setCoin(coin.id, { failCount: coin.failCount });
      if (coin.failCount >= 3) await halt(coin, `3 consecutive failed transactions (last: ${label})`, ctx);
    }
    return null;
  }
}

export async function emergencyStop(): Promise<boolean> {
  const db = await getDb();
  const [r] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'emergency_stop'));
  return r?.value === 'true';
}

/** Ledger vs chain. Any mismatch halts the agent. */
async function reconcile(coin: Coin, creator: PublicKey, trading: PublicKey, ctx: TickContext): Promise<boolean> {
  for (const [kind, pk] of [['creator', creator], ['trading', trading]] as const) {
    const onChain = await balance(pk);
    const books = await ledgerSum(coin.id, kind);
    if (Math.abs(onChain - books) > RECON_TOLERANCE) {
      await halt(coin, `ledger mismatch on ${kind} wallet: chain ${onChain} vs ledger ${books} lamports`, ctx);
      return false;
    }
  }
  return true;
}

// ---------------- 1 + 2: fees and allocation ----------------
async function collectFees(coin: Coin, ctx: TickContext, bonded: boolean) {
  const creator = await loadKeypair(coin.creatorWalletId);
  const pools = bonded ? ['pump-amm', 'pump'] : ['pump'];
  for (const pool of pools) {
    let tx;
    try {
      tx = await pumpPortalTx({ publicKey: creator.publicKey.toBase58(), action: 'collectCreatorFee', priorityFee: 0.000005, pool });
    } catch (e) {
      ctx.log(`[${coin.ticker}] collect (${pool}) unavailable: ${(e as Error).message}`);
      continue;
    }
    const delta = await simulatePayerDelta(tx, creator.publicKey);
    if (delta === null || delta < MIN_COLLECT) continue;
    tx.sign([creator]);
    const sig = await sendAndConfirm(tx);
    const eff = await ledgerFromTx(coin.id, 'creator', creator.publicKey, 'fee_received', sig, { meta: { pool } });
    const gross = eff.solDelta + eff.fee;
    await recordEvent(coin.id, 'fee', { lamports: gross }, sig);
    ctx.log(`[${coin.ticker}] fees +${gross / LAMPORTS} SOL`);
    await allocate(coin, eff.solDelta, ctx);
  }
}

async function allocate(coin: Coin, net: number, ctx: TickContext) {
  if (net <= 0) return;
  const burnPct = coin.agentMode === 'burn' ? 100 : coin.agentMode === 'trade' ? 0 : coin.splitBurnPct;
  let burnPart = Math.floor((net * burnPct) / 100);
  let tradePart = net - burnPart;
  if (tradePart > 0 && tradePart < MIN_TRADE) {
    // too small to move: keep it with the burn budget
    burnPart += tradePart;
    tradePart = 0;
  }
  if (burnPart > 0) {
    await ledgerEntry(coin.id, 'creator', 'allocated', 0, null, { to: 'burn', lamports: burnPart });
  }
  if (tradePart > 0) {
    const creator = await loadKeypair(coin.creatorWalletId);
    const trading = await loadKeypair(coin.tradingWalletId);
    const sig = await transferSol(creator, trading.publicKey, tradePart);
    await ledgerFromTx(coin.id, 'creator', creator.publicKey, 'allocated', sig, { meta: { to: 'trade', lamports: tradePart } });
    await ledgerEntry(coin.id, 'trading', 'allocated', tradePart, sig, { from: 'creator' });
  }
  await recordEvent(coin.id, 'allocated', { burn: burnPart, trade: tradePart });
  ctx.log(`[${coin.ticker}] allocated burn ${burnPart} / trade ${tradePart}`);
}

// ---------------- 3: buyback & burn ----------------
async function burnPending(coin: Coin, ctx: TickContext) {
  const creator = await loadKeypair(coin.creatorWalletId);
  const mint = new PublicKey(coin.mint);
  const pending = await tokenBalanceRaw(creator.publicKey, mint);
  if (pending <= 0n) return;
  const decimals = (await mintDecimals(mint)) ?? 6;
  const sig = await burnExact(creator, mint, pending, decimals);
  const eff = await ledgerFromTx(coin.id, 'creator', creator.publicKey, 'burn', sig, { mint: coin.mint });
  const tokens = Math.abs(Number(eff.tokenDelta)) / 10 ** eff.decimals;
  await recordEvent(coin.id, 'burn', { tokens }, sig);
  ctx.log(`[${coin.ticker}] burned ${tokens}`);
}

async function mintDecimals(mint: PublicKey): Promise<number | null> {
  const { connection } = await import('../chain/rpc');
  const info = await connection().getParsedAccountInfo(mint, 'confirmed');
  const data = info.value?.data as { parsed?: { info?: { decimals?: number } } } | undefined;
  return data?.parsed?.info?.decimals ?? null;
}

async function buyback(coin: Coin, pair: DexPair | undefined, bonded: boolean, ctx: TickContext) {
  const creator = await loadKeypair(coin.creatorWalletId);
  const budget = await burnBudget(coin.id);
  const bal = await balance(creator.publicKey);
  const hasAta = await ataExists(creator.publicKey, new PublicKey(coin.mint));
  const spendable = Math.min(budget, bal - NETWORK_RESERVE - (hasAta ? 0 : ATA_RENT));
  if (spendable < MIN_BURN) return;

  let sig: string;
  if (!bonded) {
    // constant-product curve: impact ~ a / (reserve + a). Keep it under 2% per chunk.
    const reserveSol = (pair?.liquidity?.quote ?? 0) + 30;
    const chunk = Math.min(spendable, Math.floor(reserveSol * 0.0204 * LAMPORTS));
    const tx = await pumpPortalTx({
      publicKey: creator.publicKey.toBase58(), action: 'buy', mint: coin.mint, denominatedInSol: 'true',
      amount: chunk / LAMPORTS, slippage: 5, priorityFee: 0.0001, pool: 'pump',
    });
    tx.sign([creator]);
    sig = await sendAndConfirm(tx);
  } else {
    let amount = spendable;
    let q = await jupQuote(WSOL, coin.mint, amount, 200);
    while (q && Number(q.priceImpactPct) > PRICE_IMPACT_CAP && amount / 2 >= MIN_BURN) {
      amount = Math.floor(amount / 2);
      q = await jupQuote(WSOL, coin.mint, amount, 200);
    }
    if (!q || Number(q.priceImpactPct) > PRICE_IMPACT_CAP) {
      ctx.log(`[${coin.ticker}] buyback skipped: price impact above cap`);
      return;
    }
    sig = await jupSwap(q, creator);
  }
  const eff = await ledgerFromTx(coin.id, 'creator', creator.publicKey, 'buyback', sig, { mint: coin.mint });
  const tokens = Number(eff.tokenDelta) / 10 ** eff.decimals;
  await recordEvent(coin.id, 'buyback', { tokens, lamports: -(eff.solDelta + eff.fee) }, sig);
  ctx.log(`[${coin.ticker}] bought back ${tokens}`);
  // burn exactly what was bought
  if (eff.tokenDelta > 0n) {
    const bsig = await burnExact(creator, new PublicKey(coin.mint), eff.tokenDelta, eff.decimals);
    const beff = await ledgerFromTx(coin.id, 'creator', creator.publicKey, 'burn', bsig, { mint: coin.mint });
    const burned = Math.abs(Number(beff.tokenDelta)) / 10 ** beff.decimals;
    await recordEvent(coin.id, 'burn', { tokens: burned }, bsig);
  }
}

// ---------------- 4: trading ----------------
function nextUtcMidnight(): Date {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

async function manageTrades(coin: Coin, ctx: TickContext) {
  const db = await getDb();
  const trading = await loadKeypair(coin.tradingWalletId);
  const open = await db.select().from(schema.trades).where(and(eq(schema.trades.coinId, coin.id), isNull(schema.trades.closedAt)));
  const prices = await pairsFor(open.map((t) => t.tokenMint), 30);

  // exits
  for (const t of open) {
    const p = prices[t.tokenMint];
    const price = Number(p?.priceNative ?? 0);
    if (!price) continue;
    const peak = Math.max(t.peakPrice ?? t.entryPrice, price);
    const change = price / t.entryPrice - 1;
    const heldMin = (Date.now() - new Date(t.openedAt).getTime()) / 60000;
    let reason: string | null = null;
    if (change >= t.tp) reason = 'take-profit';
    else if (change <= -t.sl) reason = 'stop-loss';
    else if (t.trail && price <= peak * (1 - t.trail) && price > t.entryPrice) reason = 'trailing stop';
    else if (heldMin >= t.maxHoldMin) reason = 'max hold';
    if (!reason) {
      if (peak !== t.peakPrice) await db.update(schema.trades).set({ peakPrice: peak }).where(eq(schema.trades.id, t.id));
      continue;
    }
    if (t.dryRun) {
      const pnl = Math.round(t.sizeLamports * change);
      await db.update(schema.trades).set({ exitPrice: price, closedAt: new Date(), pnlLamports: pnl, reason, peakPrice: peak }).where(eq(schema.trades.id, t.id));
      ctx.log(`[${coin.ticker}] DRY RUN close ${t.tokenSymbol} ${reason} ${(change * 100).toFixed(1)}%`);
      continue;
    }
    const amount = BigInt(String(t.tokenAmount).split('.')[0]);
    const q = await jupQuote(t.tokenMint, WSOL, amount, 500);
    if (!q) throw new TxError(`no sell route for ${t.tokenSymbol}`);
    const sig = await jupSwap(q, trading);
    const eff = await ledgerFromTx(coin.id, 'trading', trading.publicKey, 'trade_close', sig, { mint: t.tokenMint, meta: { tradeId: t.id, reason } });
    const received = eff.solDelta + eff.fee;
    const pnl = received - t.sizeLamports;
    await db.update(schema.trades).set({ exitSig: sig, exitPrice: price, closedAt: new Date(), pnlLamports: pnl, reason, peakPrice: peak }).where(eq(schema.trades.id, t.id));
    await recordEvent(coin.id, pnl >= 0 ? 'profit' : 'loss', { lamports: pnl, symbol: t.tokenSymbol, reason }, sig);
    if (pnl > MIN_TRADE) await routeProfit(coin, pnl, ctx);
  }

  // daily loss limit
  const [today] = await db
    .select({ s: sql<string>`coalesce(sum(${schema.trades.pnlLamports}), 0)` })
    .from(schema.trades)
    .where(sql`${schema.trades.coinId} = ${coin.id} and ${schema.trades.dryRun} = false and ${schema.trades.closedAt} >= date_trunc('day', now() at time zone 'utc')`);
  const todayPnl = Number(today?.s ?? 0);
  const tradingBal = await balance(trading.publicKey);
  const startBal = tradingBal - todayPnl;
  if (startBal > 0 && todayPnl < -DAILY_LOSS_LIMIT * startBal) {
    await setCoin(coin.id, { tradingPausedUntil: nextUtcMidnight() });
    ctx.log(`[${coin.ticker}] daily loss limit hit, trading paused until 00:00 UTC`);
    return;
  }

  // entries
  const stillOpen = open.length - 0;
  if (stillOpen >= MAX_OPEN_POSITIONS) return;
  const strat = STRATEGIES[(coin.strategy as StrategyId)] ?? STRATEGIES.momentum;
  const spendable = tradingBal - NETWORK_RESERVE - ATA_RENT;
  const size = Math.floor(Math.max(0, spendable) * strat.maxSize);
  const paperSize = coin.tradeLive ? size : Math.max(size, 50_000_000); // dry-run sizes are notional
  if (coin.tradeLive && size < MIN_TRADE) return;
  const openMints = new Set(open.map((t) => t.tokenMint));
  for (const p of ctx.candidatePairs ?? []) {
    const mint = p.baseToken.address;
    if (mint === coin.mint || STABLES.has(mint) || openMints.has(mint)) continue;
    if (p.quoteToken.address !== WSOL) continue;
    if ((p.liquidity?.usd ?? 0) < strat.minLiquidity) continue;
    const verdict = strat.test(p);
    if (!verdict.ok) continue;
    const hp = await honeypotCheck(mint, coin.tradeLive ? size : 10_000_000);
    if (!hp.ok) { ctx.log(`[${coin.ticker}] skip ${p.baseToken.symbol}: ${hp.reason}`); continue; }
    const entryPrice = Number(p.priceNative ?? 0);
    if (!entryPrice) continue;
    if (!coin.tradeLive) {
      await db.insert(schema.trades).values({
        coinId: coin.id, tokenMint: mint, tokenSymbol: p.baseToken.symbol, strategy: strat.id, dryRun: true,
        entryPrice, sizeLamports: paperSize, tp: strat.tp, sl: strat.sl, trail: strat.trail, peakPrice: entryPrice, maxHoldMin: strat.maxHoldMin,
        reason: verdict.reason,
      });
      ctx.log(`[${coin.ticker}] DRY RUN signal ${strat.label} on ${p.baseToken.symbol}: ${verdict.reason}`);
      return;
    }
    const q = await jupQuote(WSOL, mint, size, 500);
    if (!q) continue;
    const sig = await jupSwap(q, trading);
    const eff = await ledgerFromTx(coin.id, 'trading', trading.publicKey, 'trade_open', sig, { mint, meta: { strategy: strat.id } });
    await db.insert(schema.trades).values({
      coinId: coin.id, tokenMint: mint, tokenSymbol: p.baseToken.symbol, strategy: strat.id, dryRun: false, entrySig: sig,
      entryPrice, sizeLamports: -(eff.solDelta + eff.fee), tokenAmount: eff.tokenDelta.toString(),
      tp: strat.tp, sl: strat.sl, trail: strat.trail, peakPrice: entryPrice, maxHoldMin: strat.maxHoldMin, reason: verdict.reason,
    });
    await recordEvent(coin.id, 'trade_open', { strategy: strat.label, symbol: p.baseToken.symbol, lamports: -(eff.solDelta + eff.fee) }, sig);
    return;
  }
}

async function routeProfit(coin: Coin, pnl: number, ctx: TickContext) {
  if (coin.profitRoute === 'reinvest') return;
  const trading = await loadKeypair(coin.tradingWalletId);
  if (coin.profitRoute === 'burn') {
    const creator = await loadKeypair(coin.creatorWalletId);
    const sig = await transferSol(trading, creator.publicKey, pnl);
    await ledgerFromTx(coin.id, 'trading', trading.publicKey, 'withdraw', sig, { meta: { to: 'creator', purpose: 'burn' } });
    await ledgerEntry(coin.id, 'creator', 'allocated', pnl, sig, { to: 'burn', lamports: pnl, from: 'trading profit' });
    ctx.log(`[${coin.ticker}] profit routed to burn`);
  } else if (coin.profitRoute === 'beneficiary' && coin.beneficiaryAddress) {
    const sig = await transferSol(trading, new PublicKey(coin.beneficiaryAddress), pnl);
    await ledgerFromTx(coin.id, 'trading', trading.publicKey, 'withdraw', sig, { meta: { to: coin.beneficiaryAddress, purpose: 'beneficiary' } });
    ctx.log(`[${coin.ticker}] profit sent to beneficiary`);
  }
}

// ---------------- 6 + 7: bonding, sleep, levels ----------------
async function lifecycle(coin: Coin, pair: DexPair | undefined, ctx: TickContext) {
  const db = await getDb();
  if (pair && !coin.pairAddress) await setCoin(coin.id, { pairAddress: pair.pairAddress });
  if (coin.status === 'live' && isBonded(pair)) {
    await setCoin(coin.id, { status: 'bonded', pairAddress: pair!.pairAddress });
    coin.status = 'bonded';
    await recordEvent(coin.id, 'bonded', { dex: pair!.dexId });
    ctx.log(`[${coin.ticker}] BONDED`);
  }
  if (!coin.sleeping && Date.now() - new Date(coin.lastEventAt).getTime() > SLEEP_AFTER_MS) {
    await recordEvent(coin.id, 'sleep', {});
  }
  // levels
  const [stats] = await db
    .select({
      actions: sql<string>`count(*) filter (where ${schema.events.type} in ('fee','buyback','burn','trade_open','profit','loss'))`,
    })
    .from(schema.events)
    .where(eq(schema.events.coinId, coin.id));
  const [burned] = await db
    .select({ t: sql<string>`coalesce(-sum(${schema.ledger.tokenDelta}) filter (where ${schema.ledger.kind} = 'burn'), 0)` })
    .from(schema.ledger)
    .where(eq(schema.ledger.coinId, coin.id));
  const actions = Number(stats?.actions ?? 0);
  const burnedTokens = Number(burned?.t ?? 0);
  const mcap = pair?.marketCap ?? pair?.fdv ?? 0;
  let level = 0;
  if (actions >= 1) level = 1;
  if (mcap >= 25_000 || actions >= 50) level = Math.max(level, 2);
  if (coin.status === 'bonded') level = Math.max(level, 3);
  if (mcap >= 250_000 || burnedTokens >= 10_000_000) level = 4;
  if (level > coin.level) {
    for (let l = coin.level + 1; l <= level; l++) {
      await db.insert(schema.milestones).values({ coinId: coin.id, level: l }).onConflictDoNothing();
    }
    await setCoin(coin.id, { level });
    await recordEvent(coin.id, 'level_up', { level });
    ctx.log(`[${coin.ticker}] LEVEL ${level}`);
  }
}

export async function tickCoin(coin: Coin, pair: DexPair | undefined, ctx: TickContext) {
  const db = await getDb();
  const [cw] = await db.select({ pk: schema.wallets.pubkey }).from(schema.wallets).where(eq(schema.wallets.id, coin.creatorWalletId));
  const [tw] = await db.select({ pk: schema.wallets.pubkey }).from(schema.wallets).where(eq(schema.wallets.id, coin.tradingWalletId));
  const creatorPk = new PublicKey(cw.pk);
  const tradingPk = new PublicKey(tw.pk);
  const bonded = coin.status === 'bonded' || isBonded(pair);

  if (!coin.paused && !coin.halted) {
    const ok = await reconcile(coin, creatorPk, tradingPk, ctx);
    if (ok) {
      await guard(coin, ctx, 'burn pending', () => burnPending(coin, ctx));
      if (!coin.halted) await guard(coin, ctx, 'fees', () => collectFees(coin, ctx, bonded));
      if (!coin.halted && coin.agentMode !== 'trade') await guard(coin, ctx, 'buyback', () => buyback(coin, pair, bonded, ctx));
      const tradingPaused = coin.tradingPausedUntil && new Date(coin.tradingPausedUntil) > new Date();
      if (!coin.halted && coin.agentMode !== 'burn' && !tradingPaused) await guard(coin, ctx, 'trading', () => manageTrades(coin, ctx));
    }
  }
  await guard(coin, ctx, 'lifecycle', () => lifecycle(coin, pair, ctx));
}

export async function loadCandidates(): Promise<DexPair[]> {
  const mints = await candidateMints();
  const pairs = await pairsFor(mints.slice(0, 120), 60);
  return Object.values(pairs);
}

export async function activeCoins(): Promise<Coin[]> {
  const db = await getDb();
  return db.select().from(schema.coins).where(sql`${schema.coins.status} in ('live','bonded')`).orderBy(desc(schema.coins.id));
}

export { tokenProgramOf };
