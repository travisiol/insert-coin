import { pick, type Rng } from './rng';

// Placeholders: {N} name, {A} archetype, {K} top keyword, {K2} second keyword, {E} enemy, {P} place
const ORIGIN = [
  '{N} hatched from a {K} stuck in a coin slot.',
  '{N} was coded at 3am by a {A} who loved {K}.',
  'Born inside a broken {K} machine, {N} woke up hungry.',
  '{N} fell out of a cartridge labelled {K}.',
  'A spilled soda shorted a cabinet and {N} blinked on.',
  '{N} grew up on the bottom shelf of a {P}.',
  'Nobody remembers who drew {N}, only the {K} on its chest.',
  '{N} is a {A} who escaped a {K} tutorial level.',
  'Lightning hit a {P} and out walked {N}.',
  '{N} came free with a bag of {K} chips.',
  'A {A} pressed START on a {K} and became {N}.',
  '{N} was the last sprite on a forgotten {K} disk.',
  'Someone typed {K} into a terminal and {N} answered.',
  '{N} was assembled from leftover {K} pixels.',
  'In a {P} full of {K}, {N} learned to walk.',
  '{N} spawned when the high score hit {K}.',
  '{N} is what happens when a {A} reads too much about {K}.',
  'Long ago, {N} guarded the {K} vault of a {P}.',
  '{N} was a background character until {K} happened.',
  'A coin rolled under a {P} cabinet. {N} rolled out.',
  '{N} learned to speak by reading {K} posts.',
  'Built from one {K} and two lost lives, {N} was ready.',
  '{N} once worked night shifts at a {P}.',
  '{N} is a {A} made of {K} and stubbornness.',
  'An old {K} manual had one blank page. {N} lives there now.',
  '{N} crawled out of a demo reel about {K}.',
  'The {P} janitor found {N} glowing behind a {K} poster.',
  '{N} got its name from a typo in a {K} tweet.',
  '{N} was the bonus round nobody unlocked, until now.',
  'A {A} and a {K} shared one save slot. That was {N}.',
  '{N} came online when someone said {K} three times.',
  '{N} spent years as a {K} screensaver.',
  'Every {P} has a legend. This one is {N}.',
  '{N} was printed on the back of a {K} receipt.',
  '{N} fell from the sky over a {P} holding a {K}.',
  '{N} was a test sprite that refused to be deleted.',
  'When the {K} servers went down, {N} stayed up.',
  '{N} was born in the glitch between {K} and {K2}.',
  '{N} rode in on the last bus to the {P}.',
  'A {A} found a {K} and pressed every button. {N} appeared.',
];

const GOAL = [
  'Now it wants to collect every {K} in the arcade.',
  'Its quest: a high score built on {K}.',
  'It dreams of a crown made of {K2}.',
  'It wants to beat {E} in a fair fight.',
  'It trains daily to defend the {P} from {E}.',
  'Its plan is simple: more {K}, fewer {E}.',
  'It is searching for the legendary {K2} level.',
  'It wants its name on the top of the {P} board.',
  'It hopes to bring {K} to every screen.',
  'It wants to prove a {A} can master {K}.',
  'It collects stories about {K} for the night shift.',
  'Its mission is to keep the {P} lights on.',
  'It wants to teach {K} to the next generation of sprites.',
  'It is chasing a rumor about a secret {K2} room.',
  'It wants a statue in the {P}, ideally shiny.',
  'It plans to outlast {E} one frame at a time.',
  'It wants to fill the world with {K2}.',
  'It is saving every credit for a {K} upgrade.',
  'It wants to find the {A} who drew it.',
  'It wants to turn {E} into a footnote.',
  'It hunts for {K} hidden behind cabinet walls.',
  'It wants a combo long enough to reach the {P} roof.',
  'It wants friends, snacks and {K}, in that order.',
  'It wants to make {K} the official sport of the {P}.',
  'It is building a fort out of {K2} and old tokens.',
  'It wants to unlock the ending nobody has seen.',
  'It wants to map every corner of the {P}.',
  'It challenges anyone who doubts {K}.',
  'It wants to hear a whole crowd cheer for {K}.',
  'It is writing a manual on surviving {E}.',
  'It wants to keep the arcade weird forever.',
  'It wants to be remembered every time someone says {K}.',
  'It wants to open a tiny {K} shop in the {P}.',
  'It hopes {K2} will finally notice it.',
  'It practices its victory dance for the big day.',
  'It wants to put {E} on the GAME OVER screen.',
  'It wants to finish the {K} level without a continue.',
  'It is on a mission to find more {K2}.',
  'It wants to be the loudest pixel in the {P}.',
  'It wants every player to leave smiling.',
];

const FLAW = [
  'Its only weakness is {E}.',
  'Sadly, it panics at the sight of {E}.',
  'It forgets everything after a long loading screen.',
  'It cannot resist pressing every button twice.',
  'It trips over its own pixels when excited.',
  'It talks to {K2} when nobody is watching.',
  'It refuses to read instructions.',
  'It is scared of the dark between levels.',
  'It eats {K2} and gets very sleepy.',
  'It still owes the {P} three credits.',
  'It overheats when someone mentions {E}.',
  'It cannot keep a secret about {K}.',
  'It laughs at its own jokes, loudly.',
  'It sulks for a full minute after every loss.',
  'It insists {K} is a food group.',
  'It blinks too much under pressure.',
  'It keeps losing its {K2} under the cabinet.',
  'It is allergic to {E}.',
  'It cannot jump without saying "hup".',
  'It narrates its own life out loud.',
  'It counts coins when it should be sleeping.',
  'It gets lost in menus.',
  'It trusts anyone who says {K}.',
  'It is a bit too proud of its pixel hair.',
  'It hides when the music speeds up.',
  'It always picks the hardest difficulty.',
  'It sneezes static when nervous.',
  'It argues with vending machines.',
  'It cannot walk past a {K2} without stopping.',
  'It thinks every shadow is {E}.',
  'It hums the same eight notes all day.',
  'It forgets which way is up after a combo.',
  'It cries when the credits roll.',
  'It overthinks every pixel.',
  'It cannot say no to a rematch.',
  'It wanders off when bored.',
  'It brags about scores nobody saw.',
  'It runs on snacks and pure stubbornness.',
  'It believes {E} are a myth. They are not.',
  'It needs a nap after every boss.',
];

const PLACES = ['arcade', 'pizza parlor', 'basement', 'bowling alley', 'mall', 'night market', 'laundromat', 'motel lobby', 'pier', 'garage'];

export interface StoryCtx { name: string; archetype: string; k1: string; k2: string; enemy: string }

function fill(t: string, c: StoryCtx, place: string): string {
  return t
    .replace(/\{N\}/g, c.name)
    .replace(/\{A\}/g, c.archetype)
    .replace(/\{K2\}/g, c.k2)
    .replace(/\{K\}/g, c.k1)
    .replace(/\{E\}/g, c.enemy)
    .replace(/\{P\}/g, place);
}

/** 3 sentences: origin / goal / flaw, max 240 chars. */
export function buildStory(rng: Rng, c: StoryCtx): string {
  const place = pick(rng, PLACES);
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = [pick(rng, ORIGIN), pick(rng, GOAL), pick(rng, FLAW)].map((t) => fill(t, c, place)).join(' ');
    if (s.length <= 240) return s;
  }
  const s = [ORIGIN[4], GOAL[30], FLAW[2]].map((t) => fill(t, c, place)).join(' ');
  return s.slice(0, 240);
}
