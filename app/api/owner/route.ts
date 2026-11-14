import { PublicKey } from '@solana/web3.js';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { hashOwnerKey, loadKeypair, walletPubkey } from '@/lib/server/secrets';
import { hit, clientIp, json } from '@/lib/server/guard';
import { balance, isAddress } from '@/lib/chain/rpc';
import { transferSol } from '@/lib/chain/trade';
import { ledgerFromTx } from '@/lib/agent/record';
import { STRATEGY_IDS } from '@/lib/agent/strategies';
import type { Personality } from '@/lib/engine/personality';
import type { Coin } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function summary(c: Coin) {
  const creator = await walletPubkey(c.creatorWalletId);
  const trading = await walletPubkey(c.tradingWalletId);
  const [cb, tb] = await Promise.all([balance(new PublicKey(creator)).catch(() => null), balance(new PublicKey(trading)).catch(() => null)]);
  return {
    ticker: c.ticker, name: c.name, mint: c.mint, status: c.status, agentMode: c.agentMode, splitBurnPct: c.splitBurnPct,
    strategy: c.strategy, profitRoute: c.profitRoute, beneficiary: c.beneficiaryAddress, paused: c.paused, halted: c.halted,
    haltReason: c.haltReason, tradeLive: c.tradeLive, terminal: c.terminalJson, creatorWallet: creator, tradingWallet: trading,
    creatorBalance: cb, tradingBalance: tb,
  };
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) return json({ error: 'Paste your owner key.' }, 400);
  try {
    if ((await hit(`owner:${clientIp(req)}`, 3600_000)) > 60) return json({ error: 'Too many attempts. Try again later.' }, 429);
    const db = await getDb();
    const [coin] = await db.select().from(schema.coins).where(eq(schema.coins.ownerKeyHash, hashOwnerKey(key)));
    if (!coin) return json({ error: 'Unknown owner key.' }, 403);
    const set = (patch: Partial<typeof schema.coins.$inferInsert>) => db.update(schema.coins).set(patch).where(eq(schema.coins.id, coin.id));
    const action = String(body.action ?? 'auth');

    switch (action) {
      case 'auth':
        break;
      case 'pause':
        await set({ paused: true });
        break;
      case 'resume':
        await set({ paused: false, halted: false, haltReason: null, failCount: 0 });
        break;
      case 'stop':
        await set({ paused: true, halted: true, haltReason: 'EMERGENCY STOP BY OWNER' });
        break;
      case 'settings': {
        const mode = String(body.agentMode);
        if (!['burn', 'trade', 'hybrid'].includes(mode)) return json({ error: 'Bad mode.' }, 400);
        const split = mode === 'burn' ? 100 : mode === 'trade' ? 0 : Math.max(0, Math.min(100, Math.round(Number(body.splitBurnPct ?? 50))));
        const strategy = (STRATEGY_IDS as readonly string[]).includes(String(body.strategy)) ? String(body.strategy) : coin.strategy;
        const route = String(body.profitRoute);
        if (!['burn', 'reinvest', 'beneficiary'].includes(route)) return json({ error: 'Bad profit route.' }, 400);
        const ben = typeof body.beneficiary === 'string' ? body.beneficiary.trim() : '';
        if (route === 'beneficiary' && !isAddress(ben)) return json({ error: 'Enter a valid Solana beneficiary address.' }, 400);
        await set({
          agentMode: mode as Coin['agentMode'], splitBurnPct: split, splitTradePct: 100 - split, strategy,
          profitRoute: route as Coin['profitRoute'], beneficiaryAddress: route === 'beneficiary' ? ben : coin.beneficiaryAddress,
        });
        break;
      }
      case 'live-trading': {
        const enable = !!body.enable;
        if (enable) {
          const rows = await db.select({ openedAt: schema.trades.openedAt }).from(schema.trades)
            .where(eq(schema.trades.coinId, coin.id)).orderBy(schema.trades.openedAt).limit(1);
          const first = rows[0]?.openedAt;
          if (!first || Date.now() - new Date(first).getTime() < 24 * 3600_000) {
            return json({ error: 'Real orders unlock after 24 h of dry-run signals.' }, 400);
          }
        }
        await set({ tradeLive: enable });
        break;
      }
      case 'terminal': {
        const t = body.terminal as Partial<Personality> | undefined;
        if (!t) return json({ error: 'Bad terminal.' }, 400);
        const cur = coin.terminalJson;
        const catchphrases = Array.isArray(t.catchphrases)
          ? t.catchphrases.slice(0, 5).map((s) => String(s).slice(0, 80)).filter(Boolean)
          : cur.catchphrases;
        const commands = Array.isArray(t.commands)
          ? t.commands.slice(0, 3).map((c) => ({
              name: String(c?.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12),
              response: String(c?.response ?? '').slice(0, 200),
            })).filter((c) => c.name && c.response)
          : cur.commands;
        await set({ terminalJson: { ...cur, catchphrases: catchphrases.length ? catchphrases : cur.catchphrases, commands } });
        break;
      }
      case 'withdraw': {
        const to = typeof body.to === 'string' ? body.to.trim() : '';
        if (!isAddress(to)) return json({ error: 'Enter a valid Solana address.' }, 400);
        const trading = await loadKeypair(coin.tradingWalletId);
        const bal = await balance(trading.publicKey);
        const amount = bal - 5_100;
        if (amount <= 0) return json({ error: 'Trading balance is empty.' }, 400);
        const sig = await transferSol(trading, new PublicKey(to), amount);
        await ledgerFromTx(coin.id, 'trading', trading.publicKey, 'withdraw', sig, { meta: { to } });
        const [fresh] = await db.select().from(schema.coins).where(eq(schema.coins.id, coin.id));
        return json({ ok: true, sig, coin: await summary(fresh) });
      }
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
    const [fresh] = await db.select().from(schema.coins).where(eq(schema.coins.id, coin.id));
    return json({ ok: true, coin: await summary(fresh) });
  } catch (e) {
    return json({ error: e instanceof Error && /transaction|confirmation/.test(e.message) ? 'NETWORK IS BUSY, TRY AGAIN.' : 'Owner tools unavailable.' }, 503);
  }
}
