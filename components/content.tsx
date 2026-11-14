import { STRATEGIES, STRATEGY_IDS, MAX_OPEN_POSITIONS } from '@/lib/agent/strategies';

export const FAQ: [string, string][] = [
  ['Do I need a wallet?', 'No. Insert Coin creates the coin on pump.fun from a dedicated server wallet made just for your coin, and a launch fund pays the network costs. You get an owner key that controls the agent.'],
  ['Where does the agent\'s money come from?', 'Only from the real pump.fun creator fees your coin generates. The worker collects them about once a minute when they are worth more than 0.002 SOL, then splits them between buyback & burn and trading according to your settings.'],
  ['Can the engine move funds?', 'No. The Fighter Engine writes names, stories, sprites and terminal lines. Money moves only through fixed rules in the worker: fee collection, allocation, buyback & burn, and the six trading strategies, all with hard limits.'],
  ['Is it real SOL?', 'Yes. Every action is a real Solana mainnet transaction with a Solscan link. Trading agents run in dry-run mode first and need 24 hours of logged signals before real orders can be enabled. Trading can lose money.'],
  ['Is anything in the arcade fake?', 'No. A fighter only celebrates, sulks, burns or levels up when a matching event row exists, and every money event links to its confirmed transaction. Preview fighters on this page are labelled ENGINE PREVIEW.'],
  ['Can I draw my own fighter?', 'Yes. Open the Studio, draw up to 4 frames per state on a 32x32 grid (or start from the engine\'s parts), save it, then press LAUNCH THIS FIGHTER.'],
  ['What if I lose my owner key?', 'It is shown once and only its hash is stored. Nobody can recover it. The agent keeps running with its current settings, but nobody can change them.'],
];

export function FaqList() {
  return (
    <div className="grid gap-4">
      {FAQ.map(([q, a]) => (
        <details key={q} className="card p-4 group">
          <summary className="font-head text-[12px] leading-5 list-none flex justify-between gap-4">
            {q}
            <span className="group-open:rotate-90">▶</span>
          </summary>
          <p className="text-[20px] mt-4">{a}</p>
        </details>
      ))}
    </div>
  );
}

export function StrategyTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full card text-left text-[18px]">
        <thead className="font-head text-[8px] bg-ink text-paper">
          <tr>
            {['STRATEGY', 'ENTRY RULE', 'TP / SL', 'MAX HOLD', 'MAX SIZE', 'MIN LIQ.'].map((h) => <th key={h} className="p-2">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {STRATEGY_IDS.map((id) => {
            const s = STRATEGIES[id];
            const hold = s.maxHoldMin >= 60 ? `${s.maxHoldMin / 60}h` : `${s.maxHoldMin}m`;
            return (
              <tr key={id} className="border-t-4 border-ink">
                <td className="p-2 font-head text-[10px]">{s.label}</td>
                <td className="p-2">{s.entry}</td>
                <td className="p-2 whitespace-nowrap">+{s.tp * 100}% / -{s.sl * 100}%{s.trail ? `, trail ${s.trail * 100}%` : ''}</td>
                <td className="p-2">{hold}</td>
                <td className="p-2">{s.maxSize * 100}%</td>
                <td className="p-2">${s.minLiquidity / 1000}K</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-light text-[18px] mt-4">
        All strategies: max {MAX_OPEN_POSITIONS} open positions, never trade the agent&apos;s own coin, honeypot check (buy and sell-back quotes must
        both route with under 15% loss), daily loss limit of 10% of the trading balance, dry-run for 24 h before real orders.
      </p>
    </div>
  );
}

export function SafetyGrid() {
  const items = [
    ['ENCRYPTED KEYS', 'Each coin has its own creator and trading wallet. Secrets are encrypted with AES-256-GCM and only decrypted in server memory.'],
    ['CONFIRMED ONLY', 'Actions appear only after on-chain confirmation, each with its Solscan link.'],
    ['RECONCILED', 'The ledger is compared with the chain every minute. Any mismatch over 10,000 lamports halts the agent.'],
    ['HARD LIMITS', '2% price-impact cap per buyback chunk, 10% daily loss limit, 3 failed transactions = halt, plus an emergency stop.'],
    ['APPEND-ONLY LEDGER', 'Ledger rows cannot be updated or deleted. Every lamport in and out of an agent wallet is recorded.'],
    ['NO HIDDEN ACTIVITY', 'The arcade, feeds and bubbles read only the events table. No event, no animation.'],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([t, d]) => (
        <div key={t} className="card-dark p-4 flex flex-col gap-2">
          <h3 className="font-head text-[10px] text-coin">{t}</h3>
          <p className="text-[20px] text-paper">{d}</p>
        </div>
      ))}
    </div>
  );
}
