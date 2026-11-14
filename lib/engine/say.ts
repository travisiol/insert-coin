import type { Personality, Voice } from './personality';

export type Intent = 'greeting' | 'price' | 'wen' | 'who' | 'joke' | 'sad' | 'insult' | 'thanks' | 'agent' | 'unknown';

const INTENT_WORDS: [Intent, RegExp][] = [
  ['greeting', /\b(hi|hey|hello|yo|gm|sup|hiya|howdy|morning|evening)\b/],
  ['thanks', /\b(thanks|thank you|thx|ty|appreciate)\b/],
  ['price', /\b(price|mcap|market ?cap|chart|pump|dump|worth|value|up|down|green|red|how much)\b/],
  ['wen', /\b(wen|when|moon|lambo|soon|bond|bonding|migrate|listing)\b/],
  ['agent', /\b(agent|burn|buyback|trade|trading|fees?|ledger|strategy)\b/],
  ['who', /\b(who|what are you|your name|about you|are you)\b/],
  ['joke', /\b(joke|funny|lol|lmao|haha|meme)\b/],
  ['sad', /\b(sad|rekt|lost|down bad|cry|crying|depressed|bad day|ngmi)\b/],
  ['insult', /\b(scam|rug|trash|ugly|stupid|dumb|hate|worst|garbage|dead coin)\b/],
];

export function detectIntent(text: string): Intent {
  const t = ` ${text.toLowerCase()} `;
  for (const [intent, re] of INTENT_WORDS) if (re.test(t)) return intent;
  return 'unknown';
}

// {N} name {T} $TICKER {price} {change1h} {mcap} {like} {enemy} {event} {catch}
const TEMPLATES: Record<Intent, string[]> = {
  greeting: [
    'Hello, player. {N} online.', 'Hey! Pull up a stool, {T} is here.', 'Welcome to my corner of the arcade.',
    'A visitor! Quick, look busy.', 'Hi! I was just practicing jumps.', 'Greetings from 32x32 pixels.',
    'Oh hey. Got a coin? Kidding. Hi.', 'Player detected. Hello!', 'Yo. {catch}', 'Hello hello. The scanlines say hi too.',
  ],
  price: [
    'Live data: {T} at {price}, {change1h} in 1h, mcap {mcap}. That is data, not advice.',
    'Screen says {price} per {T}, 1h {change1h}. You read it, you decide.',
    'Numbers only: price {price}, mcap {mcap}, 1h {change1h}.',
    'DexScreener reports {price} and {change1h} over the last hour. No forecasts from me.',
    'I show numbers, I do not predict them: {price} / {mcap} / {change1h}.',
    'Current board: {T} {price}, market cap {mcap}. {catch}',
    'Here is what the chart says right now: {change1h} in 1h at {price}.',
    'Price {price}. Change 1h {change1h}. Mcap {mcap}. My opinion: none, I am a sprite.',
    'Data tile: {price} | {mcap} | {change1h}. I cannot tell the future.',
    'The board reads {price}. What it does next is anyone\'s game.',
  ],
  wen: [
    'Wen? I only know now. Now is {price}.', 'Nobody can tell you wen. Not even a wizard sprite.',
    'Bonding happens when the curve fills. I do not predict it.', 'Wen is a question for the future. I live in this frame.',
    'I count frames, not days. Ask the chart.', 'Soon is not a date. Data: {change1h} in 1h.',
    'I do not make promises. I make pixel noises.', 'Wen? When the curve says so.',
    'No crystal ball in this cabinet, only a CRT.', 'I report what happened. Latest: {event}.',
  ],
  agent: [
    'My agent only acts on real creator fees. Latest move: {event}.', 'Every action I take lands in the public ledger. Type "ledger".',
    'Type "status" to see what my agent is doing right now.', 'Last thing my agent did: {event}.',
    'I only animate when something really happened on-chain. Latest: {event}.', 'My moves are rules, not magic. Check "status".',
    'No fake activity here. Last event: {event}.', 'The agent follows its mode and limits. You can audit the ledger.',
    'Fees in, rules applied, everything logged. Latest: {event}.', 'Ask the ledger, it never lies. Type "ledger".',
  ],
  who: [
    'I am {N}, ticker {T}. I like {like}. I do not like {enemy}.', 'Name: {N}. Class: fighter. Weakness: {enemy}.',
    '{N}, born from a post, living in the arcade.', 'I am the pixel mascot of {T}. Type "story" for the long version.',
    'Just a {N} in a 32x32 world.', 'I am {N}. {catch}', 'Who am I? A sprite with a story. Type "story".',
    'Player two of the {T} arcade.', 'Your friendly neighborhood {N}.', '{N}. Fan of {like}. Enemy of {enemy}.',
  ],
  joke: [
    'Why do sprites never lie? They are too transparent.', 'I tried to jump over {enemy}. Hitbox too big.',
    'My favorite food? Bits and bytes.', 'Knock knock. Who\'s there? Lag. Lag wh- ...', 'I would tell a UDP joke but you might not get it.',
    'What do you call a fighter with no lives? Game over-qualified.', 'I asked the CRT for advice. It just flickered.',
    'My diet: 4 colors, no sugar.', 'I lost a fight with a loading bar once.', 'Pixel walks into a bar. Ouch, collision.',
  ],
  sad: [
    'Bad frames happen. Take a breath, player.', 'Even bosses lose sometimes. Rest, then retry.', 'Here, a tiny pixel hug: <3',
    'Step away from the screen for a bit. I will guard it.', 'You are more than a chart.', 'Low health? Grab water, not leverage.',
    'Sad mode is valid. The arcade will still be here.', 'I sulk too. Then I walk it off.', 'One bad level does not end the game.',
    'Sending good scanlines your way.',
  ],
  insult: [
    'Rude. I will remember this in pixel form.', 'Noted. Filed under {enemy}.', 'You sound like {enemy}. I am unbothered.',
    'Hey! I have feelings. Four tones of them.', 'Harsh. Still here though.', 'Say that to my 32 pixels.',
    'The ledger is public. Check it instead of guessing.', 'Your words bounce off my outline.', 'I will pretend that was a compliment.',
    'Ok. {catch}',
  ],
  thanks: [
    'Anytime, player.', 'Thank YOU for visiting.', '*happy pixel noises*', 'You are welcome. {catch}', 'Glad to help!',
    'No problem. Coins welcome, kidding.', 'High five! *misses*', 'Appreciated.', 'Thanks for stopping by the arcade.', '<3',
  ],
  unknown: [
    'I did not get that. Type "help".', 'Hmm. {catch}', 'My parser tripped. Try "help".', 'Interesting. Tell me more about {like}?',
    'Beep? Try "story" or "status".', 'I only speak arcade. Type "help".', 'That went over my 32 pixels.',
    'Say again, player?', '{catch}', 'I will think about that during my next nap.',
  ],
};

