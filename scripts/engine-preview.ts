// Dev helper: print fighters as text. Usage: npx tsx scripts/engine-preview.ts "some idea" [state]
import { buildCoin } from '../lib/engine/build';
import { renderFrame } from '../lib/engine/sprite';
import { ARCHETYPES, type FighterState } from '../lib/engine/types';
const CH = [' ', '#', 'o', '+', '.', '$', '%'];
const text = process.argv[2] ?? 'a robot that lost all its money';
const state = (process.argv[3] ?? 'idle') as FighterState;
const all = process.argv[4] === 'all';
const d = buildCoin(text, 0);
console.log(JSON.stringify({ name: d.name, ticker: d.ticker, story: d.story, voice: d.personality.voice, cmds: d.personality.commands.map(c => c.name) }, null, 1));
const specs = all ? ARCHETYPES.map((a, i) => ({ ...d.candidates[0], archetype: a, accessory: (['none','cap','crown','glasses'] as const)[i % 4] })) : d.candidates;
for (let row = 0; row < specs.length; row += 4) {
  const bufs = specs.slice(row, row + 4).map((s) => renderFrame({ spec: s }, state, 0));
  console.log(specs.slice(row, row + 4).map(s => (s.archetype + '/' + s.accessory + '/' + s.legs).padEnd(33)).join(' '));
  for (let y = 0; y < 32; y++) console.log(bufs.map((b) => Array.from(b.slice(y * 32, y * 32 + 32)).map((t) => CH[t]).join('')).join('  '));
}
