'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Sprite from './Sprite';
import type { FighterSpec, CustomFrames } from '@/lib/engine/types';
import type { Personality } from '@/lib/engine/personality';
import type { FeedEvent, LedgerView, Scorecard } from '@/lib/server/views';
import type { DexPair } from '@/lib/market';
import { reply } from '@/lib/engine/say';
import { eventText } from '@/lib/agent/events';
import { fmtUsd, fmtPct } from '@/lib/market';
import { PixelBar, ErrorBox } from './ui';
import { play } from '@/lib/client/sound';
import { useReducedMotion } from '@/lib/client/prefs';

interface CoinData {
  coin: {
    id: number; mint: string; name: string; ticker: string; story: string; spec: FighterSpec; frames: CustomFrames | null; level: number;
    status: string; agentMode: string; strategy: string; splitBurnPct: number; paused: boolean; halted: boolean; haltReason: string | null;
    sleeping: boolean; tradeLive: boolean; createdAt: string; terminal: Personality; creatorWallet: string;
  };
  ledger: LedgerView[];
  events: FeedEvent[];
  score: Scorecard;
  pair: DexPair | null;
}

type Line = { text: string; kind: 'out' | 'in' | 'sys' };

export default function Terminal({ ticker }: { ticker: string }) {
  const [data, setData] = useState<CoinData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState<{ text: string; n: number } | null>(null);
  const queue = useRef<string[]>([]);
  const [qv, setQv] = useState(0);
  const greeted = useRef<number | null>(null);
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(`/api/coin/${ticker}`);
      if (r.status === 404) throw new Error(`No fighter called $${ticker.toUpperCase()} lives here.`);
      if (!r.ok) throw new Error('The terminal could not reach the server.');
      setData((await r.json()) as CoinData);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'unavailable');
    }
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

  const say = useCallback((...texts: string[]) => {
    queue.current.push(...texts);
    setQv((v) => v + 1);
  }, []);

  // start the next queued line when idle (no mutation inside state updaters)
  useEffect(() => {
    if (!typing && queue.current.length) setTyping({ text: queue.current.shift()!, n: 0 });
  }, [typing, qv]);

  // typewriter: 25 ms per char
  useEffect(() => {
    if (!typing) return;
    if (reduced || typing.n >= typing.text.length) {
      setLines((l) => [...l, { text: typing.text, kind: 'out' }]);
      setTyping(null);
      return;
    }
    const t = setTimeout(() => {
      setTyping({ ...typing, n: typing.n + 1 });
      if (typing.n % 3 === 0) play('type');
    }, 25);
    return () => clearTimeout(t);
  }, [typing, reduced]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [lines, typing]);

  useEffect(() => {
    if (!data || greeted.current === data.coin.id) return;
    greeted.current = data.coin.id;
    const c = data.coin;
    say(`INSERT COIN TERMINAL v1 · $${c.ticker}`, `${c.name} is online. ${c.terminal.catchphrases[0] ?? ''}`, 'Type "help" for commands.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.coin.id]);

  if (err) return <ErrorBox reason={err} onRetry={load} />;
  if (!data) return <PixelBar />;
  const c = data.coin;
  const p = data.pair;
  const price = p?.priceUsd ? `$${Number(p.priceUsd).toPrecision(4)}` : 'N/A';
  const eventsText = data.events.map((e) => eventText(e.type, e.payload, e.ticker));
  const score = data.score;
  const ledger = data.ledger;

  function run(raw: string) {
    const input = raw.trim();
    if (!input) return;
    setLines((l) => [...l, { text: `> ${input}`, kind: 'in' }]);
    setHistory((h) => [input, ...h].slice(0, 50));
    setHIdx(-1);
    const [name, ...rest] = input.replace(/^\//, '').split(/\s+/);
    const arg = rest.join(' ');
    const custom = c.terminal.commands.find((x) => x.name === name.toLowerCase());
    switch (name.toLowerCase()) {
      case 'help':
        say(
          'help · story · about · chart · buy · world · status · ledger · say <text> · clear',
          `custom: ${c.terminal.commands.map((x) => x.name).join(' · ')}`,
        );
        break;
      case 'story':
        say(c.story);
        break;
      case 'about':
        say(`name: ${c.name} · ticker: $${c.ticker}`, `CA: ${c.mint}`, `creator wallet: ${c.creatorWallet}`, `launched: ${c.createdAt.slice(0, 10)} · voice: ${c.terminal.voice} · likes: ${c.terminal.likes.join(', ')} · enemy: ${c.terminal.enemy}`);
        break;
      case 'chart':
        say(`price ${price} · mcap ${fmtUsd(p?.marketCap ?? p?.fdv)} · 1h ${fmtPct(p?.priceChange?.h1)} · 24h ${fmtPct(p?.priceChange?.h24)}`, 'Data from DexScreener. Not advice.');
        break;
      case 'buy':
        say(c.status === 'bonded' ? 'Opening Jupiter...' : 'Opening pump.fun...');
        window.open(c.status === 'bonded' ? `https://jup.ag/swap/SOL-${c.mint}` : `https://pump.fun/coin/${c.mint}`, '_blank', 'noopener');
        break;
      case 'world':
        say('Opening the arcade...');
        window.location.href = `/arcade?focus=${c.ticker}`;
        break;
      case 'status': {
        const st = c.halted ? `HALTED (${c.haltReason})` : c.paused ? 'PAUSED' : c.sleeping ? 'SLEEPING' : 'ACTIVE';
        const mode = c.agentMode === 'hybrid' ? `HYBRID ${c.splitBurnPct}/${100 - c.splitBurnPct}` : c.agentMode.toUpperCase();
        say(
          `agent: ${st} · mode: ${mode}${c.agentMode !== 'burn' ? ` · strategy: ${c.strategy} · ${c.tradeLive ? 'real orders' : 'dry run'}` : ''}`,
          `fees in: ${(score.feesIn / 1e9).toFixed(4)} SOL · burned: ${Math.round(score.burnedTokens).toLocaleString('en-US')} · open trades: ${score.openTrades.length}`,
          `last event: ${eventsText[0] ?? 'none yet'}`,
        );
        break;
      }
      case 'ledger':
        if (!ledger.length) say('Ledger is empty.');
        else say(...ledger.slice(0, 10).map((l) => `${l.ts.slice(5, 16).replace('T', ' ')} ${l.wallet.padEnd(8)} ${l.kind.padEnd(13)} ${(l.sol / 1e9).toFixed(6)} SOL${l.txSig ? ` ${l.txSig.slice(0, 8)}…` : ''}`));
        break;
      case 'say':
        say(reply(arg || 'hi', {
          name: c.name, ticker: c.ticker, personality: c.terminal, price, change1h: fmtPct(p?.priceChange?.h1),
          mcap: fmtUsd(p?.marketCap ?? p?.fdv), events: eventsText.slice(0, 5),
        }));
        break;
      case 'clear':
        setLines([]);
        break;
      default:
        if (custom) say(custom.response);
        else say(reply(input, {
          name: c.name, ticker: c.ticker, personality: c.terminal, price, change1h: fmtPct(p?.priceChange?.h1),
          mcap: fmtUsd(p?.marketCap ?? p?.fdv), events: eventsText.slice(0, 5),
        }));
    }
  }

  return (
    <div className="h-full flex flex-col bg-ink text-light font-body text-[22px] crt-layer" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-4 p-4 border-b-4 border-dark">
        <Sprite spec={c.spec} frames={c.frames} level={c.level} scale={2} state={c.sleeping ? 'sleep' : 'idle'} />
        <div className="flex-1">
          <div className="font-head text-[10px] text-paper">{c.name}</div>
          <div className="font-head text-[8px] text-coin">${c.ticker} · {price}</div>
        </div>
        <Link href={`/c/${c.ticker}`} className="btn btn-sm">COIN PAGE</Link>
      </div>
      <div className="flex-1 overflow-auto p-4" role="log" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words ${l.kind === 'in' ? 'text-paper' : 'text-light'}`}>{l.text}</div>
        ))}
        {typing && <div className="whitespace-pre-wrap break-words">{typing.text.slice(0, typing.n)}<span className="blink bg-light inline-block w-3 h-5 align-middle" /></div>}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-2 p-4 border-t-4 border-dark"
        onSubmit={(e) => { e.preventDefault(); run(cmd); setCmd(''); }}
      >
        <span className="text-coin">&gt;</span>
        <label htmlFor="term-in" className="sr-only">Command</label>
        <input
          id="term-in"
          ref={inputRef}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); const i = Math.min(history.length - 1, hIdx + 1); setHIdx(i); setCmd(history[i] ?? ''); }
            if (e.key === 'ArrowDown') { e.preventDefault(); const i = Math.max(-1, hIdx - 1); setHIdx(i); setCmd(i < 0 ? '' : history[i]); }
          }}
          className="flex-1 bg-transparent outline-none text-paper caret-light"
          autoComplete="off"
          autoFocus
          spellCheck={false}
          placeholder="type help"
        />
      </form>
    </div>
  );
}
