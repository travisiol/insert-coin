'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Sprite from './Sprite';
import { buildCoin, sanitizeTicker, personalityFor } from '@/lib/engine/build';
import type { FighterSpec, CustomFrames } from '@/lib/engine/types';
import { STRATEGIES, STRATEGY_IDS, type StrategyId } from '@/lib/agent/strategies';
import { PixelBar, ErrorBox, Confetti, CopyButton } from './ui';
import { play } from '@/lib/client/sound';
import { STUDIO_HANDOFF } from '@/lib/client/prefs';
import { fmtUsd } from '@/lib/market';

type Mode = 'burn' | 'trade' | 'hybrid';
type Route = 'burn' | 'reinvest' | 'beneficiary';
const X_LINK = /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/;
const PROGRESS = ['UPLOADING', 'CREATING WALLETS', 'LAUNCHING ON PUMP.FUN', 'CONFIRMED', 'LIVE'] as const;

interface Twin { count: number; top: { name: string; symbol: string; mcap: number; ageDays: number | null; url: string }[] }
interface Result { mint: string; ticker: string; ownerKey: string; sig: string }


export default function LaunchFlow() {
  const params = useSearchParams();
  const t0 = useRef(Date.now());
  const [step, setStep] = useState(1);
  const [raw, setRaw] = useState(params.get('q') ?? '');
  const [input, setInput] = useState('');
  const [twitterUrl, setTwitterUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [salt, setSalt] = useState(0);
  const [pick, setPick] = useState(0);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [story, setStory] = useState('');
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState<{ frames: CustomFrames; spec: FighterSpec } | null>(null);
  const [mode, setMode] = useState<Mode>('burn');
  const [split, setSplit] = useState(50);
  const [strategy, setStrategy] = useState<StrategyId>('momentum');
  const [route, setRoute] = useState<Route>('reinvest');
  const [beneficiary, setBeneficiary] = useState('');
  const [hp, setHp] = useState('');
  const [twin, setTwin] = useState<Twin | null | 'error'>(null);
  const [config, setConfig] = useState<{ canLaunch: boolean; reason: string | null } | null>(null);
  const [progress, setProgress] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(false);

  const draft = useMemo(() => (input ? buildCoin(input, salt) : null), [input, salt]);

  // studio handoff
  useEffect(() => {
    if (params.get('studio') !== '1') return;
    try {
      const j = JSON.parse(localStorage.getItem(STUDIO_HANDOFF) ?? 'null') as { frames: CustomFrames; spec: FighterSpec; text?: string } | null;
      if (j?.frames?.idle?.length) {
        setCustom({ frames: j.frames, spec: j.spec });
        if (j.text) setRaw(j.text);
      }
    } catch {
      /* ignore */
    }
  }, [params]);

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => setConfig({ canLaunch: false, reason: 'SERVER UNREACHABLE.' }));
  }, []);

  useEffect(() => {
    if (!draft) return;
    setName(draft.name);
    setTicker(draft.ticker);
    setStory(draft.story);
    setPick(0);
  }, [draft]);

  const chosen: FighterSpec | null = custom ? { ...custom.spec, ticker } : draft ? { ...draft.candidates[pick], ticker } : null;
  const personality = useMemo(() => (input && name && ticker ? personalityFor(input, salt, name, ticker) : null), [input, salt, name, ticker]);

  async function submitInput() {
    const v = raw.trim();
    if (!v) return;
    setNote(null);
    if (X_LINK.test(v)) {
      setFetching(true);
      try {
        const r = await fetch(`/api/oembed?url=${encodeURIComponent(v)}`);
        const j = (await r.json()) as { text?: string; fallback?: boolean; note?: string };
        setInput(j.text || v);
        setTwitterUrl(v.split('?')[0]);
        if (j.fallback) setNote('Paste the post text for a better result');
      } catch {
        setInput(v);
        setNote('Paste the post text for a better result');
      } finally {
        setFetching(false);
      }
    } else {
      setInput(v);
      setTwitterUrl(null);
    }
    play('coin');
    setStep(2);
  }

  useEffect(() => {
    if (step !== 4 || !ticker) return;
    setTwin(null);
    fetch(`/api/twin?t=${ticker}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Twin) => setTwin(j))
      .catch(() => setTwin('error'));
  }, [step, ticker]);

  async function launch() {
    if (!chosen || !personality) return;
    setError(null);
    setProgress(0);
    play('coin');
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input, salt, name, ticker, story, spec: chosen, frames: custom?.frames ?? null,
          agentMode: mode, splitBurnPct: split, strategy, profitRoute: route, beneficiary, twitter: twitterUrl,
          website: hp, t0: t0.current,
        }),
      });
      if (!res.body) throw new Error('NETWORK IS BUSY, TRY AGAIN.');
      if (res.headers.get('content-type')?.includes('application/json')) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? 'NETWORK IS BUSY, TRY AGAIN.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const m = JSON.parse(line) as { step?: string; done?: boolean; error?: string } & Partial<Result>;
          if (m.step) setProgress(PROGRESS.indexOf(m.step as (typeof PROGRESS)[number]));
          if (m.error) throw new Error(m.error);
          if (m.done && m.mint) {
            setResult({ mint: m.mint, ticker: m.ticker!, ownerKey: m.ownerKey!, sig: m.sig! });
            play('levelup');
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'NETWORK IS BUSY, TRY AGAIN.');
      setProgress(-1);
    }
  }

  function downloadKey() {
    if (!result) return;
    const txt = `INSERT COIN OWNER KEY\n\nCoin: ${name} ($${result.ticker})\nMint: ${result.mint}\nOwner key: ${result.ownerKey}\n\nTHIS KEY CONTROLS YOUR AGENT. IT IS SHOWN ONCE. WE CANNOT RECOVER IT.\nUse it at /owner\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `insert-coin-${result.ticker}-owner-key.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const launching = progress >= 0 && !result;

  return (
    <div className="mx-auto max-w-content px-4 py-8 grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="cabinet order-2 lg:order-1">
        {/* step indicator */}
        <ol className="flex gap-2 mb-6" aria-label="Steps">
          {['POST OR IDEA', 'ENGINE BUILDS', 'PICK THE AGENT', 'LAUNCH'].map((l, i) => (
            <li key={l} className={`flex-1 border-4 border-edge p-2 font-head text-[8px] leading-4 ${step === i + 1 ? 'bg-coin text-ink' : step > i + 1 ? 'bg-light text-ink' : 'bg-shell text-edge'}`}>
              0{i + 1} <span className="hidden sm:inline">{l}</span>
            </li>
          ))}
        </ol>

        <div className="screen p-4 sm:p-6 min-h-[480px]">
          {step === 1 && (
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submitInput(); }}>
              <label className="label text-light" htmlFor="idea">01 · POST OR IDEA</label>
              <textarea
                id="idea"
                className="field h-40 resize-none"
                maxLength={280}
                placeholder="paste an X post link or type an idea..."
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                autoFocus
              />
              <div className="flex justify-between items-center">
                <span className="text-light text-[18px]">{raw.length}/280 {X_LINK.test(raw.trim()) ? '· X post link detected' : ''}</span>
                <button className="btn btn-primary" disabled={!raw.trim() || fetching}>{fetching ? 'READING...' : 'BUILD'}</button>
              </div>
              {custom && <p className="text-coin text-[18px]">Studio fighter loaded. The engine will still write the name, ticker and story.</p>}
            </form>
          )}

          {step === 2 && draft && (
            <div className="flex flex-col gap-6">
              {note && <p className="text-coin text-[18px]">{note}</p>}
              <div>
                <span className="label text-light">02 · {custom ? 'YOUR STUDIO FIGHTER' : 'PICK A FIGHTER'}</span>
                {custom ? (
                  <div className="bg-tile p-4 inline-block border-4 border-coin"><Sprite spec={{ ...custom.spec, ticker }} frames={custom.frames} scale={4} /></div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {draft.candidates.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => { setPick(i); play('jump'); }}
                        className={`p-2 border-4 flex flex-col items-center gap-2 ${pick === i ? 'border-coin bg-tile' : 'border-dark'}`}
                        aria-pressed={pick === i}
                        aria-label={`Fighter ${i + 1}: ${c.archetype}`}
                      >
                        <Sprite spec={{ ...c, ticker }} scale={3} state={pick === i ? 'walk' : 'idle'} />
                        <span className="font-head text-[8px] text-light uppercase">{c.archetype}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {editing ? (
                <div className="grid gap-4">
                  <label><span className="label text-light">NAME</span><input className="field" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} /></label>
                  <label><span className="label text-light">TICKER (3-8, A-Z 0-9)</span><input className="field uppercase" value={ticker} onChange={(e) => setTicker(sanitizeTicker(e.target.value))} /></label>
                  <label><span className="label text-light">STORY ({story.length}/240)</span><textarea className="field h-28 resize-none" maxLength={240} value={story} onChange={(e) => setStory(e.target.value)} /></label>
                </div>
              ) : (
                <div className="grid gap-2">
                  <div className="font-head text-[16px] text-paper leading-6">{name}</div>
                  <div className="font-head text-[12px] text-coin">${ticker}</div>
                  <p className="text-[22px] text-light">{story}</p>
                  {personality && (
                    <p className="text-[18px] text-paper">VOICE: {personality.voice.toUpperCase()} · &quot;{personality.catchphrases[0]}&quot; · commands: {personality.commands.map((c) => `/${c.name}`).join(' ')}</p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => { setSalt(salt + 1); play('jump'); }}>REROLL</button>
                <button className="btn btn-sm" onClick={() => setEditing(!editing)}>{editing ? 'DONE' : 'EDIT'}</button>
                <Link className="btn btn-sm" href={`/studio?text=${encodeURIComponent(input)}&salt=${salt}&pick=${pick}`}>OPEN IN STUDIO</Link>
                <button className="btn btn-sm" onClick={() => setStep(1)}>BACK</button>
                <button className="btn btn-primary ml-auto" disabled={ticker.length < 3 || !name.trim() || !story.trim()} onClick={() => setStep(3)}>NEXT</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6">
              <span className="label text-light">03 · PICK THE AGENT</span>
              <div className="grid grid-cols-3 gap-2">
                {(['burn', 'trade', 'hybrid'] as Mode[]).map((m) => (
                  <button key={m} className={`border-4 p-4 font-head text-[10px] ${mode === m ? 'border-coin bg-coin text-ink' : 'border-dark text-paper'}`} onClick={() => setMode(m)} aria-pressed={mode === m}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-[20px] text-light">
                {mode === 'burn' && 'Fees buy the coin back and burn exactly what was bought. Price impact capped at 2% per chunk.'}
                {mode === 'trade' && 'Fees fund a trading wallet that follows one rule-based strategy. Dry-run for 24 h first. Real SOL, real risk.'}
                {mode === 'hybrid' && 'Split each fee collection between buyback & burn and trading.'}
              </p>
              {mode === 'hybrid' && (
                <label>
                  <span className="label text-light">SPLIT: {split}% BURN / {100 - split}% TRADE</span>
                  <input type="range" min={0} max={100} step={5} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full accent-[#F2B705]" />
                </label>
              )}
              {mode !== 'burn' && (
                <>
                  <label>
                    <span className="label text-light">STRATEGY</span>
                    <select className="field" value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyId)}>
                      {STRATEGY_IDS.map((id) => <option key={id} value={id}>{STRATEGIES[id].label} — TP +{STRATEGIES[id].tp * 100}% / SL -{STRATEGIES[id].sl * 100}%</option>)}
                    </select>
                  </label>
                  <p className="text-[18px] text-light">{STRATEGIES[strategy].entry}.</p>
                  <fieldset>
                    <legend className="label text-light">TRADING RESULTS GO TO</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(['burn', 'reinvest', 'beneficiary'] as Route[]).map((r) => (
                        <button key={r} className={`border-4 p-2 font-head text-[8px] ${route === r ? 'border-coin bg-coin text-ink' : 'border-dark text-paper'}`} onClick={() => setRoute(r)} aria-pressed={route === r}>
                          {r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {route === 'beneficiary' && (
                    <label><span className="label text-light">BENEFICIARY SOLANA ADDRESS</span><input className="field" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value.trim())} placeholder="address that receives realised profits" /></label>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => setStep(2)}>BACK</button>
                <button className="btn btn-primary ml-auto" disabled={mode !== 'burn' && route === 'beneficiary' && beneficiary.length < 32} onClick={() => setStep(4)}>NEXT</button>
              </div>
            </div>
          )}

          {step === 4 && !result && (
            <div className="flex flex-col gap-6">
              <span className="label text-light">04 · LAUNCH</span>
              <div className="border-4 border-dark p-4 text-[20px]">
                {twin === null && <span className="text-light">Checking ${ticker} on Solana...</span>}
                {twin === 'error' && <span className="text-light">CHECK UNAVAILABLE</span>}
                {twin && twin !== 'error' && twin.count === 0 && <span className="text-light">No other Solana token uses ${ticker}.</span>}
                {twin && twin !== 'error' && twin.count > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-coin">{twin.count} tokens already use ${ticker}. Pick another or go anyway.</span>
                    {twin.top.map((t) => (
                      <a key={t.url} href={t.url} target="_blank" rel="noreferrer" className="text-paper hover:text-coin">
                        {t.name} · {fmtUsd(t.mcap)} · {t.ageDays === null ? '?' : `${t.ageDays}d`} old
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[20px]">
                <dt className="text-light">Name</dt><dd>{name}</dd>
                <dt className="text-light">Ticker</dt><dd>${ticker}</dd>
                <dt className="text-light">Agent</dt><dd>{mode === 'hybrid' ? `HYBRID ${split}/${100 - split}` : mode.toUpperCase()}{mode !== 'burn' ? ` · ${STRATEGIES[strategy].label} · results: ${route}` : ''}</dd>
                <dt className="text-light">Cost to you</dt><dd>0 SOL. No wallet needed.</dd>
              </dl>
              <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
              {config && !config.canLaunch && <p className="font-head text-[10px] text-btn leading-5">{config.reason}</p>}
              {launching ? (
                <div className="flex flex-col gap-2">
                  {PROGRESS.map((p, i) => (
                    <div key={p} className={`font-head text-[10px] ${i < progress ? 'text-light' : i === progress ? 'text-coin blink' : 'text-dark'}`}>
                      {i < progress ? '[OK]' : i === progress ? '[..]' : '[  ]'} {p}
                    </div>
                  ))}
                  <PixelBar label="ABOUT A MINUTE..." />
                </div>
              ) : error ? (
                <ErrorBox reason={error} onRetry={launch} />
              ) : (
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={() => setStep(3)}>BACK</button>
                  <button className="btn btn-primary ml-auto" onClick={launch} disabled={!config?.canLaunch}>LAUNCH</button>
                </div>
              )}
            </div>
          )}

          {result && !done && (
            <div className="flex flex-col gap-6">
              <span className="font-head text-[12px] text-btn blink">OWNER KEY</span>
              <p className="font-head text-[10px] text-coin leading-5">THIS KEY CONTROLS YOUR AGENT. IT IS SHOWN ONCE. WE CANNOT RECOVER IT.</p>
              <code className="field break-all text-[20px] select-all">{result.ownerKey}</code>
              <div className="flex gap-2 flex-wrap">
                <CopyButton text={result.ownerKey} />
                <button className="btn btn-sm" onClick={downloadKey}>DOWNLOAD .TXT</button>
              </div>
              <label className="flex items-center gap-2 text-[20px]">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="w-6 h-6 accent-[#F2B705]" />
                I saved it
              </label>
              <button className="btn btn-primary" disabled={!saved} onClick={() => { setDone(true); play('coin'); }}>CONTINUE</button>
            </div>
          )}

          {result && done && (
            <div className="flex flex-col items-center gap-6 text-center">
              <Confetti on />
              <div className="coin-drop w-12 h-12 bg-coin border-4 border-coinshade" aria-hidden />
              <span className="font-head text-[16px] text-coin">LIVE</span>
              {chosen && <div className="dissolve"><Sprite spec={chosen} frames={custom?.frames} scale={4} state="bonded" /></div>}
              <p className="text-[22px] text-light">${result.ticker} is live on pump.fun. Its agent starts working on the next fee collection.</p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Link className="btn btn-coin" href={`/c/${result.ticker}`}>OPEN COIN PAGE</Link>
                <a className="btn btn-sm" href={`https://pump.fun/coin/${result.mint}`} target="_blank" rel="noreferrer">PUMP.FUN</a>
                <a className="btn btn-sm" href={`https://solscan.io/tx/${result.sig}`} target="_blank" rel="noreferrer">SOLSCAN TX</a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* live card preview */}
      <aside className="order-1 lg:order-2 flex flex-col gap-4">
        <div className="card p-6 flex flex-col items-center gap-4">
          <span className="font-head text-[8px] text-dark">COIN CARD PREVIEW</span>
          <div className="bg-tile p-4">
            {chosen ? <Sprite spec={chosen} frames={custom?.frames} scale={6} state={step === 3 ? (mode === 'burn' ? 'burn' : mode === 'trade' ? 'trading' : 'buyback') : 'idle'} /> : <div className="w-[192px] h-[192px] grid place-items-center font-head text-[10px] text-light blink">INSERT COIN</div>}
          </div>
          <div className="font-head text-[12px] text-center leading-5">{name || '???'}</div>
          <div className="font-head text-[10px] text-dark">${ticker || '???'}</div>
        </div>
      </aside>
    </div>
  );
}
