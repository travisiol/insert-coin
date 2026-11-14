/**
 * Procedural 32x32 fighter sprites.
 * Tones: 0 transparent, 1 ink, 2 dark, 3 light, 4 paper, 5 coin, 6 hot.
 * Parts are built on the left half and mirrored, then outlined automatically.
 */
import {
  SIZE, type Archetype, type Accessory, type Legs, type FighterSpec, type FighterState, type CustomFrames,
  type DrawableState, DRAWABLE_STATES,
} from './types';
import { drawText, textWidth } from './font';

const W = SIZE;
type Buf = Uint8Array;
type Mask = Uint8Array;

const TONE: Record<string, number> = { '#': 1, d: 2, l: 3, p: 4, c: 5, h: 6 };

function put(b: Buf, x: number, y: number, t: number) {
  if (x >= 0 && x < W && y >= 0 && y < W) b[y * W + x] = t;
}
function putM(b: Buf, x: number, y: number, t: number) {
  put(b, x, y, t);
  put(b, W - 1 - x, y, t);
}
function newMask(): Mask {
  return new Uint8Array(W * W);
}
/** Fill a mask from a per-row half-width profile, centred on the sprite axis. */
function profile(m: Mask, top: number, hws: number[]) {
  hws.forEach((hw, i) => {
    const y = top + i;
    if (y < 0 || y >= W) return;
    for (let x = 16 - hw; x <= 15 + hw; x++) if (x >= 0 && x < W) m[y * W + x] = 1;
  });
}
/** Left-half spans [y, x0, x1], mirrored. */
function spans(m: Mask, list: [number, number, number][], mirror = true) {
  for (const [y, x0, x1] of list) {
    for (let x = x0; x <= x1; x++) {
      if (y < 0 || y >= W || x < 0 || x >= W) continue;
      m[y * W + x] = 1;
      if (mirror) m[y * W + (W - 1 - x)] = 1;
    }
  }
}
function circle(m: Mask, cx: number, cy: number, r: number, mirror = true) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) {
        if (x >= 0 && x < W && y >= 0 && y < W) {
          m[y * W + x] = 1;
          if (mirror) m[y * W + (W - 1 - x)] = 1;
        }
      }
    }
  }
}
// Light comes from the top-left: a 1 px highlight rim there, a 1 px shadow rim bottom-right.
const SHADOW: Record<number, number> = { 3: 2, 4: 3, 5: 2, 6: 2 };
const HIGHLIGHT: Record<number, number> = { 2: 3, 3: 4 };

/** Paint a mask: ink outline, shaded interior. */
function stamp(b: Buf, m: Mask, fill: number, outline = 1) {
  const inMask = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < W && m[y * W + x] === 1;
  const isEdge = (x: number, y: number) =>
    inMask(x, y) && (!inMask(x - 1, y) || !inMask(x + 1, y) || !inMask(x, y - 1) || !inMask(x, y + 1));
  const interior = (x: number, y: number) => inMask(x, y) && !isEdge(x, y);
  let minX = W, maxX = -1;
  for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % W; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const cx = (minX + maxX) / 2;
  const small = maxX - minX < 7; // tiny parts (hands, legs, ears) stay flat so they don't turn into dark specks
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (!inMask(x, y)) continue;
      if (isEdge(x, y)) { b[y * W + x] = outline; continue; }
      let t = fill;
      if (small) { b[y * W + x] = t; continue; }
      const bottom = !interior(x, y + 1);
      const right = x > cx && !interior(x + 1, y);
      const top = !interior(x, y - 1) && x < cx;
      const left = !interior(x - 1, y) && y < (W * 0.75);
      if ((bottom || right) && SHADOW[fill] !== undefined) t = SHADOW[fill];
      else if ((top || left) && HIGHLIGHT[fill] !== undefined && interior(x + 1, y + 1)) t = HIGHLIGHT[fill];
      b[y * W + x] = t;
    }
  }
}

/** A 3 px specular glint near the top-left of a shape, on the given row. */
function glint(b: Buf, m: Mask, fill: number, row: number) {
  if (fill === 4 || fill === 1) return;
  for (let x = 0; x < W; x++) {
    if (!m[row * W + x]) continue;
    put(b, x + 2, row, 4); put(b, x + 3, row, 4); put(b, x + 2, row + 1, 4);
    return;
  }
}
function paint(b: Buf, m: Mask, tone: number) {
  for (let i = 0; i < m.length; i++) if (m[i]) b[i] = tone;
}
/** Draw a small pattern; '.' = skip. If mirror, also draw it flipped on the right half. */
function pattern(b: Buf, rows: string[], x0: number, y0: number, mirror: boolean, toneOverride?: number) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const t = toneOverride !== undefined && ch === '#' ? toneOverride : TONE[ch];
      if (t === undefined) continue;
      put(b, x0 + c, y0 + r, t);
      if (mirror) put(b, W - 1 - (x0 + c), y0 + r, t);
    }
  });
}

