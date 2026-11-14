/**
 * Generate WALLET_ENCRYPTION_KEY and FUNDER_WALLET_SECRET.
 *   npm run keys            -> print them in your own terminal
 *   npm run keys -- --write -> write them into .env.local (gitignored) and print only the funder's PUBLIC address
 * Never overwrites existing values.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const write = process.argv.includes('--write');
const file = path.join(process.cwd(), '.env.local');
const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const has = (k: string) => new RegExp(`^${k}=`, 'm').test(existing);

if (write) {
  const lines: string[] = [];
  if (!has('WALLET_ENCRYPTION_KEY')) lines.push(`WALLET_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`);
  let funderPub: string | null = null;
  if (!has('FUNDER_WALLET_SECRET')) {
    const kp = Keypair.generate();
    lines.push(`FUNDER_WALLET_SECRET=${bs58.encode(kp.secretKey)}`);
    funderPub = kp.publicKey.toBase58();
  } else {
    const m = existing.match(/^FUNDER_WALLET_SECRET=(.+)$/m);
    if (m) funderPub = Keypair.fromSecretKey(bs58.decode(m[1].trim())).publicKey.toBase58();
  }
  if (lines.length) fs.appendFileSync(file, (existing && !existing.endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n');
  console.log(lines.length ? `.env.local updated (${lines.length} new value(s), not printed)` : '.env.local already has both values');
  if (funderPub) console.log(`Funder PUBLIC address (send SOL here): ${funderPub}`);
} else {
  const funder = Keypair.generate();
  console.log('WALLET_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('base64'));
  console.log('FUNDER_WALLET_SECRET=' + bs58.encode(funder.secretKey));
  console.log('');
  console.log('Funder public address (send a small SOL balance here): ' + funder.publicKey.toBase58());
}
console.log('Keep these secret. Losing WALLET_ENCRYPTION_KEY makes every agent wallet unrecoverable.');
