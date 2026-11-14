'use client';
/** Square-wave blips with WebAudio. Muted by default (speaker toggle in header). */
import { soundPref } from './prefs';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol = 0.05) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.01);
}

export type Sfx = 'coin' | 'jump' | 'hit' | 'burn' | 'levelup' | 'type';

export function play(s: Sfx) {
  if (!soundPref.get()) return;
  switch (s) {
    case 'coin': tone(988, 0, 0.08); tone(1319, 0.08, 0.3); break;
    case 'jump': tone(440, 0, 0.05); tone(660, 0.05, 0.05); tone(880, 0.1, 0.05); break;
    case 'hit': tone(196, 0, 0.08); tone(110, 0.08, 0.15); break;
    case 'burn': tone(150, 0, 0.06, 0.04); tone(120, 0.06, 0.06, 0.04); tone(90, 0.12, 0.1, 0.04); break;
    case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.08)); break;
    case 'type': tone(1800, 0, 0.012, 0.015); break;
  }
}