// ---------- heads ----------
const ROUND = [4, 6, 7, 8, 8, 9, 9, 9, 9, 9, 9, 8, 8, 7, 6, 4];
const WIDE = [6, 8, 9, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9, 8, 7, 5];
const SQUARE = [8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8];
const SKULL = [5, 7, 8, 9, 9, 9, 9, 9, 9, 9, 8, 7, 6, 6, 6, 5];

interface ArchDef {
  top: number;
  hws: number[];
  fill: number;
  eyeY: number;
  eyeX: number;
  eyeTone?: number;
  mouthY: number;
  noMouth?: boolean;
  hasArms?: boolean;
  forceLegs?: Legs;
  /** pink blush under the eyes */
  cheeks?: boolean;
  /** torso tone (default dark) */
  bodyFill?: number;
  /** add to the head mask before stamping (ears, bumps) */
  shape?: (m: Mask) => void;
  /** painted after the head stamp, before eyes */
  under?: (b: Buf) => void;
  /** painted after eyes/mouth */
  over?: (b: Buf) => void;
}

const ARCH: Record<Archetype, ArchDef> = {
  cat: {
    cheeks: true,
    top: 3, hws: ROUND, fill: 3, eyeY: 9, eyeX: 10, mouthY: 14,
    shape: (m) => spans(m, [[0, 7, 7], [1, 7, 8], [2, 7, 9], [3, 7, 10], [4, 7, 10]]),
    under: (b) => { putM(b, 8, 3, 2); putM(b, 8, 4, 2); },
    over: (b) => { putM(b, 5, 13, 1); putM(b, 6, 13, 1); putM(b, 5, 15, 1); putM(b, 6, 15, 1); },
  },
  dog: {
    cheeks: true,
    top: 3, hws: WIDE, fill: 3, eyeY: 9, eyeX: 10, mouthY: 15,
    under: (b) => {
      const ear = newMask();
      spans(ear, [[4, 5, 7], [5, 4, 7], [6, 3, 7], [7, 3, 7], [8, 3, 7], [9, 3, 7], [10, 3, 6], [11, 3, 6], [12, 4, 5]]);
      stamp(b, ear, 2);
      putM(b, 15, 13, 1); putM(b, 14, 13, 1);
    },
  },
  frog: {
    cheeks: true,
    top: 5, hws: [7, 9, 10, 11, 11, 11, 11, 11, 11, 11, 10, 9, 8, 7], fill: 3, eyeY: 3, eyeX: 10, mouthY: 13,
    shape: (m) => circle(m, 11, 4.5, 3.4),
    under: (b) => { const e = newMask(); circle(e, 11, 4.5, 2.2); paint(b, e, 4); putM(b, 9, 12, 2); },
  },
  robot: {
    top: 4, hws: SQUARE, fill: 3, eyeY: 9, eyeX: 10, mouthY: 14,
    under: (b) => {
      const bolt = newMask();
      spans(bolt, [[9, 5, 7], [10, 5, 7], [11, 5, 7], [12, 5, 7]]);
      stamp(b, bolt, 2);
      put(b, 15, 2, 1); put(b, 16, 2, 1); put(b, 15, 3, 1); put(b, 16, 3, 1); put(b, 15, 1, 5); put(b, 16, 1, 5);
      putM(b, 9, 6, 2); putM(b, 10, 6, 2);
    },
  },
  ghost: {
    cheeks: true,
    top: 3, hws: ROUND, fill: 4, eyeY: 9, eyeX: 10, mouthY: 14, forceLegs: 'float',
    under: (b) => { putM(b, 9, 13, 3); },
  },
  alien: {
    top: 2, hws: [5, 7, 8, 9, 10, 10, 10, 10, 10, 9, 9, 8, 7, 6, 5, 4, 3], fill: 3, eyeY: 9, eyeX: 9, mouthY: 15,
    under: (b) => { putM(b, 11, 1, 1); putM(b, 10, 0, 1); putM(b, 9, 0, 5); },
  },
  bear: {
    cheeks: true,
    top: 3, hws: ROUND, fill: 3, eyeY: 9, eyeX: 10, mouthY: 15,
    shape: (m) => circle(m, 9, 4, 2.6),
    under: (b) => {
      putM(b, 9, 3, 2); putM(b, 9, 4, 2);
      const muzzle = newMask();
      spans(muzzle, [[13, 13, 15], [14, 12, 15], [15, 12, 15], [16, 13, 15]]);
      paint(b, muzzle, 4);
      putM(b, 15, 13, 1);
    },
  },
  owl: {
    top: 3, hws: ROUND, fill: 3, eyeY: 9, eyeX: 10, mouthY: 14, noMouth: true,
    shape: (m) => spans(m, [[0, 7, 7], [1, 7, 8], [2, 8, 9], [3, 8, 10]]),
    under: (b) => {
      const ring = newMask();
      circle(ring, 11, 10, 3.2);
      stamp(b, ring, 4, 2);
    },
    over: (b) => { putM(b, 14, 14, 5); putM(b, 15, 14, 5); putM(b, 15, 15, 5); },
  },
  skull: {
    top: 3, hws: SKULL, fill: 4, eyeY: 9, eyeX: 10, mouthY: 15, noMouth: true,
    under: (b) => {
      const sock = newMask();
      circle(sock, 11, 10, 2.4);
      paint(b, sock, 2);
    },
    over: (b) => {
      putM(b, 15, 13, 1);
      for (const x of [11, 13, 15]) { put(b, x, 15, 1); put(b, x, 16, 1); put(b, W - 1 - x, 15, 1); put(b, W - 1 - x, 16, 1); }
      for (let x = 11; x <= 20; x++) put(b, x, 17, 1);
    },
  },
  blob: {
    cheeks: true,
    top: 3, hws: [2, 4, 6, 7, 8, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 11], fill: 3, eyeY: 10, eyeX: 10, mouthY: 15,
    under: (b) => { putM(b, 11, 5, 4); putM(b, 12, 5, 4); putM(b, 11, 6, 4); },
  },
  monkey: {
    cheeks: true,
    top: 3, hws: ROUND, fill: 2, eyeY: 9, eyeX: 10, mouthY: 15,
    shape: (m) => circle(m, 5.5, 11, 2.6),
    under: (b) => {
      putM(b, 5, 11, 3); putM(b, 6, 11, 3);
      const face = newMask();
      circle(face, 11.5, 10.5, 3);
      spans(face, [[13, 11, 15], [14, 10, 15], [15, 10, 15], [16, 11, 15], [17, 12, 15]]);
      paint(b, face, 4);
    },
  },
  bunny: {
    cheeks: true,
    top: 6, hws: [5, 7, 8, 9, 9, 9, 9, 9, 8, 8, 7, 6, 4], fill: 4, eyeY: 11, eyeX: 10, mouthY: 15,
    shape: (m) => spans(m, [[0, 10, 10], [1, 9, 11], [2, 9, 11], [3, 9, 11], [4, 9, 11], [5, 9, 11], [6, 9, 12], [7, 10, 12]]),
    under: (b) => { for (let y = 1; y <= 6; y++) putM(b, 10, y, 3); putM(b, 9, 14, 3); },
  },
  astronaut: {
    top: 3, hws: ROUND, fill: 4, eyeY: 10, eyeX: 10, eyeTone: 3, mouthY: 14,
    under: (b) => {
      const visor = newMask();
      spans(visor, [[8, 11, 15], [9, 9, 15], [10, 9, 15], [11, 9, 15], [12, 9, 15], [13, 9, 15], [14, 9, 15], [15, 10, 15], [16, 12, 15]]);
      stamp(b, visor, 2);
      put(b, 11, 9, 4); put(b, 10, 10, 4);
      put(b, 22, 1, 1); put(b, 22, 2, 1); put(b, 22, 0, 5);
    },
  },
  knight: {
    top: 3, hws: [6, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 7, 6], fill: 3, eyeY: 9, eyeX: 10, eyeTone: 4, mouthY: 14, noMouth: true,
    under: (b) => {
      const plume = newMask();
      spans(plume, [[0, 14, 15], [1, 13, 15], [2, 14, 15], [3, 14, 15]]);
      stamp(b, plume, 6);
      for (let x = 9; x <= 15; x++) { putM(b, x, 9, 1); putM(b, x, 10, 1); putM(b, x, 11, 1); }
    },
    over: (b) => { for (const x of [12, 14]) { putM(b, x, 14, 1); putM(b, x, 15, 1); } },
  },
  wizard: {
    top: 8, hws: [4, 6, 7, 8, 8, 8, 8, 8, 7, 6, 4], fill: 3, eyeY: 11, eyeX: 11, mouthY: 15,
    over: (b) => {
      const beard = newMask();
      spans(beard, [[15, 11, 15], [16, 10, 15], [17, 10, 15], [18, 11, 15], [19, 12, 15], [20, 14, 15]]);
      stamp(b, beard, 4);
      putM(b, 14, 16, 1); putM(b, 15, 16, 1);
      const hat = newMask();
      spans(hat, [[0, 15, 15], [1, 14, 15], [2, 14, 15], [3, 13, 15], [4, 13, 15], [5, 12, 15], [6, 11, 15], [7, 10, 15], [8, 5, 15], [9, 6, 15]]);
      stamp(b, hat, 2);
      put(b, 14, 4, 5); put(b, 17, 6, 5); put(b, 13, 6, 5);
    },
  },
  rocket: {
    top: 1, hws: [1, 2, 3, 4, 5, 6, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8], fill: 4, eyeY: 9, eyeX: 11, eyeTone: 3, mouthY: 14,
    hasArms: false,
    under: (b) => {
      const win = newMask();
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if ((x - 15.5) ** 2 + (y - 10.5) ** 2 <= 26) win[y * W + x] = 1;
      stamp(b, win, 2);
      put(b, 15, 0, 6); put(b, 16, 0, 6);
    },
  },
};

