'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

/** localStorage key used to hand a Studio design to the launch flow. */
export const STUDIO_HANDOFF = 'ic:studio:launch';

// ---------- reduced motion ----------
export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

// ---------- shared animation clock (one interval for every sprite) ----------
type Sub = (t: number) => void;
const subs = new Set<Sub>();
let timer: ReturnType<typeof setInterval> | null = null;
export function subscribeClock(fn: Sub): () => void {
  subs.add(fn);
  if (!timer) timer = setInterval(() => { const t = performance.now(); subs.forEach((s) => s(t)); }, 60);
  return () => {
    subs.delete(fn);
    if (!subs.size && timer) { clearInterval(timer); timer = null; }
  };
}

// ---------- persisted toggles ----------
function makeToggle(key: string, def: boolean) {
  const listeners = new Set<() => void>();
  const get = () => {
    if (typeof window === 'undefined') return def;
    const v = localStorage.getItem(key);
    return v === null ? def : v === '1';
  };
  const set = (v: boolean) => {
    localStorage.setItem(key, v ? '1' : '0');
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
  return { get, set, subscribe, def };
}

export const crtPref = makeToggle('ic:crt', true);
export const soundPref = makeToggle('ic:sound', false);

export function useToggle(t: ReturnType<typeof makeToggle>): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(t.subscribe, t.get, () => t.def);
  return [v, t.set];
}
