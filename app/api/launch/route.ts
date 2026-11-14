import { launch, funderSpentToday, tickerTaken, DAILY_FUNDER_BUDGET_LAMPORTS, MAX_LAUNCHES_PER_DAY, MAX_LAUNCHES_PER_IP_HOUR, LAUNCH_FUNDING_LAMPORTS } from '@/lib/server/launch';
import { hit, clientIp, siteOrigin, cleanTicker, cleanText, validSpec, validFrames, json, isPublicOrigin, LOCAL_LAUNCH_REASON } from '@/lib/server/guard';
import { launchConfigured } from '@/lib/server/secrets';
import { personalityFor } from '@/lib/engine/build';
import { STRATEGY_IDS } from '@/lib/agent/strategies';
import { isAddress } from '@/lib/chain/rpc';
import type { AgentMode, ProfitRoute } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  // A coin created from localhost would point pump.fun at an unreachable image forever.
  if (!isPublicOrigin(siteOrigin(req))) return json({ error: LOCAL_LAUNCH_REASON }, 503);
  const cfg = launchConfigured();
  if (!cfg.ok) return json({ error: 'LAUNCHES ARE NOT CONFIGURED ON THIS SERVER YET.' }, 503);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  // bot checks: honeypot field must stay empty, and a human takes a few seconds to fill the form
  if (body.website) return json({ error: 'Bad request.' }, 400);
  const t0 = Number(body.t0);
  if (!t0 || Date.now() - t0 < 4000) return json({ error: 'Too fast. Take a breath and try again.' }, 429);

  const ticker = cleanTicker(body.ticker);
  const name = cleanText(body.name, 32);
  const story = cleanText(body.story, 240);
  const input = cleanText(body.input, 2000);
  const salt = Number.isInteger(body.salt) ? Number(body.salt) : 0;
  if (!ticker || !name || !story || !input) return json({ error: 'Name, ticker (3-8 A-Z0-9) and story are required.' }, 400);
  const spec = validSpec(body.spec, ticker);
  if (!spec) return json({ error: 'Pick a fighter.' }, 400);
  const frames = body.frames ? validFrames(body.frames) : null;
  const agentMode = (['burn', 'trade', 'hybrid'] as const).includes(body.agentMode as AgentMode) ? (body.agentMode as AgentMode) : 'burn';
  const split = Math.max(0, Math.min(100, Math.round(Number(body.splitBurnPct ?? 50))));
  const splitBurnPct = agentMode === 'burn' ? 100 : agentMode === 'trade' ? 0 : split;
  const strategy = (STRATEGY_IDS as readonly string[]).includes(String(body.strategy)) ? String(body.strategy) : 'momentum';
  const profitRoute = (['burn', 'reinvest', 'beneficiary'] as const).includes(body.profitRoute as ProfitRoute) ? (body.profitRoute as ProfitRoute) : 'reinvest';
  const beneficiary = typeof body.beneficiary === 'string' && body.beneficiary.trim() ? body.beneficiary.trim() : null;
  if (profitRoute === 'beneficiary' && (!beneficiary || !isAddress(beneficiary))) return json({ error: 'Enter a valid Solana beneficiary address.' }, 400);
  const twitter = typeof body.twitter === 'string' && /^https:\/\/(x|twitter)\.com\//.test(body.twitter) ? body.twitter : null;

  try {
    if (await tickerTaken(ticker)) return json({ error: `$${ticker} is already taken on Insert Coin. Pick another ticker.` }, 409);
    if ((await funderSpentToday()) + LAUNCH_FUNDING_LAMPORTS > DAILY_FUNDER_BUDGET_LAMPORTS) {
      return json({ error: 'LAUNCHES PAUSED UNTIL TOMORROW.' }, 503);
    }
    const ip = clientIp(req);
    if ((await hit(`launch:ip:${ip}`, 3600_000)) > MAX_LAUNCHES_PER_IP_HOUR) return json({ error: 'Launch limit reached for now. Try again in an hour.' }, 429);
    if ((await hit('launch:global', 86_400_000)) > MAX_LAUNCHES_PER_DAY) return json({ error: 'LAUNCHES PAUSED UNTIL TOMORROW.' }, 503);
  } catch {
    return json({ error: 'Database unavailable. Try again.' }, 503);
  }

  const personality = personalityFor(input, salt, name, ticker);
  const origin = siteOrigin(req);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        const r = await launch(
          { input, salt, name, ticker, story, spec, frames, personality, agentMode, splitBurnPct, strategy, profitRoute, beneficiary, twitter },
          origin,
          (step) => send({ step }),
        );
        send({ done: true, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        send({ error: /PumpPortal/.test(msg) ? 'Pump.fun did not accept the launch. Try again.' : 'NETWORK IS BUSY, TRY AGAIN.', detail: msg.slice(0, 160) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