// ---------- eyes / mouths ----------
// Left-eye patterns; mirrored for the right eye.
// Most eyes carry a 1 px paper shine so they read as alive.
const EYES: string[][] = [
  ['p#', '##'],
  ['p#', '##', '##'],
  ['.##', 'p##', '###'],
  ['p##', '###'],
  ['###', '#p#', '###'],
  ['.#.', '#.#'],
  ['...', '###'],
  ['#.#', '.#.', '#.#'],
  ['.p', '##'],
  ['#..', '#p.', '###'],
];
const EYE_STATE: Record<string, string[]> = {
  blink: ['...', '...', '###'],
  dollar: ['.c.', 'ccc', 'c.c', 'ccc', '.c.'],
  happy: ['.#.', '#.#'],
  droop: ['###', '.#.'],
  ring: ['###', '#p#', '###'],
  angry: ['#..', '.#.', '#..'],
  star: ['c.c', '.c.', 'c.c'],
  closed: ['...', '###'],
};
// Mouth patterns cover columns 12..15 (left half) and are mirrored.
const MOUTHS: string[][] = [
  ['#...', '.###'],
  ['....', '.###'],
  ['..##', '.#dd', '..##'],
  ['.###', '.#pp', '.###'],
  ['....', '...#'],
  ['.###', '#...'],
  ['#...', '.###', '.p..'],
  ['#.#.', '.#.#'],
];
const MOUTH_STATE: Record<string, string[]> = {
  grin: ['.###', '.#pp', '.###'],
  open: ['..##', '.#dd', '..##'],
  frown: ['.###', '#...'],
  tiny: ['....', '...#'],
  big: ['####', '#ddd', '.###'],
};

