/** 30-second endless runner. Pure simulation with a fixed timestep; the course is seeded per coin. */
import { mulberry32, cyrb53 } from '../engine/rng';

export const GW = 320;
export const GH = 180;
export const GROUND = 150;
export const RUN_SECONDS = 30;
const STEP = 1 / 60;
const GRAVITY = 1500;
const HOLD_GRAVITY = 520;
const JUMP_V = 380;
const MAX_HOLD = 0.2;

export type ObKind = 'block' | 'tall' | 'rug' | 'coin';
export interface Ob { kind: ObKind; x: number; y: number; w: number; h: number; taken?: boolean }

export interface GameState {
  t: number;
  dist: number;
  speed: number;
  y: number; // hero feet y
  vy: number;
  grounded: boolean;
  holding: boolean;
  holdT: number;
  coins: number;
  over: boolean;
  won: boolean;
  course: Ob[];
}

export function speedAt(t: number): number {
  return 120 + Math.floor(t / 5) * 22; // ramps every 5 s
}

/** Same seed => same course for everyone. */
export function buildCourse(seedText: string): Ob[] {
  const rng = mulberry32(cyrb53(seedText) % 4294967296);
  const total = Array.from({ length: RUN_SECONDS }, (_, s) => speedAt(s)).reduce((a, b) => a + b, 0) + 400;
  const obs: Ob[] = [];
  let x = 360;
  while (x < total) {
    const r = rng();
    if (r < 0.45) obs.push({ kind: 'block', x, y: GROUND - 16, w: 16, h: 16 });
    else if (r < 0.65) obs.push({ kind: 'tall', x, y: GROUND - 28, w: 14, h: 28 });
    else obs.push({ kind: 'rug', x, y: GROUND - 4, w: 32, h: 4 });
    // coins: an arc over the obstacle or a line after it
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) obs.push({ kind: 'coin', x: x - 16 + i * 18, y: GROUND - 56 - (i === 1 ? 10 : 0), w: 10, h: 10 });
    x += 150 + Math.floor(rng() * 170);
  }
  return obs;
}

export function newGame(seedText: string): GameState {
  return { t: 0, dist: 0, speed: speedAt(0), y: GROUND, vy: 0, grounded: true, holding: false, holdT: 0, coins: 0, over: false, won: false, course: buildCourse(seedText) };
}

export const HERO_X = 48;
const HERO_W = 18;
const HERO_H = 28;

export function score(g: GameState): number {
  return g.coins + Math.floor(g.dist / 50);
}

export interface StepEvents { jumped?: boolean; coin?: boolean; hit?: boolean; end?: boolean }

export function press(g: GameState): boolean {
  g.holding = true;
  if (g.grounded && !g.over) {
    g.vy = -JUMP_V;
    g.grounded = false;
    g.holdT = 0;
    return true;
  }
  return false;
}
export function release(g: GameState) {
  g.holding = false;
}

function stepOnce(g: GameState, ev: StepEvents) {
  g.t += STEP;
  g.speed = speedAt(g.t);
  g.dist += g.speed * STEP;
  // physics
  if (!g.grounded) {
    const holdBoost = g.holding && g.vy < 0 && g.holdT < MAX_HOLD;
    g.vy += (holdBoost ? HOLD_GRAVITY : GRAVITY) * STEP;
    if (holdBoost) g.holdT += STEP;
    g.y += g.vy * STEP;
    if (g.y >= GROUND) { g.y = GROUND; g.vy = 0; g.grounded = true; }
  }
  // collisions (world x = dist + screen x)
  const hx0 = g.dist + HERO_X - HERO_W / 2;
  const hx1 = hx0 + HERO_W;
  const hy1 = g.y;
  const hy0 = g.y - HERO_H;
  for (const o of g.course) {
    if (o.x > hx1 + 4) break;
    if (o.x + o.w < hx0 - 4 || o.taken) continue;
    const overlap = hx1 > o.x && hx0 < o.x + o.w && hy1 > o.y && hy0 < o.y + o.h;
    if (!overlap) continue;
    if (o.kind === 'coin') { o.taken = true; g.coins += 1; ev.coin = true; }
    else { g.over = true; ev.hit = true; ev.end = true; return; }
  }
  if (g.t >= RUN_SECONDS) { g.over = true; g.won = true; ev.end = true; }
}

/** Advance by real elapsed seconds using a fixed timestep. */
export function advance(g: GameState, acc: { v: number }, dt: number): StepEvents {
  const ev: StepEvents = {};
  acc.v += Math.min(dt, 0.25);
  while (acc.v >= STEP && !g.over) {
    stepOnce(g, ev);
    acc.v -= STEP;
  }
  return ev;
}
