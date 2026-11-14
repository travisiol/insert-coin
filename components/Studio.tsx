'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sprite from './Sprite';
import { renderFrame, encode, FRAME_COUNT, FRAME_MS, SCREEN_PALETTE } from '@/lib/engine/sprite';
import { buildCoin, accessoriesFor } from '@/lib/engine/build';
import {
  ARCHETYPES, LEGS, EYE_COUNT, MOUTH_COUNT, DRAWABLE_STATES, type DrawableState, type FighterSpec, type CustomFrames,
} from '@/lib/engine/types';
import { STUDIO_HANDOFF } from '@/lib/client/prefs';
import { play } from '@/lib/client/sound';

type Frames = Record<DrawableState, string[]>;
type Tool = 'pencil' | 'eraser' | 'fill';
const TONES = [1, 2, 3, 4, 0];
const STORE = 'ic:studio:designs';
const BLANK = '0'.repeat(1024);

function fromSpec(spec: FighterSpec): Frames {
  const out = {} as Frames;
  for (const s of DRAWABLE_STATES) out[s] = Array.from({ length: FRAME_COUNT[s] }, (_, f) => encode(renderFrame({ spec }, s, f)));
  return out;
}
function blankFrames(): Frames {
  return { idle: [BLANK], walk: [BLANK], profit: [BLANK], loss: [BLANK] };
}

interface Saved { id: string; name: string; spec: FighterSpec; frames: Frames; text: string; savedAt: number }