// ---------- body ----------
/** Compact chibi torso: a shaded jersey with the ticker printed in coin yellow, plus a collar and a belt. */
function torso(b: Buf, ticker: string, fill: number) {
  const m = newMask();
  profile(m, 19, [8, 10, 10, 10, 10, 10, 10, 9, 8]);
  stamp(b, m, fill);
  // collar
  for (let x = 13; x <= 18; x++) put(b, x, 20, 1);
  put(b, 14, 21, 1); put(b, 17, 21, 1);
  // belt
  for (let x = 7; x <= 24; x++) put(b, x, 26, 1);
  put(b, 15, 26, 5); put(b, 16, 26, 5);
  // ticker with a 1 px ink drop shadow so it pops on any body tone
  const t = chestText(ticker);
  const w = textWidth(t);
  const x0 = Math.floor((W - w) / 2);
  drawText(b, W, W, t, x0 + 1, 22, 1);
  drawText(b, W, W, t, x0, 21, 5);
}

/** Up to 4 characters fit the plate; longer tickers show their first 3. */
export function chestText(ticker: string): string {
  const t = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return t.length <= 4 ? t : t.slice(0, 3);
}

/** Sleeves in the body tone, ending in round hands in the skin tone. */
function arms(b: Buf, up: boolean, sleeve: number, hand: number) {
  const s = newMask();
  const h = newMask();
  if (up) {
    spans(s, [[15, 4, 6], [16, 4, 7], [17, 5, 7], [18, 5, 7], [19, 5, 7], [20, 5, 7]]);
    spans(h, [[11, 3, 5], [12, 2, 5], [13, 2, 5], [14, 3, 5]]);
  } else {
    spans(s, [[19, 6, 7], [20, 4, 7], [21, 3, 6], [22, 3, 6], [23, 3, 6]]);
    spans(h, [[24, 2, 5], [25, 2, 5], [26, 3, 5]]);
  }
  stamp(b, s, sleeve);
  stamp(b, h, hand);
}

