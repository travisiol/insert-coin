import {
  Connection, PublicKey, VersionedTransaction, Transaction, type Keypair, type Commitment,
} from '@solana/web3.js';

export const RPC_URL = 'https://api.mainnet-beta.solana.com';
export const LAMPORTS = 1_000_000_000;
export const WSOL = 'So11111111111111111111111111111111111111112';

// ---- request queue: max 8 req/s, exponential backoff on 429/5xx ----
const MAX_PER_SEC = 8;
let stamps: number[] = [];
async function slot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    stamps = stamps.filter((t) => now - t < 1000);
    if (stamps.length < MAX_PER_SEC) {
      stamps.push(now);
      return;
    }
    await sleep(1000 - (now - stamps[0]) + 5);
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const queuedFetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  let delay = 500;
  for (let attempt = 0; ; attempt++) {
    await slot();
    try {
      const res = await fetch(input, init);
      if ((res.status === 429 || res.status >= 500) && attempt < 5) {
        await sleep(delay);
        delay *= 2;
        continue;
      }
      return res;
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
};

let conn: Connection | null = null;
export function connection(): Connection {
  if (!conn) {
    conn = new Connection(RPC_URL, {
      commitment: 'confirmed',
      fetch: queuedFetch as unknown as typeof fetch,
      disableRetryOnRateLimit: true,
    });
  }
  return conn;
}

export class TxError extends Error {
  constructor(message: string, public sig?: string) {
    super(message);
  }
}

/** Send a signed transaction, rebroadcast until confirmed or expired. */
export async function sendAndConfirm(tx: VersionedTransaction | Transaction, commitment: Commitment = 'confirmed'): Promise<string> {
  const c = connection();
  const raw = tx.serialize();
  const sig = await c.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  const start = Date.now();
  while (Date.now() - start < 75_000) {
    const st = await c.getSignatureStatuses([sig]);
    const s = st.value[0];
    if (s?.err) throw new TxError(`transaction failed: ${JSON.stringify(s.err)}`, sig);
    if (s && (s.confirmationStatus === commitment || s.confirmationStatus === 'finalized')) return sig;
    await sleep(2000);
    try {
      await c.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });
    } catch {
      /* already processed or expired */
    }
  }
  throw new TxError('confirmation timeout', sig);
}

export function signVersioned(tx: VersionedTransaction, signers: Keypair[]): VersionedTransaction {
  tx.sign(signers);
  return tx;
}

export interface TxEffect {
  fee: number;
  solDelta: number; // lamports, for the given owner (fee included)
  tokenDelta: bigint; // raw units for the given mint+owner
  decimals: number;
}

/** Exact balance effect of a confirmed transaction for one wallet (and optionally one mint). */
export async function txEffect(sig: string, owner: PublicKey, mint?: string): Promise<TxEffect> {
  const c = connection();
  let tx = null;
  for (let i = 0; i < 10 && !tx; i++) {
    tx = await c.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    if (!tx) await sleep(1500);
  }
  if (!tx || !tx.meta) throw new TxError('transaction not found', sig);
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses ?? undefined });
  let idx = -1;
  for (let i = 0; i < keys.length; i++) if (keys.get(i)?.equals(owner)) idx = i;
  const solDelta = idx >= 0 ? tx.meta.postBalances[idx] - tx.meta.preBalances[idx] : 0;
  let tokenDelta = 0n;
  let decimals = 6;
  if (mint) {
    const o = owner.toBase58();
    const pre = tx.meta.preTokenBalances?.find((b) => b.mint === mint && b.owner === o);
    const post = tx.meta.postTokenBalances?.find((b) => b.mint === mint && b.owner === o);
    decimals = post?.uiTokenAmount.decimals ?? pre?.uiTokenAmount.decimals ?? 6;
    tokenDelta = BigInt(post?.uiTokenAmount.amount ?? '0') - BigInt(pre?.uiTokenAmount.amount ?? '0');
  }
  return { fee: tx.meta.fee, solDelta, tokenDelta, decimals };
}

export async function balance(pk: PublicKey): Promise<number> {
  return connection().getBalance(pk, 'confirmed');
}

export function isAddress(s: string): boolean {
  try {
    new PublicKey(s);
    return s.length >= 32 && s.length <= 44;
  } catch {
    return false;
  }
}

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;
