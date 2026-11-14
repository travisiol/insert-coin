/**
 * Insert Coin agent worker. Long-running Node process (Railway / Fly.io / any VPS).
 * Needs the same 3 env values as the web app. Run: npm run worker
 */
import { activeCoins, emergencyStop, loadCandidates, tickCoin } from '../lib/agent/run';
import { pairsFor } from '../lib/market';

const LOOP_MS = 60_000;

function log(msg: string) {
  // never log secrets: only tickers, amounts and signatures reach this function
  console.log(`${new Date().toISOString()} ${msg}`);
}

async function loop() {
  if (await emergencyStop()) {
    log('EMERGENCY STOP is on, skipping loop');
    return;
  }
  const coins = await activeCoins();
  if (!coins.length) {
    log('no live coins');
    return;
  }
  const pairs = await pairsFor(coins.map((c) => c.mint), 30);
  const needsCandidates = coins.some((c) => c.agentMode !== 'burn' && !c.paused && !c.halted);
  const candidatePairs = needsCandidates ? await loadCandidates().catch(() => []) : [];
  for (const coin of coins) {
    if (await emergencyStop()) break;
    try {
      await tickCoin(coin, pairs[coin.mint], { log, candidatePairs });
    } catch (e) {
      log(`[${coin.ticker}] tick error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function main() {
  for (const k of ['DATABASE_URL', 'WALLET_ENCRYPTION_KEY']) {
    if (!process.env[k]) {
      console.error(`${k} is not set`);
      process.exit(1);
    }
  }
  log('worker started');
  for (;;) {
    const t0 = Date.now();
    try {
      await loop();
    } catch (e) {
      log(`loop error: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, Math.max(5_000, LOOP_MS - (Date.now() - t0))));
  }
}

main();