function legs(b: Buf, style: Legs, liftL: number, liftR: number) {
  // soft ground shadow
  for (let x = 8; x <= 23; x++) if (!b[31 * W + x]) put(b, x, 31, 2);
  if (style === 'float') {
    const m = newMask();
    spans(m, [[27, 7, 15], [28, 7, 15], [29, 7, 8], [29, 11, 12], [29, 15, 15], [30, 7, 7], [30, 11, 11]]);
    stamp(b, m, 2);
    return;
  }
  const side = (lift: number, right: boolean) => {
    const m = newMask();
    const s: [number, number, number][] = [];
    if (style === 'stubs') s.push([27, 9, 13], [28, 9, 13], [29, 9, 13], [30, 8, 13]);
    if (style === 'long') s.push([27, 10, 13], [28, 10, 13], [29, 10, 13], [30, 10, 13], [31, 8, 13]);
    if (style === 'wide') s.push([27, 6, 9], [28, 6, 9], [29, 6, 9], [30, 5, 9]);
    if (style === 'wheels') s.push([27, 8, 12], [28, 7, 13], [29, 7, 13], [30, 7, 13], [31, 8, 12]);
    for (const [y, x0, x1] of s) {
      for (let x = x0; x <= x1; x++) {
        const xx = right ? W - 1 - x : x;
        const yy = y - lift;
        if (yy >= 0 && yy < W) m[yy * W + xx] = 1;
      }
    }
    stamp(b, m, style === 'wheels' ? 2 : 3);
    if (style === 'wheels') { const hx = right ? W - 1 - 10 : 10; put(b, hx, 29 - lift, 5); put(b, hx, 28 - lift, 4); }
    else {
      // shoe: ink toe cap on the outer side
      const ty = (style === 'long' ? 31 : 30) - lift;
      const tx0 = style === 'wide' ? 5 : 8;
      for (let x = tx0; x <= tx0 + 2; x++) put(b, right ? W - 1 - x : x, ty, 1);
    }
  };
  side(liftL, false);
  side(liftR, true);
}

// ---------- accessories ----------
function accessory(b: Buf, acc: Accessory, d: ArchDef) {
  const top = d.top;
  const m = newMask();
  switch (acc) {
    case 'cap':
      spans(m, [[top - 1, 10, 15], [top, 8, 15], [top + 1, 7, 15], [top + 2, 7, 15]]);
      stamp(b, m, 6);
      for (let x = 17; x <= 27; x++) put(b, x, top + 2, 1);
      for (let x = 18; x <= 26; x++) put(b, x, top + 3, 6);
      break;
    case 'crown':
      spans(m, [[top - 3, 9, 9], [top - 3, 15, 15], [top - 2, 9, 10], [top - 2, 14, 15], [top - 1, 9, 15], [top, 9, 15]]);
      stamp(b, m, 5);
      putM(b, 12, top - 1, 6);
      break;
    case 'headphones':
      spans(m, [[top - 1, 9, 15], [top, 7, 9]]);
      paint(b, m, 1);
      { const cup = newMask(); spans(cup, [[top + 6, 4, 6], [top + 7, 4, 6], [top + 8, 4, 6], [top + 9, 4, 6], [top + 10, 4, 6]]); stamp(b, cup, 6); }
      for (let y = top; y <= top + 6; y++) putM(b, 6, y, 1);
      break;
    case 'horns':
      spans(m, [[top - 3, 7, 7], [top - 2, 7, 8], [top - 1, 8, 9], [top, 8, 10]]);
      stamp(b, m, 4);
      break;
    case 'halo':
      for (let x = 10; x <= 21; x++) { put(b, x, Math.max(0, top - 3), 5); }
      putM(b, 9, Math.max(1, top - 2), 5);
      for (let x = 11; x <= 20; x++) put(b, x, Math.max(1, top - 2), 0);
      break;
    case 'visor':
      for (let x = 7; x <= 24; x++) { put(b, x, d.eyeY, 1); put(b, x, d.eyeY + 1, 2); put(b, x, d.eyeY + 2, 1); }
      for (let x = 9; x <= 14; x++) put(b, x, d.eyeY + 1, 5);
      for (let x = 17; x <= 22; x++) put(b, x, d.eyeY + 1, 5);
      break;
    case 'scarf':
      spans(m, [[18, 6, 15], [19, 5, 15]]);
      stamp(b, m, 6);
      { const tail = newMask(); spans(tail, [[20, 21, 23], [21, 21, 23], [22, 22, 24]], false); stamp(b, tail, 6); }
      break;
    case 'cape':
      // drawn behind the body by the caller
      break;
    case 'antenna':
      for (let y = Math.max(0, top - 4); y < top; y++) put(b, 20, y, 1);
      put(b, 20, Math.max(0, top - 5), 5); put(b, 21, Math.max(0, top - 5), 5);
      break;
    case 'flower':
      { const f = newMask(); spans(f, [[top - 1, 21, 23], [top, 20, 24], [top + 1, 21, 23]], false); stamp(b, f, 4); put(b, 22, top, 5); }
      break;
    case 'bandana':
      for (let x = 7; x <= 24; x++) { put(b, x, top + 3, 6); put(b, x, top + 4, 6); }
      for (let x = 7; x <= 24; x++) put(b, x, top + 2, 1);
      for (let x = 7; x <= 24; x++) put(b, x, top + 5, 1);
      put(b, 4, top + 5, 6); put(b, 5, top + 4, 6); put(b, 4, top + 6, 6);
      break;
    case 'glasses':
      for (const ex of [d.eyeX - 1, W - 1 - (d.eyeX + 3)]) {
        for (let x = ex; x <= ex + 4; x++) { put(b, x, d.eyeY - 1, 1); put(b, x, d.eyeY + 3, 1); }
        for (let y = d.eyeY - 1; y <= d.eyeY + 3; y++) { put(b, ex, y, 1); put(b, ex + 4, y, 1); }
      }
      for (let x = d.eyeX + 4; x <= W - 1 - (d.eyeX + 4); x++) put(b, x, d.eyeY, 1);
      break;
    case 'none':
      break;
  }
}

