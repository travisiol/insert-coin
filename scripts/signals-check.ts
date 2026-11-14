/**
 * Read-only check of the trading rules on live public data. Sends nothing, needs no DB or secrets.
 * Run: npm run signals
 */
import { loadCandidates } from '../lib/agent/run';
import { STRATEGIES, STRATEGY_IDS } from '../lib/agent/strategies';
import { honeypotCheck, WSOL } from '../lib/chain/trade';

async function main() {
  const pairs = (await loadCandidates()).filter((p) => p.quoteToken.address === WSOL);
  console.log(`candidates with a SOL pair: ${pairs.length}`);
  for (const id of STRATEGY_IDS) {
    const s = STRATEGIES[id];
    const hits = pairs.filter((p) => (p.liquidity?.usd ?? 0) >= s.minLiquidity && s.test(p).ok);
    console.log(`${s.label.padEnd(16)} ${String(hits.length).padStart(3)} signal(s)${hits[0] ? ` e.g. $${hits[0].baseToken.symbol}: ${s.test(hits[0]).reason}` : ''}`);
  }
  const sample = pairs.find((p) => (p.liquidity?.usd ?? 0) > 50_000);
  if (sample) {
    const hp = await honeypotCheck(sample.baseToken.address, 10_000_000);
    console.log(`honeypot check on $${sample.baseToken.symbol}: ${hp.ok ? 'PASS' : 'FAIL'} (${hp.reason})`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
