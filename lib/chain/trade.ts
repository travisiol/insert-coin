/** Server-side transaction builders: PumpPortal (keyless local tx), Jupiter lite, SPL burn, SOL transfer. */
import {
  PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, ComputeBudgetProgram, type Keypair,
  type TransactionInstruction,
} from '@solana/web3.js';
import {
  createBurnCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { connection, sendAndConfirm, WSOL, TxError } from './rpc';

const PUMPPORTAL = 'https://pumpportal.fun/api/trade-local';
const JUP = 'https://lite-api.jup.ag/swap/v1';

export interface PumpPortalBody {
  publicKey: string;
  action: 'create' | 'buy' | 'sell' | 'collectCreatorFee';
  mint?: string;
  tokenMetadata?: { name: string; symbol: string; uri: string };
  denominatedInSol?: 'true' | 'false';
  amount?: number | string;
  slippage?: number;
  priorityFee: number;
  pool?: string;
}

export async function pumpPortalTx(body: PumpPortalBody): Promise<VersionedTransaction> {
  const res = await fetch(PUMPPORTAL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (res.status !== 200) {
    const text = (await res.text()).slice(0, 200);
    throw new TxError(`PumpPortal ${body.action} failed (${res.status}): ${text}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return VersionedTransaction.deserialize(bytes);
}

/** Simulate and return the payer's lamport change (used to skip tiny fee collections). */
export async function simulatePayerDelta(tx: VersionedTransaction, payer: PublicKey): Promise<number | null> {
  const c = connection();
  const before = await c.getBalance(payer, 'confirmed');
  const sim = await c.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: 'base64', addresses: [payer.toBase58()] },
  });
  if (sim.value.err) return null;
  const after = sim.value.accounts?.[0]?.lamports;
  return typeof after === 'number' ? after - before : null;
}

// ---------------- Jupiter ----------------
export interface JupQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  [k: string]: unknown;
}

export async function jupQuote(inputMint: string, outputMint: string, amount: bigint | number, slippageBps = 300): Promise<JupQuote | null> {
  const url = `${JUP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount.toString()}&slippageBps=${slippageBps}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const q = (await res.json()) as JupQuote & { error?: string };
  if (q.error || !q.outAmount) return null;
  return q;
}

export async function jupSwapTx(quote: JupQuote, user: PublicKey): Promise<VersionedTransaction> {
  const res = await fetch(`${JUP}/swap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: user.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new TxError(`Jupiter swap build failed (${res.status})`);
  const j = (await res.json()) as { swapTransaction?: string };
  if (!j.swapTransaction) throw new TxError('Jupiter returned no transaction');
  return VersionedTransaction.deserialize(Buffer.from(j.swapTransaction, 'base64'));
}

export async function jupSwap(quote: JupQuote, signer: Keypair): Promise<string> {
  const tx = await jupSwapTx(quote, signer.publicKey);
  tx.sign([signer]);
  return sendAndConfirm(tx);
}

/** Round trip check: buy then sell back must both route, with total loss under maxLoss. */
export async function honeypotCheck(mint: string, lamports: number, maxLoss = 0.15): Promise<{ ok: boolean; reason: string; buy?: JupQuote }> {
  const buy = await jupQuote(WSOL, mint, lamports, 500);
  if (!buy) return { ok: false, reason: 'no buy route' };
  const sell = await jupQuote(mint, WSOL, BigInt(buy.outAmount), 500);
  if (!sell) return { ok: false, reason: 'no sell route' };
  const back = Number(sell.outAmount);
  const loss = 1 - back / lamports;
  if (loss > maxLoss) return { ok: false, reason: `round trip loses ${(loss * 100).toFixed(1)}%` };
  return { ok: true, reason: 'ok', buy };
}

// ---------------- simple instructions ----------------
async function v0(payer: PublicKey, ixs: TransactionInstruction[]) {
  const { blockhash } = await connection().getLatestBlockhash('confirmed');
  return new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
}

export async function transferSol(from: Keypair, to: PublicKey, lamports: number): Promise<string> {
  const tx = await v0(from.publicKey, [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 2_000 }),
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports }),
  ]);
  tx.sign([from]);
  return sendAndConfirm(tx);
}

export async function tokenProgramOf(mint: PublicKey): Promise<PublicKey> {
  const info = await connection().getAccountInfo(mint, 'confirmed');
  if (!info) throw new TxError('mint not found');
  return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/** Burn exactly `amount` raw units of `mint` held by `owner`. */
export async function burnExact(owner: Keypair, mint: PublicKey, amount: bigint, decimals: number): Promise<string> {
  const programId = await tokenProgramOf(mint);
  const ata = getAssociatedTokenAddressSync(mint, owner.publicKey, false, programId);
  const tx = await v0(owner.publicKey, [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 30_000 }),
    createBurnCheckedInstruction(ata, mint, owner.publicKey, amount, decimals, [], programId),
  ]);
  tx.sign([owner]);
  return sendAndConfirm(tx);
}

export async function ataExists(owner: PublicKey, mint: PublicKey): Promise<boolean> {
  const programId = await tokenProgramOf(mint);
  const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
  return !!(await connection().getAccountInfo(ata, 'confirmed'));
}

export async function tokenBalanceRaw(owner: PublicKey, mint: PublicKey): Promise<bigint> {
  const programId = await tokenProgramOf(mint);
  const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
  try {
    const b = await connection().getTokenAccountBalance(ata, 'confirmed');
    return BigInt(b.value.amount);
  } catch {
    return 0n;
  }
}

export { WSOL };
