import { pick, shuffle, type Rng } from './rng';
import { ENEMIES } from './words';

export const VOICES = ['hype', 'grumpy', 'shy', 'noble', 'chaotic', 'wise'] as const;
export type Voice = (typeof VOICES)[number];

export interface CustomCommand { name: string; response: string }

export interface Personality {
  voice: Voice;
  catchphrases: string[];
  likes: string[];
  enemy: string;
  commands: CustomCommand[];
}

// {K} keyword, {K2} second keyword, {N} name, {T} ticker, {E} enemy
const CATCH: Record<Voice, string[]> = {
  hype: ['LET\'S GOOO, {K} SQUAD!', '{T} IS AWAKE AND LOUD!', 'Combo meter full, {K} mode on!', 'Press start, feel the {K}!', 'No lag, only {K}!', 'Turbo button: pressed.', '{N} has entered the arcade!'],
  grumpy: ['Ugh. Fine. {K}.', 'Do not touch my {K2}.', 'I was napping. Thanks.', 'Another day, another {E}.', 'Insert coin. Or leave.', 'Back in my day {K} meant something.', 'Whatever. {T} abides.'],
  shy: ['oh... hi. {K}?', 'i like {K}. a little. a lot.', 'please be nice to {T}...', 'is it okay if i stay here?', 'i drew this {K2} for you', 'sorry, i blinked', 'um. hello, player.'],
  noble: ['By the {K}, I stand.', 'Honor to every player.', '{T} keeps its word.', 'I shall face {E} with courage.', 'A true {K} never quits.', 'For the arcade!', 'My blade is {K2}.'],
  chaotic: ['{K}?? {K}!! {K}!!!', 'I pressed every button at once.', 'Who put {K2} in the coin slot? Me.', 'Rules are for menus.', '{T} goes brrrr.', 'Glitch is a lifestyle.', 'I ate the high score.'],
  wise: ['Patience is a power-up.', 'Every {K} begins with one pixel.', 'The {E} passes. The arcade stays.', 'Read the chart, not the noise.', 'A calm sprite lands every jump.', '{T} remembers.', 'Even bosses were level 1.'],
};

const COMMAND_NAMES = ['dance', 'roast', 'lore', 'combo', 'snack', 'flex', 'nap', 'joke', 'secret', 'cheer', 'boss', 'spin'];

const COMMAND_TEMPLATES: Record<string, string[]> = {
  dance: ['*{N} does a 4-frame shuffle*', '*left, right, jump, {K}!*', '*{N} moonwalks across the scanlines*'],
  roast: ['Your wallet has more lag than my first level.', 'You dodge jumps like {E} dodge accountability.', 'Nice try. My grandma sprite plays better.'],
  lore: ['Legend says {N} once beat {E} with a single pixel.', 'Before the arcade, there was only {K}.', 'The first {T} coin is still under the cabinet.'],
  combo: ['UP UP DOWN DOWN {K}! ...nothing happened.', 'x2 x4 x8 COMBO! (it was just me)', 'Combo breaker!'],
  snack: ['*{N} eats a {K2}* delicious.', 'I am powered by {K2} and crumbs.', 'Snack break. Back in 3 frames.'],
  flex: ['Look at these 32 pixels of pure muscle.', 'My sprite sheet has 9 states. Yours?', 'I was hand-placed. Respect.'],
  nap: ['*{N} curls up in the corner* zzz', 'Wake me when {K} happens.', 'Low power mode... z z z'],
  joke: ['Why did the sprite cross the road? Collision detection failed.', 'What does {N} drink? Pixel-ade.', 'I told a joke about {E}. Nobody laughed.'],
  secret: ['The secret is: there is no secret. Only {K}.', 'Psst. Hold jump longer.', 'Behind the GAME OVER room is... another GAME OVER room.'],
  cheer: ['YOU CAN DO IT, PLAYER ONE!', 'Go go go! {K} believes in you!', '*{N} waves tiny pixel pom-poms*'],
  boss: ['Every boss has a pattern. Learn it.', 'I am the boss of this corner.', 'Final boss: {E}. Health bar: long.'],
  spin: ['*{N} spins 360 frames*', 'Wheeeeee', '*dizzy pixels*'],
};

export function buildPersonality(rng: Rng, k1: string, k2: string, name: string, ticker: string): Personality {
  const voice = pick(rng, VOICES);
  const enemy = pick(rng, ENEMIES);
  const sub = (t: string) =>
    t.replace(/\{K2\}/g, k2).replace(/\{K\}/g, k1).replace(/\{N\}/g, name).replace(/\{T\}/g, `$${ticker}`).replace(/\{E\}/g, enemy);
  const catchphrases = shuffle(rng, CATCH[voice]).slice(0, 5).map(sub);
  const cmdNames = shuffle(rng, COMMAND_NAMES).slice(0, 3);
  const commands = cmdNames.map((c) => ({ name: c, response: sub(pick(rng, COMMAND_TEMPLATES[c])) }));
  return { voice, catchphrases, likes: [k1, k2], enemy, commands };
}
