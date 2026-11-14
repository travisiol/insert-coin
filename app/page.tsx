import Link from 'next/link';
import HomeHero from '@/components/HomeHero';
import CoinCard from '@/components/CoinCard';
import LiveFeed from '@/components/LiveFeed';
import Arcade from '@/components/Arcade';
import { Section, Empty, ErrorBox } from '@/components/ui';
import { ArchetypeCarousel, StatesGrid, LevelsRow, AgentCards, StepSprite } from '@/components/Showcase';
import { FaqList, StrategyTable, SafetyGrid } from '@/components/content';
import { listCoins, globalStats, recentEvents, safeView } from '@/lib/server/views';

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '01', t: 'DROP A POST', d: 'Paste an X post link or type a sentence.', state: 'idle' as const, i: 3, tk: 'IDEA' },
  { n: '02', t: 'THE ENGINE BUILDS', d: 'Name, ticker, story and three fighters. Edit anything.', state: 'walk' as const, i: 0, tk: 'BUILD' },
  { n: '03', t: 'LAUNCH', d: 'Created on pump.fun from encrypted server wallets. No wallet needed.', state: 'bonded' as const, i: 15, tk: 'LIVE' },
  { n: '04', t: 'THE AGENT WORKS', d: 'Creator fees fund buyback & burn, trading, or both. Every action is on-chain.', state: 'burn' as const, i: 8, tk: 'BURN' },
];

export default async function Home() {
  const [stats, coins, events] = await Promise.all([
    safeView(globalStats, { fighters: 0, feesLamports: 0, burnedTokens: 0 }),
    safeView(() => listCoins({ limit: 60 }), []),
    safeView(() => recentEvents({ limit: 12 }), []),
  ]);
  const trending = [...coins.data].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 6);
  const recent = coins.data.slice(0, 6);
  const s = stats.data;
  const facts = [
    s.fighters > 0 ? `${s.fighters} FIGHTERS ALIVE` : 'FIGHTERS INCOMING',
    s.feesLamports > 0 ? `${(s.feesLamports / 1e9).toFixed(2)} SOL CREATOR FEES COLLECTED` : 'CREATOR FEES INCOMING',
    s.burnedTokens > 0 ? `${Math.round(s.burnedTokens).toLocaleString('en-US')} TOKENS BURNED` : 'BURNS INCOMING',
    'EVERY ACTION ON-CHAIN',
    'NO WALLET NEEDED TO LAUNCH',
    'THE ENGINE BUILDS THE COIN',
    '6 RULE-BASED STRATEGIES',
    '100% SOLANA MAINNET',
    'ONE SHARED PIXEL ARCADE',
    'FIGHTERS LEVEL UP ON REAL MILESTONES',
  ];

  return (
    <>
      <HomeHero stats={stats.data} />

      <div className="bg-coin text-ink border-y-4 border-ink overflow-hidden h-12 flex items-center" aria-label="Live facts">
        <div className="marquee whitespace-nowrap flex gap-12 font-head text-[10px]">
          {[...facts, ...facts].map((f, i) => <span key={i}>+ {f}</span>)}
        </div>
      </div>

      <Section kicker="[01]" title="HOW IT WORKS">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-4 flex flex-col gap-4">
              <div className="bg-tile p-4 flex justify-center"><StepSprite state={s.state} i={s.i} ticker={s.tk} /></div>
              <span className="font-head text-[10px] text-dark">{s.n}</span>
              <h3 className="font-head text-[12px] leading-5">{s.t}</h3>
              <p className="text-[20px]">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8"><Link href="/how" className="btn">FULL DETAILS</Link></div>
      </Section>

      <Section kicker="[02]" title="A FIGHTER FOR EVERY COIN">
        <p className="text-[22px] text-light mb-6 max-w-[760px]">
          Drawn pixel by pixel on a 32x32 grid, with the ticker on its chest. 16 archetypes, 13 accessories, 5 leg styles, 10 eyes and 8 mouths. The
          engine picks what fits your post; you remix, reroll or draw your own in the Studio.
        </p>
        <ArchetypeCarousel />
        <div className="flex gap-4 mt-6 flex-wrap">
          <Link href="/launch" className="btn btn-coin">BUILD YOURS</Link>
          <Link href="/studio" className="btn">OPEN STUDIO</Link>
        </div>
      </Section>

      <Section kicker="[03]" title="PICK YOUR AGENT">
        <p className="text-[22px] text-light mb-6">Every coin gets an agent funded only by its real creator fees.</p>
        <AgentCards />
      </Section>

      <Section kicker="[04]" title="FIGHTERS ONLY MOVE WHEN SOMETHING REALLY HAPPENED">
        <StatesGrid />
      </Section>

      <Section kicker="[05]" title="LIVE NOW">
        {coins.error ? (
          <ErrorBox reason="Live data is unavailable right now." />
        ) : !coins.data.length ? (
          <Empty text="NO FIGHTERS YET. LAUNCH THE FIRST ONE.">
            <Link href="/launch" className="btn btn-coin">LAUNCH</Link>
          </Empty>
        ) : (
          <div className="grid gap-12">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-head text-[12px] text-coin">TRENDING FIGHTERS</h3>
                <Link href="/agents" className="font-head text-[10px] text-light hover:text-coin">VIEW ALL</Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{trending.map((c) => <CoinCard key={c.id} c={c} />)}</div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-head text-[12px] text-coin">RECENT LAUNCHES</h3>
                <Link href="/agents?sort=new" className="font-head text-[10px] text-light hover:text-coin">VIEW ALL</Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{recent.map((c) => <CoinCard key={c.id} c={c} />)}</div>
            </div>
          </div>
        )}
      </Section>

      <Section kicker="[06]" title="LIVE AGENT ACTIVITY">
        <LiveFeed initial={events.data} />
      </Section>

      <Section kicker="[07]" title="EVOLUTION">
        <p className="text-[22px] text-light mb-6">Levels are visual only. They never change what the agent does.</p>
        <LevelsRow />
      </Section>

      <Section kicker="[08]" title="THE ARCADE">
        <Arcade mini />
      </Section>

      <Section kicker="[09]" title="STRATEGIES">
        <StrategyTable />
      </Section>

      <Section kicker="[10]" title="CHECK EVERYTHING">
        <p className="text-[22px] text-light mb-6 max-w-[860px]">
          Keys stay encrypted on the server. Actions appear only after on-chain confirmation. The ledger is reconciled with the chain every
          minute; any mismatch halts the agent. Hard limits on price impact, losses and failures, plus an emergency stop.
        </p>
        <SafetyGrid />
      </Section>

      <Section kicker="[11]" title="FAQ">
        <FaqList />
      </Section>

      <section className="mx-auto max-w-content px-4 py-16 text-center flex flex-col items-center gap-6">
        <span className="font-head text-[24px] text-coin blink">INSERT COIN</span>
        <p className="text-[24px] text-light">One post. One fighter. One agent.</p>
        <Link href="/launch" className="btn btn-primary">START</Link>
      </section>
    </>
  );
}
