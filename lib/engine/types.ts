export const ARCHETYPES = [
  'cat', 'dog', 'frog', 'robot', 'ghost', 'alien', 'bear', 'owl',
  'skull', 'blob', 'monkey', 'bunny', 'astronaut', 'knight', 'wizard', 'rocket',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const ACCESSORIES = [
  'cap', 'crown', 'headphones', 'horns', 'halo', 'visor', 'scarf', 'cape', 'antenna', 'flower', 'bandana', 'glasses', 'none',
] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export const LEGS = ['stubs', 'long', 'wide', 'wheels', 'float'] as const;
export type Legs = (typeof LEGS)[number];

export const EYE_COUNT = 10;
export const MOUTH_COUNT = 8;

/** The 9 animation states. Each one is played only when its event really happened. */
export const STATES = ['idle', 'walk', 'trading', 'profit', 'loss', 'buyback', 'burn', 'bonded', 'sleep'] as const;
export type FighterState = (typeof STATES)[number];

/** Editable states in the studio (others are derived from idle + overlays). */
export const DRAWABLE_STATES = ['idle', 'walk', 'profit', 'loss'] as const;
export type DrawableState = (typeof DRAWABLE_STATES)[number];

export interface FighterSpec {
  archetype: Archetype;
  eyes: number; // 0..9
  mouth: number; // 0..7
  accessory: Accessory;
  legs: Legs;
  ticker: string;
}

/** 32x32 frames, each a 1024-char string of tones '0'..'4' (0 = transparent). */
export type CustomFrames = Partial<Record<DrawableState, string[]>>;

/** Pixel tones: 0 transparent, 1 ink, 2 dark, 3 light, 4 paper, 5 coin, 6 hot (burn red). */
export type Pixels = Uint8Array;

export const SIZE = 32;