function cape(b: Buf) {
  const m = newMask();
  spans(m, [[18, 6, 9], [19, 4, 9], [20, 3, 8], [21, 2, 7], [22, 2, 7], [23, 1, 7], [24, 1, 7], [25, 1, 7], [26, 1, 7], [27, 2, 7], [28, 3, 7]]);
  stamp(b, m, 6);
}

// ---------- base render ----------
interface BaseOpts {
  eyes?: string[];
  mouth?: string[];
  armsUp?: boolean;
  liftL?: number;
  liftR?: number;
}

function renderBase(spec: FighterSpec, o: BaseOpts = {}): Buf {
  const b = new Uint8Array(W * W);
  const d = ARCH[spec.archetype] ?? ARCH.cat;
  const legStyle = d.forceLegs ?? spec.legs;
  if (spec.accessory === 'cape') cape(b);
  legs(b, legStyle, o.liftL ?? 0, o.liftR ?? 0);
  const bodyFill = d.bodyFill ?? 2;
  torso(b, spec.ticker, bodyFill);
  if (d.hasArms !== false) arms(b, !!o.armsUp, bodyFill, d.fill === 2 ? 3 : d.fill);
  else {
    const fin = newMask();
    spans(fin, [[21, 3, 5], [22, 2, 5], [23, 2, 5], [24, 1, 5], [25, 1, 5], [26, 1, 5], [27, 1, 4]]);
    stamp(b, fin, 6);
  }
  const head = newMask();
  profile(head, d.top, d.hws);
  d.shape?.(head);
  stamp(b, head, d.fill);
  glint(b, head, d.fill, d.top + 3);
  d.under?.(b);
  const eyeRows = o.eyes ?? EYES[spec.eyes % EYES.length];
  const ey = eyeRows.length >= 3 ? d.eyeY - 1 + (eyeRows.length === 5 ? -1 : 0) : d.eyeY;
  pattern(b, eyeRows, d.eyeX, ey, true, d.eyeTone);
  if (d.cheeks) { putM(b, d.eyeX - 1, d.eyeY + 3, 6); putM(b, d.eyeX, d.eyeY + 3, 6); }
  if (!d.noMouth) {
    const mouthRows = o.mouth ?? MOUTHS[spec.mouth % MOUTHS.length];
    pattern(b, mouthRows, 12, d.mouthY, true, d.eyeTone);
  }
  d.over?.(b);
  accessory(b, spec.accessory, d);
  return b;
}

function shiftDown(src: Buf, n: number, fromRow = 0, toRow = 26): Buf {
  const b = src.slice();
  for (let y = toRow; y >= fromRow; y--) {
    for (let x = 0; x < W; x++) {
      const ny = y + n;
      if (ny < W) b[ny * W + x] = src[y * W + x];
    }
  }
  for (let y = fromRow; y < fromRow + n; y++) for (let x = 0; x < W; x++) b[y * W + x] = 0;
  return b;
}

