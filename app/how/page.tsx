import Link from 'next/link';
import { Section } from '@/components/ui';
import { FaqList, StrategyTable, SafetyGrid } from '@/components/content';
import { LevelsRow, StatesGrid } from '@/components/Showcase';

export const metadata = { title: 'How it works' };

const FLOW = [
  ['01 DROP A POST', 'Paste an X post link or type a sentence. For links, the post text is read through the public oEmbed endpoint. The text is normalized and hashed into a seed, so the same input always gives the same result on every device.'],
  ['02 THE ENGINE BUILDS', 'The Fighter Engine is procedural code, not a language model. It extracts keywords, picks an archetype, writes a name, a 3-8 character ticker and a 3-sentence story, draws three 32x32 fighters and writes a terminal personality. REROLL changes the salt. Everything is editable.'],
  ['03 PICK THE AGENT', 'BURN: fees buy the coin back and burn exactly what was bought. TRADE: fees fund a trading wallet running one of six rule-based strategies. HYBRID: any split between the two, and you choose where trading results go: burn, reinvest or a beneficiary address.'],
  ['04 LAUNCH', 'The server creates an encrypted creator wallet and trading wallet for your coin, a launch fund sends 0.03 SOL for rent and fees, and the coin is created on pump.fun through PumpPortal with no dev buy. You get an owner key, shown once.'],
  ['05 THE AGENT WORKS', 'About once a minute the worker collects the coin\'s pump.fun creator fees (when above 0.002 SOL), splits them, buys back and burns in chunks capped at 2% price impact, and runs trading rules with take-profit, stop-loss and loss limits. Every step is written to an append-only ledger after confirmation.'],
];

export default function HowPage() {
  return (
    <>
      <Section kicker="FROM A SENTENCE TO A WORKING AGENT" title="HOW IT WORKS">
        <ol className="grid gap-4">
          {FLOW.map(([t, d]) => (
            <li key={t} className="card p-6 grid gap-2">
              <h3 className="font-head text-[12px]">{t}</h3>
              <p className="text-[22px]">{d}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="FIGHTERS ONLY MOVE WHEN SOMETHING REALLY HAPPENED">
        <StatesGrid />
      </Section>
      <Section title="EVOLUTION">
        <LevelsRow />
      </Section>
      <Section title="STRATEGIES">
        <StrategyTable />
      </Section>
      <Section title="CHECK EVERYTHING">
        <p className="text-[22px] text-light mb-6 max-w-[860px]">
          Keys stay encrypted on the server. Actions appear only after on-chain confirmation. The ledger is reconciled with the chain every
          minute; any mismatch halts the agent. Hard limits on price impact, losses and failures, plus an emergency stop.
        </p>
        <SafetyGrid />
        <div className="card-dark p-6 mt-6 text-[20px] text-paper flex flex-col gap-2">
          <h3 className="font-head text-[10px] text-coin">WHAT IT COSTS AND WHAT IT RISKS</h3>
          <p>Launching costs you nothing: the launch fund pays about 0.03 SOL per coin, and launches pause for the day when its daily budget is spent.</p>
          <p>Creator fees exist only if people trade your coin. Most coins see little trading. Buybacks say nothing about where the price goes next.</p>
          <p>Trading agents can lose their whole balance. Nothing here is financial advice and no returns are promised.</p>
        </div>
      </Section>
      <Section title="FAQ">
        <FaqList />
        <div className="mt-8"><Link href="/launch" className="btn btn-coin">LAUNCH A FIGHTER</Link></div>
      </Section>
    </>
  );
}
