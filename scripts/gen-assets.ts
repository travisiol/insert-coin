/** Build-time assets: 16x16 pixel cursor, apple-touch-icon and favicon from the logo. */
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from '../lib/png';

const pub = path.join(process.cwd(), 'public');
fs.mkdirSync(pub, { recursive: true });

const COLORS: Record<string, [number, number, number, number]> = {
  '#': [27, 43, 31, 255], c: [242, 183, 5, 255], p: [255, 243, 176, 255], d: [168, 122, 0, 255], w: [214, 232, 195, 255], '.': [0, 0, 0, 0],
};

function draw(rows: string[], scale: number, bg?: [number, number, number, number]) {
  const h = rows.length;
  const w = rows[0].length;
  const out = new Uint8Array(w * scale * h * scale * 4);
  for (let y = 0; y < h * scale; y++) for (let x = 0; x < w * scale; x++) {
    const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)];
    const c = ch === '.' && bg ? bg : COLORS[ch] ?? COLORS['.'];
    out.set(c, (y * w * scale + x) * 4);
  }
  return encodePNG(out, w * scale, h * scale);
}

const CURSOR = [
  '#...............',
  '##..............',
  '#w#.............',
  '#ww#............',
  '#www#...........',
  '#wwww#..........',
  '#wwwww#.........',
  '#wwwwww#........',
  '#wwwwwww#.......',
  '#wwwwwwww#......',
  '#wwwww#####.....',
  '#ww#ww#.........',
  '#w#.#ww#........',
  '##..#ww#........',
  '#....#ww#.......',
  '.....####.......',
];

const LOGO = [
  '.....######.....',
  '...##cccccc##...',
  '..#cpcccccccc#..',
  '.#cpcccccccccc#.',
  '.#ccccccc#cccc#.',
  '#cccccccc#ccccc#',
  '#cccccccc#ccccc#',
  '#cccccccc#ccccc#',
  '#cccccccc#ccccc#',
  '#cccccccc#ccccc#',
  '#cccccccc#ccccc#',
  '.#ccccccc#cccc#.',
  '.#cccccccccccd#.',
  '..#ccccccccdd#..',
  '...##ddddddd#...',
  '.....######.....',
];

fs.writeFileSync(path.join(pub, 'cursor.png'), draw(CURSOR, 1));
fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), draw(LOGO, 12, [27, 43, 31, 255]).subarray(0));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#1B2B1F"/>${LOGO.flatMap((r, y) =>
  r.split('').map((ch, x) => (ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${{ '#': '#1B2B1F', c: '#F2B705', p: '#FFF3B0', d: '#A87A00' }[ch]}"/>`)),
).join('')}</svg>`;
fs.writeFileSync(path.join(process.cwd(), 'app', 'icon.svg'), svg);
console.log('assets ready');