// ---------- overlays ----------
function sparks(b: Buf, f: number) {
  const pts = f % 2 === 0 ? [[3, 4], [27, 8], [5, 16]] : [[28, 3], [4, 9], [26, 15]];
  for (const [x, y] of pts) { put(b, x, y, 5); put(b, x - 1, y, 5); put(b, x + 1, y, 5); put(b, x, y - 1, 5); put(b, x, y + 1, 5); }
}
function chart(b: Buf, f: number) {
  const pts = [[24, 7], [25, 6], [26, 6], [27, 4], [28, 5], [29, 3], [30, 1]];
  pts.slice(0, 5 + (f % 2) * 2).forEach(([x, y], i) => put(b, x, y, i >= 5 ? 5 : 3));
}
function zzz(b: Buf, f: number) {
  const z = (x: number, y: number) => { put(b, x, y, 3); put(b, x + 1, y, 3); put(b, x + 2, y, 3); put(b, x + 1, y + 1, 3); put(b, x, y + 2, 3); put(b, x + 1, y + 2, 3); put(b, x + 2, y + 2, 3); };
  z(25, 6 - f); if (f % 2 === 1) z(28, 1);
}
function coinArrow(b: Buf, f: number) {
  const x = 1 + f * 3;
  const y = 21;
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) put(b, x + dx, y + dy, 5);
  put(b, x + 1, y + 1, 1);
}
function flames(b: Buf, f: number) {
  const heights = [3, 5, 4, 6, 3, 5, 7, 4, 6, 5, 3, 6, 4, 5, 7, 4];
  for (let col = 0; col < 16; col++) {
    const h = heights[(col + f * 3) % heights.length];
    const x = col * 2;
    for (let i = 0; i < h; i++) {
      const y = W - 1 - i;
      const tone = i < h / 2 ? 5 : 6;
      put(b, x, y, tone);
      if (i < h - 1) put(b, x + 1, y, tone);
    }
  }
}
function bondedSign(b: Buf) {
  for (let y = 0; y <= 6; y++) for (let x = 2; x <= 29; x++) put(b, x, y, y === 0 || y === 6 || x === 2 || x === 29 ? 1 : 5);
  drawText(b, W, W, 'BONDED', 4, 1, 1);
}

// ---------- public API ----------
export const FRAME_COUNT: Record<FighterState, number> = {
  idle: 4, walk: 4, trading: 2, profit: 2, loss: 2, buyback: 4, burn: 4, bonded: 4, sleep: 2,
};

/** Frame duration in ms per state. */
export const FRAME_MS: Record<FighterState, number> = {
  idle: 400, walk: 160, trading: 300, profit: 250, loss: 450, buyback: 200, burn: 120, bonded: 250, sleep: 700,
};

function decode(frame: string): Buf {
  const b = new Uint8Array(W * W);
  for (let i = 0; i < W * W && i < frame.length; i++) b[i] = Math.min(6, Number(frame[i]) || 0);
  return b;
}

export function encode(b: Buf): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String(b[i]);
  return s;
}

function generated(spec: FighterSpec, state: FighterState, f: number): Buf {
  switch (state) {
    case 'idle': {
      if (f === 3) return renderBase(spec, { eyes: EYE_STATE.blink });
      const b = renderBase(spec);
      return f === 2 ? shiftDown(b, 1) : b;
    }
    case 'walk': {
      const b = renderBase(spec, { liftL: f === 1 ? 1 : 0, liftR: f === 3 ? 1 : 0 });
      return f % 2 === 1 ? shiftDown(b, 1) : b;
    }
    case 'trading': {
      const b = renderBase(spec, { eyes: EYE_STATE.dollar, mouth: MOUTH_STATE.grin });
      chart(b, f);
      return b;
    }
    case 'profit': {
      const b = renderBase(spec, { eyes: EYE_STATE.happy, mouth: MOUTH_STATE.big, armsUp: true });
      sparks(b, f);
      return f === 1 ? b : b;
    }
    case 'loss': {
      const b = shiftDown(renderBase(spec, { eyes: EYE_STATE.droop, mouth: MOUTH_STATE.frown }), 1);
      const d = ARCH[spec.archetype];
      put(b, d.eyeX + 1, d.eyeY + 3 + f, 3);
      return b;
    }
    case 'buyback': {
      const b = renderBase(spec, { eyes: EYE_STATE.ring, mouth: MOUTH_STATE.open });
      coinArrow(b, f);
      return b;
    }
    case 'burn': {
      const b = renderBase(spec, { eyes: EYE_STATE.angry, mouth: MOUTH_STATE.open });
      flames(b, f);
      return b;
    }
    case 'bonded': {
      const b = renderBase(spec, { eyes: EYE_STATE.star, mouth: MOUTH_STATE.big, armsUp: f % 2 === 0 });
      if (f < 2) bondedSign(b);
      sparks(b, f);
      return b;
    }
    case 'sleep': {
      const b = shiftDown(renderBase(spec, { eyes: EYE_STATE.closed, mouth: MOUTH_STATE.tiny }), 1);
      zzz(b, f);
      return b;
    }
  }
}

