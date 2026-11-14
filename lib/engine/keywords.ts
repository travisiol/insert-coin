import { STOPWORDS, EMOJI_WORDS, ARCHETYPE_WORDS } from './words';
import { ARCHETYPES, type Archetype } from './types';

export interface Keyword { word: string; score: number }

/** Extract scored keywords from a post or idea. */
export function extractKeywords(text: string): Keyword[] {
  let t = text;
  for (const [emoji, word] of Object.entries(EMOJI_WORDS)) {
    if (t.includes(emoji)) t = t.split(emoji).join(` ${word} `);
  }
  t = t
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[#$]([a-z0-9_]+)/gi, ' $1 ')
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ');

  const counts = new Map<string, number>();
  const order = new Map<string, number>();
  let i = 0;
  for (const raw of t.split(/\s+/)) {
    const w = raw.replace(/^'+|'+$/g, '').replace(/'s$/, '');
    if (w.length < 2 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
    if (!order.has(w)) order.set(w, i++);
  }
  const list: Keyword[] = [];
  for (const [word, freq] of counts) {
    const lengthBonus = 1 + Math.min(word.length, 10) / 10;
    list.push({ word, score: freq * lengthBonus });
  }
  list.sort((a, b) => b.score - a.score || (order.get(a.word)! - order.get(b.word)!));
  return list;
}

export function matchArchetype(keywords: Keyword[]): Archetype | null {
  for (const k of keywords) {
    for (const a of ARCHETYPES) {
      if (ARCHETYPE_WORDS[a].includes(k.word)) return a;
    }
  }
  return null;
}

export function titleCase(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