export default function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const initialText = params.get('text') ?? '';
  const initialSalt = Number(params.get('salt') ?? 0);
  const initialPick = Number(params.get('pick') ?? 0);
  const base = useMemo(() => buildCoin(initialText || 'pixel studio', initialSalt), [initialText, initialSalt]);
  const [spec, setSpec] = useState<FighterSpec>(base.candidates[initialPick] ?? base.candidates[0]);
  const [text, setText] = useState(initialText);
  const [frames, setFrames] = useState<Frames>(() => fromSpec(base.candidates[initialPick] ?? base.candidates[0]));
  const [state, setState] = useState<DrawableState>('idle');
  const [fi, setFi] = useState(0);
  const [tool, setTool] = useState<Tool>('pencil');
  const [tone, setTone] = useState(1);
  const [mirror, setMirror] = useState(true);
  const [onion, setOnion] = useState(true);
  const [undo, setUndo] = useState<Frames[]>([]);
  const [redo, setRedo] = useState<Frames[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [cell, setCell] = useState(14);
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(STORE) ?? '[]') as Saved[]); } catch { /* ignore */ }
    const fit = () => setCell(Math.max(8, Math.min(16, Math.floor((wrap.current?.clientWidth ?? 448) / 32))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const cur = frames[state][fi] ?? BLANK;

  const snapshot = useCallback(() => {
    setUndo((u) => [...u.slice(-49), frames]);
    setRedo([]);
  }, [frames]);

  const setPixel = useCallback((buf: string[], x: number, y: number, t: number) => {
    buf[y * 32 + x] = String(t);
    if (mirror) buf[y * 32 + (31 - x)] = String(t);
  }, [mirror]);

  const applyAt = useCallback((x: number, y: number) => {
    setFrames((fr) => {
      const list = fr[state].slice();
      const buf = (list[fi] ?? BLANK).split('');
      const t = tool === 'eraser' ? 0 : tone;
      if (tool === 'fill') {
        const target = buf[y * 32 + x];
        if (target === String(t)) return fr;
        const stack = [[x, y]];
        while (stack.length) {
          const [px, py] = stack.pop()!;
          if (px < 0 || py < 0 || px > 31 || py > 31 || buf[py * 32 + px] !== target) continue;
          setPixel(buf, px, py, t);
          stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
      } else setPixel(buf, x, y, t);
      list[fi] = buf.join('');
      return { ...fr, [state]: list };
    });
  }, [state, fi, tool, tone, setPixel]);

  // draw editor
  useEffect(() => {
    const c = cv.current?.getContext('2d');
    if (!c) return;
    const size = 32 * cell;
    c.clearRect(0, 0, size, size);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      c.fillStyle = (x + y) % 2 ? '#2C4A34' : '#26402E';
      c.fillRect(x * cell, y * cell, cell, cell);
    }
    const prev = onion && fi > 0 ? frames[state][fi - 1] : null;
    if (prev) {
      c.globalAlpha = 0.25;
      for (let i = 0; i < 1024; i++) if (prev[i] !== '0') { c.fillStyle = SCREEN_PALETTE[Number(prev[i])]; c.fillRect((i % 32) * cell, Math.floor(i / 32) * cell, cell, cell); }
      c.globalAlpha = 1;
    }
    for (let i = 0; i < 1024; i++) if (cur[i] !== '0') { c.fillStyle = SCREEN_PALETTE[Number(cur[i])]; c.fillRect((i % 32) * cell, Math.floor(i / 32) * cell, cell, cell); }
    if (mirror) { c.fillStyle = '#F2B70588'; c.fillRect(16 * cell - 1, 0, 2, size); }
  }, [cur, cell, onion, fi, frames, state, mirror]);

  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / cell), Math.floor((e.clientY - r.top) / cell)] as const;
  };

  const doUndo = () => { setUndo((u) => { if (!u.length) return u; setRedo((r) => [...r, frames]); setFrames(u[u.length - 1]); return u.slice(0, -1); }); };
  const doRedo = () => { setRedo((r) => { if (!r.length) return r; setUndo((u) => [...u, frames]); setFrames(r[r.length - 1]); return r.slice(0, -1); }); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const regenerate = (s: FighterSpec) => { snapshot(); setSpec(s); setFrames(fromSpec(s)); setFi(0); };

  async function generateFromText() {
    let t = text.trim();
    if (!t) return;
    if (/^https:\/\/(www\.)?(x|twitter)\.com\//.test(t)) {
      try { const j = (await (await fetch(`/api/oembed?url=${encodeURIComponent(t)}`)).json()) as { text?: string }; if (j.text) t = j.text; } catch { /* keep link */ }
      setText(t);
    }
    regenerate(buildCoin(t, 0).candidates[0]);
    play('coin');
  }

  function save() {
    const name = `${spec.archetype.toUpperCase()} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const entry: Saved = { id: String(Date.now()), name, spec, frames, text, savedAt: Date.now() };
    const next = [entry, ...saved].slice(0, 20);
    setSaved(next);
    localStorage.setItem(STORE, JSON.stringify(next));
    setMsg('SAVED');
    play('coin');
    setTimeout(() => setMsg(null), 1200);
  }

  function launchThis() {
    const custom: CustomFrames = {};
    for (const s of DRAWABLE_STATES) {
      const list = frames[s].filter((f) => f !== BLANK);
      if (list.length) custom[s] = list.slice(0, 4);
    }
    if (!custom.idle?.length) { setMsg('DRAW AN IDLE FRAME FIRST'); return; }
    localStorage.setItem(STUDIO_HANDOFF, JSON.stringify({ frames: custom, spec, text }));
    router.push('/launch?studio=1');
  }

  const custom: CustomFrames = frames;

  return (
    <div className="mx-auto max-w-content px-4 py-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 items-center">
          {(['pencil', 'eraser', 'fill'] as Tool[]).map((t) => (
            <button key={t} className={`btn btn-sm ${tool === t ? 'btn-coin' : ''}`} onClick={() => setTool(t)} aria-pressed={tool === t}>{t.toUpperCase()}</button>
          ))}
          <button className={`btn btn-sm ${mirror ? 'btn-coin' : ''}`} onClick={() => setMirror(!mirror)} aria-pressed={mirror}>MIRROR</button>
          <button className={`btn btn-sm ${onion ? 'btn-coin' : ''}`} onClick={() => setOnion(!onion)} aria-pressed={onion}>ONION</button>
          <button className="btn btn-sm" onClick={doUndo} disabled={!undo.length}>UNDO</button>
          <button className="btn btn-sm" onClick={doRedo} disabled={!redo.length}>REDO</button>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Tone">
          {TONES.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={tone === t}
              aria-label={t === 0 ? 'transparent' : `tone ${t}`}
              onClick={() => { setTone(t); if (tool === 'eraser') setTool('pencil'); }}
              className={`w-11 h-11 border-4 ${tone === t ? 'border-coin' : 'border-edge'}`}
              style={{ background: t === 0 ? 'repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px' : SCREEN_PALETTE[t] }}
            />
          ))}
        </div>
        <div ref={wrap} className="w-full max-w-[512px]">
          <canvas
            ref={cv}
            width={32 * cell}
            height={32 * cell}
            className="touch-none border-4 border-edge block"
            onPointerDown={(e) => { snapshot(); drawing.current = true; cv.current!.setPointerCapture(e.pointerId); const [x, y] = pos(e); applyAt(x, y); }}
            onPointerMove={(e) => { if (!drawing.current || tool === 'fill') return; const [x, y] = pos(e); if (x >= 0 && y >= 0 && x < 32 && y < 32) applyAt(x, y); }}
            onPointerUp={() => { drawing.current = false; }}
            aria-label="32 by 32 pixel editor"
          />
        </div>
        {/* timeline */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {DRAWABLE_STATES.map((s) => (
              <button key={s} className={`btn btn-sm ${state === s ? 'btn-coin' : ''}`} onClick={() => { setState(s); setFi(0); }}>{s.toUpperCase()}</button>
            ))}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {frames[state].map((f, i) => (
              <button key={i} onClick={() => setFi(i)} className={`border-4 ${fi === i ? 'border-coin' : 'border-edge'} bg-tile p-1`} aria-label={`Frame ${i + 1}`}>
                <Sprite spec={spec} frames={{ idle: [f] }} scale={2} animate={false} />
              </button>
            ))}
            {frames[state].length < 4 && (
              <button className="btn btn-sm" onClick={() => { snapshot(); setFrames((fr) => ({ ...fr, [state]: [...fr[state], fr[state][fi] ?? BLANK] })); setFi(frames[state].length); }}>+ FRAME</button>
            )}
            {frames[state].length > 1 && (
              <button className="btn btn-sm" onClick={() => { snapshot(); setFrames((fr) => ({ ...fr, [state]: fr[state].filter((_, i) => i !== fi) })); setFi(Math.max(0, fi - 1)); }}>DELETE</button>
            )}
            <button className="btn btn-sm" onClick={() => { snapshot(); setFrames((fr) => { const l = fr[state].slice(); l[fi] = BLANK; return { ...fr, [state]: l }; }); }}>CLEAR</button>
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="card p-4 flex flex-col items-center gap-2">
          <span className="font-head text-[8px]">PREVIEW · {state.toUpperCase()}</span>
          <div className="bg-tile p-4"><Preview frames={custom} state={state} spec={spec} /></div>
        </div>
        <div className="card p-4 flex flex-col gap-2">
          <span className="label">START FROM</span>
          <button className="btn btn-sm" onClick={() => { snapshot(); setFrames(blankFrames()); setFi(0); }}>BLANK</button>
          <textarea className="field h-20 resize-none text-[18px]" placeholder="text or X post link..." value={text} maxLength={280} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-sm" onClick={generateFromText} disabled={!text.trim()}>GENERATE FROM TEXT</button>
          <span className="label mt-2">PARTS</span>
          <PartSelect label="ARCHETYPE" value={spec.archetype} options={ARCHETYPES} onChange={(v) => { const a = v as FighterSpec['archetype']; const accs = accessoriesFor(a); regenerate({ ...spec, archetype: a, accessory: accs.includes(spec.accessory) ? spec.accessory : 'none' }); }} />
          <PartSelect label="EYES" value={String(spec.eyes)} options={Array.from({ length: EYE_COUNT }, (_, i) => String(i))} onChange={(v) => regenerate({ ...spec, eyes: Number(v) })} />
          <PartSelect label="MOUTH" value={String(spec.mouth)} options={Array.from({ length: MOUTH_COUNT }, (_, i) => String(i))} onChange={(v) => regenerate({ ...spec, mouth: Number(v) })} />
          <PartSelect label="ACCESSORY" value={spec.accessory} options={accessoriesFor(spec.archetype)} onChange={(v) => regenerate({ ...spec, accessory: v as FighterSpec['accessory'] })} />
          <PartSelect label="LEGS" value={spec.legs} options={LEGS} onChange={(v) => regenerate({ ...spec, legs: v as FighterSpec['legs'] })} />
        </div>
        <div className="card p-4 flex flex-col gap-2">
          <button className="btn btn-sm" onClick={save}>SAVE</button>
          <button className="btn btn-primary" onClick={launchThis}>LAUNCH THIS FIGHTER</button>
          {msg && <span className="font-head text-[8px] text-dark">{msg}</span>}
        </div>
        {saved.length > 0 && (
          <div className="card p-4 flex flex-col gap-2">
            <span className="label">SAVED ({saved.length})</span>
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="bg-tile p-1"><Sprite spec={s.spec} frames={{ idle: s.frames.idle }} scale={1} animate={false} /></div>
                <button className="flex-1 text-left text-[18px] hover:underline" onClick={() => { snapshot(); setSpec(s.spec); setFrames(s.frames); setText(s.text); setFi(0); }}>{s.name}</button>
                <button className="font-head text-[8px]" aria-label={`Delete ${s.name}`} onClick={() => { const n = saved.filter((x) => x.id !== s.id); setSaved(n); localStorage.setItem(STORE, JSON.stringify(n)); }}>X</button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function PartSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <label className="grid grid-cols-[96px_1fr] items-center gap-2">
      <span className="font-head text-[8px]">{label}</span>
      <select className="field text-[18px] py-1" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
      </select>
    </label>
  );
}

function Preview({ frames, state, spec }: { frames: CustomFrames; state: DrawableState; spec: FighterSpec }) {
  const list = frames[state] ?? [];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), FRAME_MS[state]);
    return () => clearInterval(t);
  }, [state]);
  const f = list.length ? list[i % list.length] : BLANK;
  return <Sprite spec={spec} frames={{ idle: [f] }} scale={4} animate={false} />;
}