function fromCustom(custom: CustomFrames, state: FighterState, f: number): Buf | null {
  const own = (DRAWABLE_STATES as readonly string[]).includes(state) ? custom[state as DrawableState] : undefined;
  if (own && own.length) return decode(own[f % own.length]);
  const idle = custom.idle?.[0];
  if (!idle) return null;
  const b = decode(idle);
  if (state === 'trading') chart(b, f);
  else if (state === 'profit') sparks(b, f);
  else if (state === 'loss') return shiftDown(b, 1);
  else if (state === 'buyback') coinArrow(b, f);
  else if (state === 'burn') flames(b, f);
  else if (state === 'bonded') { if (f < 2) bondedSign(b); sparks(b, f); }
  else if (state === 'sleep') { const s = shiftDown(b, 1); zzz(s, f); return s; }
  else if (state === 'walk') return f % 2 === 1 ? shiftDown(b, 1) : b;
  else if (state === 'idle' && f === 2) return shiftDown(b, 1);
  return b;
}

/** Level decorations: 1 glow, 2 cape glow, 3 crown, 4 aura. Visual only. */
function levelUp(b: Buf, level: number, f: number): Buf {
  if (level <= 0) return b;
  const out = b.slice();
  if (level >= 1) {
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (b[y * W + x]) continue;
      const n = (x > 0 && b[y * W + x - 1]) || (x < W - 1 && b[y * W + x + 1]) || (y > 0 && b[(y - 1) * W + x]) || (y < W - 1 && b[(y + 1) * W + x]);
      if (n && (x + y + f) % 3 === 0) out[y * W + x] = level >= 4 ? 5 : 3;
    }
  }
  if (level >= 3) {
    let topY = 0;
    outer: for (let y = 0; y < W; y++) for (let x = 12; x < 20; x++) if (b[y * W + x]) { topY = y; break outer; }
    if (topY >= 3) {
      const y = topY - 3;
      for (let x = 13; x <= 18; x++) put(out, x, y + 2, 5);
      put(out, 13, y + 1, 5); put(out, 15, y + 1, 5); put(out, 16, y + 1, 5); put(out, 18, y + 1, 5);
      put(out, 13, y, 5); put(out, 18, y, 5); put(out, 15, y, 5); put(out, 16, y, 5);
    }
  }
  if (level >= 4) {
    const corners = f % 2 === 0 ? [[0, 0], [31, 0], [0, 31], [31, 31]] : [[1, 1], [30, 1], [1, 30], [30, 30]];
    for (const [x, y] of corners) put(out, x, y, 5);
  }
  return out;
}

export interface RenderInput {
  spec: FighterSpec;
  custom?: CustomFrames | null;
  level?: number;
}

export function renderFrame(input: RenderInput, state: FighterState, frame: number): Buf {
  const n = FRAME_COUNT[state];
  const f = ((frame % n) + n) % n;
  const base = (input.custom && fromCustom(input.custom, state, f)) || generated(input.spec, state, f);
  return levelUp(base, input.level ?? 0, f);
}

// ---------- palettes ----------
export const SCREEN_PALETTE: Record<number, string> = {
  1: '#1B2B1F', 2: '#3E6B48', 3: '#8DB580', 4: '#D6E8C3', 5: '#F2B705', 6: '#B0306A',
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGBA pixels at an integer scale. bg = optional hex background. */
export function toRGBA(b: Buf, scale = 1, bg?: string): Uint8ClampedArray {
  const size = W * scale;
  const out = new Uint8ClampedArray(size * size * 4);
  const bgc = bg ? hexToRgb(bg) : null;
  const pal: Record<number, [number, number, number]> = {};
  for (const k of Object.keys(SCREEN_PALETTE)) pal[Number(k)] = hexToRgb(SCREEN_PALETTE[Number(k)]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = b[Math.floor(y / scale) * W + Math.floor(x / scale)];
      const o = (y * size + x) * 4;
      if (t) {
        const [r, g, bl] = pal[t];
        out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255;
      } else if (bgc) {
        out[o] = bgc[0]; out[o + 1] = bgc[1]; out[o + 2] = bgc[2]; out[o + 3] = 255;
      }
    }
  }
  return out;
}
