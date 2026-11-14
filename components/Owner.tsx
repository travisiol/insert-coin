'use client';
import { useState } from 'react';
import Link from 'next/link';
import { STRATEGIES, STRATEGY_IDS } from '@/lib/agent/strategies';
import type { Personality } from '@/lib/engine/personality';
import { ErrorBox, PixelBar } from './ui';
import { play } from '@/lib/client/sound';

interface Summary {
  ticker: string; name: string; mint: string; status: string; agentMode: 'burn' | 'trade' | 'hybrid'; splitBurnPct: number; strategy: string;
  profitRoute: 'burn' | 'reinvest' | 'beneficiary'; beneficiary: string | null; paused: boolean; halted: boolean; haltReason: string | null;
  tradeLive: boolean; terminal: Personality; creatorWallet: string; tradingWallet: string; creatorBalance: number | null; tradingBalance: number | null;
}

export default function Owner() {
  const [key, setKey] = useState('');
  const [coin, setCoin] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<Pick<Summary, 'agentMode' | 'splitBurnPct' | 'strategy' | 'profitRoute'> & { beneficiary: string }>({
    agentMode: 'burn', splitBurnPct: 50, strategy: 'momentum', profitRoute: 'reinvest', beneficiary: '',
  });
  const [term, setTerm] = useState<Personality | null>(null);
  const [withdrawTo, setWithdrawTo] = useState('');

  async function call(action: string, extra: Record<string, unknown> = {}, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const r = await fetch('/api/owner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, action, ...extra }) });
      const j = (await r.json()) as { ok?: boolean; error?: string; coin?: Summary; sig?: string };
      if (!r.ok || !j.coin) throw new Error(j.error ?? 'Owner tools unavailable.');
      setCoin(j.coin);
      setForm({ agentMode: j.coin.agentMode, splitBurnPct: j.coin.splitBurnPct, strategy: j.coin.strategy, profitRoute: j.coin.profitRoute, beneficiary: j.coin.beneficiary ?? '' });
      setTerm(j.coin.terminal);
      if (action !== 'auth') { setOk(j.sig ? `DONE · tx ${j.sig.slice(0, 10)}…` : 'SAVED'); play('coin'); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!coin) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-16 flex flex-col gap-6">
        <h1 className="font-head text-[20px]">OWNER</h1>
        <p className="text-[22px] text-light">Paste the owner key you saved at launch. It is checked against a stored hash; we never store the key itself.</p>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); call('auth'); }}>
          <label htmlFor="owner-key" className="label text-light">OWNER KEY</label>
          <input id="owner-key" className="field" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn btn-primary" disabled={!key || busy}>{busy ? 'CHECKING...' : 'UNLOCK'}</button>
        </form>
        {err && <ErrorBox reason={err} />}
      </div>
    );
  }

  const sol = (l: number | null) => (l === null ? '—' : `${(l / 1e9).toFixed(4)} SOL`);

  return (
    <div className="mx-auto max-w-content px-4 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-head text-[20px]">OWNER · ${coin.ticker}</h1>
        <Link href={`/c/${coin.ticker}`} className="btn btn-sm">COIN PAGE</Link>
        <button className="btn btn-sm" onClick={() => { setCoin(null); setKey(''); }}>LOCK</button>
      </div>
      {busy && <PixelBar label="WORKING..." />}
      {err && <ErrorBox reason={err} />}
      {ok && <p className="font-head text-[10px] text-light">{ok}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6 flex flex-col gap-4">
          <h2 className="font-head text-[12px]">AGENT STATE</h2>
          <p className="text-[22px]">
            {coin.halted ? <span className="text-btn">HALTED: {coin.haltReason}</span> : coin.paused ? 'PAUSED' : 'ACTIVE'}
          </p>
          <div className="flex flex-wrap gap-2">
            {coin.paused || coin.halted ? (
              <button className="btn btn-coin" disabled={busy} onClick={() => call('resume')}>RESUME</button>
            ) : (
              <button className="btn" disabled={busy} onClick={() => call('pause')}>PAUSE</button>
            )}
            <button className="btn btn-primary" disabled={busy} onClick={() => call('stop', {}, 'Emergency stop halts every agent action until you resume. Continue?')}>EMERGENCY STOP</button>
          </div>
          <dl className="grid grid-cols-2 gap-1 text-[20px]">
            <dt className="text-dark">Creator wallet</dt><dd className="text-right">{sol(coin.creatorBalance)}</dd>
            <dt className="text-dark">Trading wallet</dt><dd className="text-right">{sol(coin.tradingBalance)}</dd>
          </dl>
        </section>

        <section className="card p-6 flex flex-col gap-4">
          <h2 className="font-head text-[12px]">MODE · SPLIT · STRATEGY</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['burn', 'trade', 'hybrid'] as const).map((m) => (
              <button key={m} className={`btn btn-sm ${form.agentMode === m ? 'btn-coin' : ''}`} onClick={() => setForm({ ...form, agentMode: m })}>{m.toUpperCase()}</button>
            ))}
          </div>
          {form.agentMode === 'hybrid' && (
            <label><span className="label">SPLIT {form.splitBurnPct}% BURN / {100 - form.splitBurnPct}% TRADE</span>
              <input type="range" min={0} max={100} step={5} value={form.splitBurnPct} onChange={(e) => setForm({ ...form, splitBurnPct: Number(e.target.value) })} className="w-full accent-[#B0306A]" />
            </label>
          )}
          {form.agentMode !== 'burn' && (
            <>
              <label><span className="label">STRATEGY</span>
                <select className="field" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
                  {STRATEGY_IDS.map((id) => <option key={id} value={id}>{STRATEGIES[id].label}</option>)}
                </select>
              </label>
              <label><span className="label">TRADING RESULTS GO TO</span>
                <select className="field" value={form.profitRoute} onChange={(e) => setForm({ ...form, profitRoute: e.target.value as Summary['profitRoute'] })}>
                  <option value="burn">BURN</option><option value="reinvest">REINVEST</option><option value="beneficiary">BENEFICIARY</option>
                </select>
              </label>
              {form.profitRoute === 'beneficiary' && (
                <label><span className="label">BENEFICIARY ADDRESS</span><input className="field" value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value.trim() })} /></label>
              )}
              <div className="flex items-center justify-between gap-2 border-t-4 border-ink pt-4">
                <span className="text-[20px]">Orders: {coin.tradeLive ? 'REAL' : 'DRY RUN'}</span>
                <button className="btn btn-sm" disabled={busy} onClick={() => call('live-trading', { enable: !coin.tradeLive }, coin.tradeLive ? undefined : 'Enable real orders with real SOL? Trading can lose money.')}>
                  {coin.tradeLive ? 'BACK TO DRY RUN' : 'ENABLE REAL ORDERS'}
                </button>
              </div>
            </>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => call('settings', form)}>SAVE SETTINGS</button>
        </section>

        <section className="card p-6 flex flex-col gap-4">
          <h2 className="font-head text-[12px]">WITHDRAW TRADING BALANCE</h2>
          <p className="text-[20px]">Sends the whole trading wallet balance ({sol(coin.tradingBalance)}) to an address you choose. Open positions stay open.</p>
          <input className="field" placeholder="Solana address" value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value.trim())} />
          <button className="btn btn-primary" disabled={busy || withdrawTo.length < 32} onClick={() => call('withdraw', { to: withdrawTo }, `Send the trading balance to ${withdrawTo}? This cannot be undone.`)}>WITHDRAW</button>
        </section>

        {term && (
          <section className="card p-6 flex flex-col gap-4">
            <h2 className="font-head text-[12px]">TERMINAL TEXTS</h2>
            {term.catchphrases.map((c, i) => (
              <input key={i} className="field text-[18px]" value={c} maxLength={80} onChange={(e) => { const cp = term.catchphrases.slice(); cp[i] = e.target.value; setTerm({ ...term, catchphrases: cp }); }} aria-label={`Catchphrase ${i + 1}`} />
            ))}
            <span className="label">CUSTOM COMMANDS</span>
            {term.commands.map((c, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr] gap-2">
                <input className="field text-[18px]" value={c.name} maxLength={12} onChange={(e) => { const cm = term.commands.slice(); cm[i] = { ...c, name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }; setTerm({ ...term, commands: cm }); }} aria-label={`Command ${i + 1} name`} />
                <input className="field text-[18px]" value={c.response} maxLength={200} onChange={(e) => { const cm = term.commands.slice(); cm[i] = { ...c, response: e.target.value }; setTerm({ ...term, commands: cm }); }} aria-label={`Command ${i + 1} response`} />
              </div>
            ))}
            <button className="btn btn-primary" disabled={busy} onClick={() => call('terminal', { terminal: term })}>SAVE TERMINAL</button>
          </section>
        )}
      </div>
    </div>
  );
}
