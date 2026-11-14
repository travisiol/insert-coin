/**
 * Server secrets. Only 3 env values exist: DATABASE_URL, WALLET_ENCRYPTION_KEY, FUNDER_WALLET_SECRET.
 * Nothing here is ever logged or returned by an API.
 */
import crypto from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';

function encryptionKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY;
  if (!raw) throw new Error('WALLET_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('WALLET_ENCRYPTION_KEY must be 32 bytes, base64');
  return key;
}

export function launchConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.WALLET_ENCRYPTION_KEY) missing.push('WALLET_ENCRYPTION_KEY');
  if (!process.env.FUNDER_WALLET_SECRET) missing.push('FUNDER_WALLET_SECRET');
  if (!process.env.DATABASE_URL && process.env.VERCEL) missing.push('DATABASE_URL');
  return { ok: missing.length === 0, missing };
}

export function encryptSecret(secret: Uint8Array): { enc: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(secret)), cipher.final()]);
  return { enc: enc.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptSecret(enc: string, iv: string, tag: string): Uint8Array {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return new Uint8Array(Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]));
}

export function funderKeypair(): Keypair {
  const raw = process.env.FUNDER_WALLET_SECRET;
  if (!raw) throw new Error('FUNDER_WALLET_SECRET is not set');
  const s = raw.trim();
  const bytes = s.startsWith('[') ? Uint8Array.from(JSON.parse(s) as number[]) : bs58.decode(s);
  return Keypair.fromSecretKey(bytes);
}

/** Create a new wallet, store its encrypted secret, return its row id + keypair. */
export async function createWallet(kind: 'creator' | 'trading'): Promise<{ id: number; keypair: Keypair }> {
  const kp = Keypair.generate();
  const { enc, iv, tag } = encryptSecret(kp.secretKey);
  const db = await getDb();
  const [row] = await db
    .insert(schema.wallets)
    .values({ pubkey: kp.publicKey.toBase58(), encSecret: enc, iv, tag, kind })
    .returning({ id: schema.wallets.id });
  return { id: row.id, keypair: kp };
}

export async function loadKeypair(walletId: number): Promise<Keypair> {
  const db = await getDb();
  const [w] = await db.select().from(schema.wallets).where(eq(schema.wallets.id, walletId));
  if (!w) throw new Error('wallet not found');
  return Keypair.fromSecretKey(decryptSecret(w.encSecret, w.iv, w.tag));
}

export async function walletPubkey(walletId: number): Promise<string> {
  const db = await getDb();
  const [w] = await db.select({ pubkey: schema.wallets.pubkey }).from(schema.wallets).where(eq(schema.wallets.id, walletId));
  return w?.pubkey ?? '';
}

// ---- owner key ----
export function newOwnerKey(): { key: string; hash: string } {
  const key = bs58.encode(crypto.randomBytes(32));
  return { key, hash: hashOwnerKey(key) };
}

export function hashOwnerKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
