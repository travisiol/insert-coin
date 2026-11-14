/** Append-only ledger + event writers. Only called after on-chain confirmation. */
import { PublicKey } from '@solana/web3.js';
import { eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { txEffect, type TxEffect } from '../chain/rpc';
import type { EventType, LedgerKind } from '../db/schema';

type WalletKind = 'creator' | 'trading' | 'funder' | 'none';

export async function ledgerEntry(
  coinId: number, wallet: WalletKind, kind: LedgerKind, solDelta: number, txSig: string | null,
  meta: Record<string, unknown> = {}, tokenDelta = '0',
) {
  const db = await getDb();
  await db.insert(schema.ledger).values({
    coinId, wallet, kind, solDeltaLamports: Math.round(solDelta), tokenDelta, txSig, metaJson: meta,
  });
}

/**
 * Record the exact SOL effect of a confirmed tx on one agent wallet:
 * one entry for the action (delta excluding the network fee) and one network_fee entry.
 * The wallet must be the fee payer.
 */
export async function ledgerFromTx(
  coinId: number, wallet: WalletKind, owner: PublicKey, kind: LedgerKind, sig: string,
  opts: { mint?: string; meta?: Record<string, unknown>; tokenKind?: 'ui' } = {},
): Promise<TxEffect> {
  const eff = await txEffect(sig, owner, opts.mint);
  const actionDelta = eff.solDelta + eff.fee;
  const tokenUi = opts.mint ? (Number(eff.tokenDelta) / 10 ** eff.decimals).toString() : '0';
  await ledgerEntry(coinId, wallet, kind, actionDelta, sig, opts.meta ?? {}, tokenUi);
  await ledgerEntry(coinId, wallet, 'network_fee', -eff.fee, sig, { for: kind });
  return eff;
}

export async function recordEvent(coinId: number, type: EventType, payload: Record<string, unknown> = {}, txSig: string | null = null) {
  const db = await getDb();
  const [coin] = await db.select({ sleeping: schema.coins.sleeping }).from(schema.coins).where(eq(schema.coins.id, coinId));
  if (coin?.sleeping && type !== 'sleep') {
    await db.insert(schema.events).values({ coinId, type: 'wake', payloadJson: {}, txSig: null });
    await db.update(schema.coins).set({ sleeping: false }).where(eq(schema.coins.id, coinId));
  }
  await db.insert(schema.events).values({ coinId, type, payloadJson: payload, txSig });
  if (type === 'sleep') await db.update(schema.coins).set({ sleeping: true }).where(eq(schema.coins.id, coinId));
  else await db.update(schema.coins).set({ lastEventAt: sql`now()` }).where(eq(schema.coins.id, coinId));
}

export async function ledgerSum(coinId: number, wallet: WalletKind): Promise<number> {
  const db = await getDb();
  const [r] = await db
    .select({ s: sql<string>`coalesce(sum(${schema.ledger.solDeltaLamports}), 0)` })
    .from(schema.ledger)
    .where(sql`${schema.ledger.coinId} = ${coinId} and ${schema.ledger.wallet} = ${wallet}`);
  return Number(r?.s ?? 0);
}

/** SOL earmarked for buyback that has not been spent yet (lamports). */
export async function burnBudget(coinId: number): Promise<number> {
  const db = await getDb();
  const [r] = await db
    .select({
      alloc: sql<string>`coalesce(sum(case when ${schema.ledger.kind} = 'allocated' and ${schema.ledger.metaJson}->>'to' = 'burn' then (${schema.ledger.metaJson}->>'lamports')::bigint else 0 end), 0)`,
      spent: sql<string>`coalesce(sum(case when ${schema.ledger.kind} = 'buyback' and ${schema.ledger.wallet} = 'creator' then -${schema.ledger.solDeltaLamports} else 0 end), 0)`,
    })
    .from(schema.ledger)
    .where(eq(schema.ledger.coinId, coinId));
  return Math.max(0, Number(r?.alloc ?? 0) - Number(r?.spent ?? 0));
}