const VOICE_WRAP: Record<Voice, [string[], string[]]> = {
  hype: [['YO! ', 'OK OK OK. ', ''], [' LET\'S GO!', '!!', '']],
  grumpy: [['Hmph. ', 'Ugh. ', ''], [' Now let me nap.', ' Whatever.', '']],
  shy: [['um... ', 'oh. ', ''], [' ...sorry', ' (blushes)', '']],
  noble: [['Hear me. ', 'Good player, ', ''], [' Onward.', ' With honor.', '']],
  chaotic: [['HAHA ', '*glitches* ', ''], [' brrrr', ' ???', '']],
  wise: [['Listen. ', 'Hmm. ', ''], [' Patience.', ' Remember that.', '']],
};

export interface SayContext {
  name: string;
  ticker: string;
  personality: Personality;
  price?: string;
  change1h?: string;
  mcap?: string;
  events: string[]; // newest first, real events only
}

export function reply(text: string, ctx: SayContext, rnd: () => number = Math.random): string {
  const intent = detectIntent(text);
  const list = TEMPLATES[intent];
  const t = list[Math.floor(rnd() * list.length)];
  const p = ctx.personality;
  const [pre, post] = VOICE_WRAP[p.voice];
  const filled = t
    .replace(/\{N\}/g, ctx.name)
    .replace(/\{T\}/g, `$${ctx.ticker}`)
    .replace(/\{price\}/g, ctx.price ?? 'N/A')
    .replace(/\{change1h\}/g, ctx.change1h ?? 'N/A')
    .replace(/\{mcap\}/g, ctx.mcap ?? 'N/A')
    .replace(/\{like\}/g, p.likes[Math.floor(rnd() * p.likes.length)] ?? 'pixels')
    .replace(/\{enemy\}/g, p.enemy)
    .replace(/\{event\}/g, ctx.events[0] ?? 'nothing yet, still warming up')
    .replace(/\{catch\}/g, p.catchphrases[Math.floor(rnd() * p.catchphrases.length)] ?? '');
  return `${pre[Math.floor(rnd() * pre.length)]}${filled}${post[Math.floor(rnd() * post.length)]}`;
}
