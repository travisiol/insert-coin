import { rngFor, pick, int, shuffle, type Rng } from './rng';
import { extractKeywords, matchArchetype, titleCase } from './keywords';
import { ADJECTIVES, SUFFIXES, NOUNS_FALLBACK } from './words';
import { buildStory } from './story';
import { buildPersonality, type Personality } from './personality';
import { ARCHETYPES, ACCESSORIES, LEGS, EYE_COUNT, MOUTH_COUNT, type Archetype, type FighterSpec } from './types';

export interface CoinDraft {
  input: string;
  salt: number;
  name: string;
  ticker: string;
  story: string;
  personality: Personality;
  candidates: FighterSpec[];
}

export function sanitizeTicker(t: string): string {
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function tickerFromName(name: string, fallback: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  let t = words[0] ?? '';
  if (t.length < 3) t = words.join('');
  t = sanitizeTicker(t);
  if (t.length < 3) t = sanitizeTicker(t + fallback.toUpperCase());
  if (t.length < 3) t = (t + 'XXX').slice(0, 3);
  return t.slice(0, 8);
}

/** Archetypes that already wear something on their head only take body accessories. */
const HEADWEAR_ARCHETYPES: Archetype[] = ['wizard', 'knight', 'astronaut', 'rocket', 'frog'];
const BODY_ACCESSORIES = ['scarf', 'cape', 'none'] as const;

export function accessoriesFor(a: Archetype): readonly (typeof ACCESSORIES)[number][] {
  return HEADWEAR_ARCHETYPES.includes(a) ? BODY_ACCESSORIES : ACCESSORIES;
}

function spec(rng: Rng, archetype: Archetype, ticker: string): FighterSpec {
  return {
    archetype,
    eyes: int(rng, 0, EYE_COUNT - 1),
    mouth: int(rng, 0, MOUTH_COUNT - 1),
    accessory: pick(rng, accessoriesFor(archetype)),
    legs: pick(rng, LEGS),
    ticker,
  };
}

/** Build the whole coin deterministically from text + salt. */
export function buildCoin(input: string, salt = 0): CoinDraft {
  const rng = rngFor(input, salt);
  const kws = extractKeywords(input);
  const k1 = kws[0]?.word ?? pick(rng, NOUNS_FALLBACK);
  const k2 = kws[1]?.word ?? pick(rng, NOUNS_FALLBACK.filter((w) => w !== k1));
  const matched = matchArchetype(kws);
  const mainArch: Archetype = matched ?? pick(rng, ARCHETYPES);

  // name
  let name: string;
  const roll = rng();
  if (kws.length >= 2 && roll < 0.4) name = `${titleCase(k1)} ${titleCase(k2)}`;
  else if (kws.length >= 1 && roll < 0.65) name = `${titleCase(k1)} ${pick(rng, SUFFIXES)}`;
  else if (kws.length >= 1 && roll < 0.8) name = titleCase(k1);
  else name = `${pick(rng, ADJECTIVES)} ${titleCase(mainArch === 'astronaut' ? 'Astro' : mainArch)}`;
  name = name.slice(0, 32);

  const ticker = tickerFromName(kws.length ? k1 : name, k2);
  const story = buildStory(rng, { name, archetype: mainArch, k1, k2, enemy: 'the dip' });
  const personality = buildPersonality(rng, k1, k2, name, ticker);
  // keep story enemy in sync with personality
  const storyFinal = story.replace(/the dip/g, personality.enemy);

  const others = shuffle(rngFor(input, salt, 7), ARCHETYPES.filter((a) => a !== mainArch));
  const archs: Archetype[] = matched ? [mainArch, mainArch, others[0]] : [mainArch, others[0], others[1]];
  const candidates = archs.map((a, i) => spec(rngFor(input, salt, i + 1), a, ticker));

  return { input, salt, name, ticker, story: storyFinal.slice(0, 240), personality, candidates };
}

/** Rebuild the personality (and its texts) for a possibly-edited name/ticker. */
export function personalityFor(input: string, salt: number, name: string, ticker: string): Personality {
  const rng = rngFor(input, salt, 99);
  const kws = extractKeywords(input);
  const k1 = kws[0]?.word ?? 'pixel';
  const k2 = kws[1]?.word ?? 'arcade';
  return buildPersonality(rng, k1, k2, name, ticker);
}
