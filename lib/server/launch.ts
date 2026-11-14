/** Custodial launch: server wallets, funder pays, PumpPortal builds, we sign. */
import { Keypair, PublicKey } from '@solana/web3.js';
import { eq, sql } from 'drizzle-orm';
import { getDb, schema, q } from '../db';
import { sendAndConfirm, LAMPORTS, txEffect } from '../chain/rpc';
import { pumpPortalTx, transferSol } from '../chain/trade';
import { createWallet, funderKeypair, newOwnerKey } from './secrets';
import { ledgerEntry, ledgerFromTx, recordEvent } from '../agent/record';
import type { FighterSpec, CustomFrames } from '../engine/types';
import type { Personality } from '../engine/personality';
import type { AgentMode, ProfitRoute } from '../db/schema';

export const LAUNCH_FUNDING_LAMPORTS = 30_000_000; // 0.03 SOL: rent + fees, the remainder is the agent's network-fee reserve
export const DAILY_FUNDER_BUDGET_LAMPORTS = 1 * LAMPORTS;
export const MAX_LAUNCHES_PER_DAY = 30;
export const MAX_LAUNCHES_PER_IP_HOUR = 3;

export interface LaunchInput {
  input: string;
  salt: number;
  name: string;
  ticker: string;
  story: string;
  spec: FighterSpec;
  frames: CustomFrames | null;
  personality: Personality;
  agentMode: AgentMode;
  splitBurnPct: number;
  strategy: string;
  profitRoute: ProfitRoute;
  beneficiary: string | null;
  twitter: string | null;
}

export type LaunchStep = 'UPLOADING' | 'CREATING WALLETS' | 'LAUNCHING ON PUMP.FUN' | 'CONFIRMED' | 'LIVE';

export async function funderSpentToday(): Promise<number> {
  const [r] = await q<{ s: string }>(sql`
    select coalesce(-sum(sol_delta_lamports), 0) as s from ledger
    where wallet = 'funder' and ts >= date_trunc('day', now() at time zone 'utc')`);
  return Number(r?.s ?? 0);
}

export async function tickerTaken(ticker: string): Promise<boolean> {
  const rows = await q(sql`select 1 from coins where upper(ticker) = upper(${ticker}) and status <> 'failed' limit 1`);
  return rows.length > 0;
}

export async function launch(
  i: LaunchInput, origin: string, step: (s: LaunchStep) => void,
): Promise<{ mint: string; ticker: string; ownerKey: string; sig: string }> {
  const db = await getDb();
  step('UPLOADING');
  const mintKp = Keypair.generate(); // server memory only, discarded when this function returns
  const mint = mintKp.publicKey.toBase58();
  const owner = newOwnerKey();
  // Failed launches free their ticker by renaming the stale row.
  await q(sql`update coins set ticker = ticker || '_' || id where upper(ticker) = upper(${i.ticker}) and status = 'failed'`);

  step('CREATING WALLETS');
  const creator = await createWallet('creator');
  const trading = await createWallet('trading');
  const [coin] = await db.insert(schema.coins).values({
    mint, name: i.name, ticker: i.ticker, story: i.story, inputText: i.input, salt: i.salt,
    spriteJson: i.spec, framesJson: i.frames, archetype: i.spec.archetype, status: 'launching',
    creatorWalletId: creator.id, tradingWalletId: trading.id, ownerKeyHash: owner.hash,
    agentMode: i.agentMode, splitBurnPct: i.splitBurnPct, splitTradePct: 100 - i.splitBurnPct, strategy: i.strategy,
    profitRoute: i.profitRoute, beneficiaryAddress: i.beneficiary, terminalJson: i.personality,
  }).returning({ id: schema.coins.id });

  try {
    // metadata is served by /api/meta/<mint> from the row above, so the URI resolves before the coin exists
    const funder = funderKeypair();
    const fundSig = await transferSol(funder, creator.keypair.publicKey, LAUNCH_FUNDING_LAMPORTS);
    const fundEff = await txEffect(fundSig, funder.publicKey);
    await ledgerEntry(coin.id, 'funder', 'launch', fundEff.solDelta, fundSig, { funding: true });
    await ledgerEntry(coin.id, 'creator', 'launch', LAUNCH_FUNDING_LAMPORTS, fundSig, { from: 'funder' });

    step('LAUNCHING ON PUMP.FUN');
    const tx = await pumpPortalTx({
      publicKey: creator.keypair.publicKey.toBase58(),
      action: 'create',
      tokenMetadata: { name: i.name, symbol: i.ticker, uri: `${origin}/api/meta/${mint}` },
      mint,
      denominatedInSol: 'true',
      amount: 0,
      slippage: 10,
      priorityFee: 0.0005,
      pool: 'pump',
    });
    tx.sign([mintKp, creator.keypair]);
    const sig = await sendAndConfirm(tx);
    step('CONFIRMED');
    await ledgerFromTx(coin.id, 'creator', creator.keypair.publicKey, 'launch', sig, { meta: { create: true } });
    await db.update(schema.coins).set({ status: 'live', launchSig: sig }).where(eq(schema.coins.id, coin.id));
    await recordEvent(coin.id, 'launched', { mint }, sig);
    step('LIVE');
    return { mint, ticker: i.ticker, ownerKey: owner.key, sig };
  } catch (e) {
    await db.update(schema.coins).set({ status: 'failed' }).where(eq(schema.coins.id, coin.id));
    throw e;
  }
}

export { PublicKey };
