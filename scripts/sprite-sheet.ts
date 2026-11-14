/** Dev helper: render every archetype (or every state) into one PNG. Usage: npx tsx scripts/sprite-sheet.ts out.png [states] */
import fs from 'node:fs';
import { renderFrame, SCREEN_PALETTE, hexToRgb } from '../lib/engine/sprite';
import { buildCoin, accessoriesFor } from '../lib/engine/build';
import { ARCHETYPES, LEGS, STATES, type FighterSpec } from '../lib/engine/types';
import { encodePNG } from '../lib/png';

const out = process.argv[2] ?? 'sheet.png';
const statesMode = process.argv[3] === 'states';
const S = 6;
const CELL = 32 * S + 16;
const base = buildCoin('insert coin arcade', 0).candidates[0];
const specs: { spec: FighterSpec; state: (typeof STATES)[number] }[] = statesMode
  ? STATES.map((s) => ({ spec: { ...base, archetype: 'cat', ticker: 'CAT' }, state: s }))
  : ARCHETYPES.map((a, i) => {
      const accs = accessoriesFor(a);
      return { spec: { ...base, archetype: a, accessory: accs[(i * 5) % accs.length], legs: LEGS[i % LEGS.length], eyes: (i * 3) % 10, mouth: (i * 7) % 8, ticker: a.slice(0, 4).toUpperCase() }, state: 'idle' as const };
    });
const cols = statesMode ? 9 : 8;
const rows = Math.ceil(specs.length / cols);
const Wd = cols * CELL;
const Ht = rows * CELL;
const buf = new Uint8Array(Wd * Ht * 4);
const bg = hexToRgb(process.env.BG ?? '#1B2B1F');
for (let i = 0; i < Wd * Ht; i++) buf.set([bg[0], bg[1], bg[2], 255], i * 4);
specs.forEach(({ spec, state }, k) => {
  const px = renderFrame({ spec }, state, 0);
  const ox = (k % cols) * CELL + 8;
  const oy = Math.floor(k / cols) * CELL + 8;
  for (let i = 0; i < 1024; i++) {
    if (!px[i]) continue;
    const [r, g, b] = hexToRgb(SCREEN_PALETTE[px[i]]);
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
      const x = ox + (i % 32) * S + dx;
      const y = oy + Math.floor(i / 32) * S + dy;
      buf.set([r, g, b, 255], (y * Wd + x) * 4);
    }
  }
});
fs.writeFileSync(out, encodePNG(buf, Wd, Ht));
console.log('wrote', out);
