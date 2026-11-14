import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import CoinLive from '@/components/CoinLive';
import LiveFeed from '@/components/LiveFeed';
import MiniGame from '@/components/MiniGame';
import { CopyButton, Empty, ErrorBox } from '@/components/ui';
import { agentStatus, modeLabel } from '@/components/CoinCard';
import { coinByTicker, coinLedger, recentEvents, scorecard, safeView } from '@/lib/server/views';
import { pairsFor, fmtUsd, fmtPct, fmtNum } from '@/lib/market';
import { STRATEGIES, type StrategyId, DAILY_LOSS_LIMIT, MAX_OPEN_POSITIONS } from '@/lib/agent/strategies';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const t = params.ticker.toUpperCase();
  return {
    title: `$${t}`,
    openGraph: { images: [`/api/og?t=${t}`] },
    twitter: { card: 'summary_large_image', images: [`/api/og?t=${t}`] },
  };
}

const sol = (l: number, d = 4) => `${(l / 1e9).toFixed(d)} SOL`;

export default async function CoinPage({ params }: { params: { ticker: string } }) {
  const res = await safeView(() => coinByTicker(params.ticker), null);
  if (res.error) return <div className="max-w-content mx-auto px-4"><ErrorBox reason="This coin could not be loaded. The database did not answer." /></div>;
  const c = res.data;
  if (!c) {
    return (
      <div className="max-w-content mx-auto px-4">
        <Empty text={`NO FIGHTER CALLED $${params.ticker.toUpperCase()} LIVES HERE.`}>
          <Link className="btn btn-coin" href="/launch">LAUNCH IT</Link>
        </Empty>
      </div>
    );
  }
  const [ledger, events, score, pairs] = await Promise.all([
    coinLedger(c.id, 100), recentEvents({ coinId: c.id, limit: 30 }), scorecard(c.id), pairsFor([c.mint], 60),
  ]);
  const p = pairs[c.mint];
  const h = headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const url = `${origin}/c/${c.ticker}`;
  const status = agentStatus(c);
  const strat = STRATEGIES[c.strategy as StrategyId];
  const closedReal = score.closedTrades.filter((t) => !t.dryRun);
  const wins = closedReal.filter((t) => t.pnl > 0).length;
  const pnl = closedReal.reduce((a, t) => a + t.pnl, 0);
  const buyHref = c.status === 'bonded' ? `https://jup.ag/swap/SOL-${c.mint}` : `https://pump.fun/coin/${c.mint}`;
  const shareText = `$${c.ticker} lives in the Insert Coin arcade. ${url}`;

  return (
    <div className="mx-auto max-w-content px-4 py-8 flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <div className="cabinet flex flex-col items-center gap-4">
          <CoinLive coinId={c.id} spec={c.spec} frames={c.frames} level={c.level} sleeping={c.sleeping} latest={events[0] ?? null} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-head text-[20px] sm:text-[24px] leading-[1.4]">{c.name}</h1>
            <span className="font-head text-[16px] text-coin">${c.ticker}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`font-head text-[8px] px-2 py-1 border-2 border-ink ${status === 'ACTIVE' ? 'bg-light text-ink' : 'bg-btn text-paper'}`}>{status}</span>
            {modeLabel(c).map((m) => <span key={m} className="font-head text-[8px] bg-paper text-ink px-2 py-1">{m}</span>)}
            {c.status === 'bonded' && <span className="font-head text-[8px] bg-coin text-ink px-2 py-1">BONDED</span>}
          </div>
          <p className="text-[22px] text-light">{c.story}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="card px-2 py-1 text-[16px] break-all">{c.mint}</code>
            <CopyButton text={c.mint} label="COPY CA" />
          </div>
          <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat l="PRICE" v={p?.priceUsd ? `$${Number(p.priceUsd).toPrecision(4)}` : '—'} />
            <Stat l="MCAP" v={fmtUsd(p?.marketCap ?? p?.fdv)} />
            <Stat l="LIQUIDITY" v={fmtUsd(p?.liquidity?.usd)} />
            <Stat l="VOL 24H" v={fmtUsd(p?.volume?.h24)} />
            <Stat l="1H" v={fmtPct(p?.priceChange?.h1)} tone={(p?.priceChange?.h1 ?? 0) >= 0 ? 'up' : 'down'} />
            <Stat l="24H" v={fmtPct(p?.priceChange?.h24)} tone={(p?.priceChange?.h24 ?? 0) >= 0 ? 'up' : 'down'} />
            <Stat l="TXNS 24H" v={p?.txns ? String(p.txns.h24.buys + p.txns.h24.sells) : '—'} />
            <Stat l="FEES IN" v={sol(score.feesIn, 3)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-coin" href="#play">PLAY</a>
            <Link className="btn" href={`/t/${c.ticker}`}>TERMINAL</Link>
            <a className="btn btn-primary" href={buyHref} target="_blank" rel="noreferrer">BUY</a>
            <a className="btn" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">SHARE</a>
            <Link className="btn" href={`/arcade?focus=${c.ticker}`}>SEE IN ARCADE</Link>
          </div>
        </div>
      </div>

      {(c.pairAddress || p?.pairAddress) && (
        <div className="screen h-[420px]">
          <iframe
            title={`$${c.ticker} chart`}
            src={`https://dexscreener.com/solana/${c.pairAddress ?? p?.pairAddress}?embed=1&theme=dark&info=0`}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="font-head text-[12px]">AGENT SCORECARD</h2>
          {c.halted && <p className="font-head text-[10px] text-btn blink leading-5">HALTED: {c.haltReason}</p>}
          <dl className="grid grid-cols-2 gap-y-1 text-[20px]">
            <dt className="text-dark">Fees in</dt><dd className="text-right">{sol(score.feesIn)}</dd>
            <dt className="text-dark">Allocated to burn</dt><dd className="text-right">{sol(score.allocatedBurn)}</dd>
            <dt className="text-dark">Allocated to trade</dt><dd className="text-right">{sol(score.allocatedTrade)}</dd>
            <dt className="text-dark">Network fees</dt><dd className="text-right">{sol(score.networkFees, 6)}</dd>
            <dt className="text-dark">Spent on buybacks</dt><dd className="text-right">{sol(score.buybackSol)}</dd>
            <dt className="text-dark">Tokens burned</dt><dd className="text-right">{fmtNum(score.burnedTokens)}</dd>
            {c.agentMode !== 'burn' && (
              <>
                <dt className="text-dark">Strategy</dt><dd className="text-right">{strat?.label ?? c.strategy}</dd>
                <dt className="text-dark">Mode</dt><dd className="text-right">{c.tradeLive ? 'REAL ORDERS' : 'DRY RUN'}</dd>
                <dt className="text-dark">Open trades</dt><dd className="text-right">{score.openTrades.length}</dd>
                <dt className="text-dark">Closed trades</dt><dd className="text-right">{closedReal.length}</dd>
                <dt className="text-dark">PnL (real)</dt><dd className="text-right">{closedReal.length ? `${pnl >= 0 ? '+' : ''}${sol(pnl)}` : '—'}</dd>
                <dt className="text-dark">Win rate</dt><dd className="text-right">{closedReal.length ? `${Math.round((wins / closedReal.length) * 100)}%` : '—'}</dd>
                <dt className="text-dark">Dry-run signals</dt><dd className="text-right">{score.dryRunSignals}</dd>
              </>
            )}
          </dl>
          <p className="text-[18px] text-dark">
            Limits: 2% price impact per buyback chunk{c.agentMode !== 'burn' ? `, ${DAILY_LOSS_LIMIT * 100}% daily loss limit, max ${MAX_OPEN_POSITIONS} open positions, TP +${(strat?.tp ?? 0) * 100}% / SL -${(strat?.sl ?? 0) * 100}%` : ''}, 3 failed transactions = halt, ledger reconciled every minute.
          </p>
          {score.openTrades.length > 0 && (
            <div>
              <h3 className="font-head text-[10px] mb-2">OPEN</h3>
              <ul className="text-[18px]">
                {score.openTrades.map((t, i) => <li key={i}>{t.dryRun ? '[DRY] ' : ''}${t.symbol} · {t.strategy} · {sol(t.size, 3)}</li>)}
              </ul>
            </div>
          )}
          {score.closedTrades.length > 0 && (
            <div>
              <h3 className="font-head text-[10px] mb-2">CLOSED</h3>
              <ul className="text-[18px] max-h-48 overflow-auto">
                {score.closedTrades.map((t, i) => (
                  <li key={i} className={t.pnl >= 0 ? 'text-dark' : 'text-btn'}>
                    {t.dryRun ? '[DRY] ' : ''}${t.symbol} {t.pnl >= 0 ? '+' : ''}{sol(t.pnl)} · {t.reason}
                    {t.exitSig && <a className="underline ml-2" href={`https://solscan.io/tx/${t.exitSig}`} target="_blank" rel="noreferrer">tx</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[16px] text-dark">Wallets: creator <a className="underline break-all" href={`https://solscan.io/account/${c.creatorWallet}`} target="_blank" rel="noreferrer">{c.creatorWallet.slice(0, 6)}…</a> · trading <a className="underline" href={`https://solscan.io/account/${c.tradingWallet}`} target="_blank" rel="noreferrer">{c.tradingWallet.slice(0, 6)}…</a></p>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="font-head text-[12px]">EVENT LOG</h2>
          <LiveFeed initial={events} coinId={c.id} max={30} />
        </div>
      </section>

      <section className="card p-4 sm:p-6 overflow-x-auto">
        <h2 className="font-head text-[12px] mb-4">LEDGER</h2>
        {ledger.length === 0 ? (
          <p className="text-[20px]">No entries yet.</p>
        ) : (
          <table className="w-full text-left text-[18px]">
            <thead className="font-head text-[8px]"><tr><th className="p-1">TIME (UTC)</th><th className="p-1">WALLET</th><th className="p-1">KIND</th><th className="p-1 text-right">SOL</th><th className="p-1 text-right">TOKENS</th><th className="p-1">TX</th></tr></thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id} className="border-t-2 border-ink/30">
                  <td className="p-1 whitespace-nowrap">{l.ts.slice(0, 16).replace('T', ' ')}</td>
                  <td className="p-1">{l.wallet}</td>
                  <td className="p-1">{l.kind}</td>
                  <td className={`p-1 text-right ${l.sol < 0 ? 'text-btn' : ''}`}>{l.sol ? (l.sol / 1e9).toFixed(6) : '—'}</td>
                  <td className="p-1 text-right">{l.tokens ? fmtNum(Math.abs(l.tokens)) : '—'}</td>
                  <td className="p-1">{l.txSig ? <a className="underline" href={`https://solscan.io/tx/${l.txSig}`} target="_blank" rel="noreferrer">{l.txSig.slice(0, 6)}…</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section id="play" className="flex flex-col gap-4 items-center scroll-mt-20">
        <h2 className="font-head text-[12px] self-start">PLAY ${c.ticker}</h2>
        <MiniGame spec={c.spec} frames={c.frames} ticker={c.ticker} url={url} />
      </section>
    </div>
  );
}

function Stat({ l, v, tone }: { l: string; v: string; tone?: 'up' | 'down' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-head text-[8px] text-dark">{l}</span>
      <span className={`font-head text-[12px] ${tone === 'up' ? 'text-dark' : tone === 'down' ? 'text-btn' : ''}`}>{v}</span>
    </div>
  );
}
