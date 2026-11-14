import type { Archetype } from './types';

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between
both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from
further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how
how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of
off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't
so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're
they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's
when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're
you've your yours yourself yourselves just like get got gonna wanna really now new one also still even much lol
im dont cant thats will make made today going via amp rt every`.split(/\s+/).filter(Boolean),
);

export const EMOJI_WORDS: Record<string, string> = {
  '🐸': 'frog', '🚀': 'rocket', '🐶': 'dog', '🐕': 'dog', '🐱': 'cat', '🐈': 'cat', '🤖': 'robot', '👻': 'ghost',
  '💀': 'skull', '☠️': 'skull', '🔥': 'fire', '💎': 'diamond', '🌙': 'night', '👽': 'alien', '🐻': 'bear',
  '🦉': 'owl', '🐒': 'monkey', '🐵': 'monkey', '🐰': 'bunny', '🐇': 'bunny', '🧑‍🚀': 'astronaut', '🗡️': 'knight',
  '⚔️': 'knight', '🧙': 'wizard', '🪄': 'wizard', '💰': 'cash', '💸': 'cash', '📈': 'pump', '📉': 'dump',
  '😂': 'laugh', '🤣': 'laugh', '😭': 'tears', '❤️': 'love', '🍕': 'pizza', '🍔': 'burger', '☕': 'coffee',
  '🎮': 'game', '👑': 'king', '🌈': 'rainbow', '⚡': 'bolt', '🐳': 'whale', '🦍': 'ape', '🍌': 'banana',
};

/** Words that map to an archetype. */
export const ARCHETYPE_WORDS: Record<Archetype, string[]> = {
  cat: ['cat', 'cats', 'kitty', 'kitten', 'meow', 'purr', 'neko'],
  dog: ['dog', 'dogs', 'doge', 'puppy', 'pup', 'woof', 'shiba', 'inu', 'doggo'],
  frog: ['frog', 'frogs', 'toad', 'ribbit', 'pond', 'lily'],
  robot: ['robot', 'bot', 'bots', 'ai', 'android', 'machine', 'cyborg', 'droid', 'agent'],
  ghost: ['ghost', 'ghosts', 'boo', 'spirit', 'haunted', 'phantom', 'spooky'],
  alien: ['alien', 'aliens', 'ufo', 'martian', 'space', 'galaxy', 'planet'],
  bear: ['bear', 'bears', 'teddy', 'grizzly', 'panda', 'honey'],
  owl: ['owl', 'owls', 'hoot', 'bird', 'birds', 'wise'],
  skull: ['skull', 'skeleton', 'bones', 'dead', 'death', 'rip', 'grave'],
  blob: ['blob', 'goo', 'jelly', 'gel', 'mochi', 'bubble'],
  monkey: ['monkey', 'monkeys', 'ape', 'apes', 'chimp', 'banana', 'gorilla'],
  bunny: ['bunny', 'rabbit', 'rabbits', 'hop', 'carrot', 'hare'],
  astronaut: ['astronaut', 'cosmonaut', 'orbit', 'nasa', 'moonwalk', 'spacewalk', 'rocketman'],
  knight: ['knight', 'sword', 'shield', 'castle', 'king', 'queen', 'armor', 'quest'],
  wizard: ['wizard', 'magic', 'mage', 'spell', 'witch', 'sorcerer', 'potion', 'wand'],
  rocket: ['rocket', 'launch', 'blastoff', 'liftoff', 'jet', 'thruster'],
};

export const ADJECTIVES = [
  'Broke', 'Turbo', 'Sleepy', 'Angry', 'Lucky', 'Tiny', 'Chunky', 'Salty', 'Sneaky', 'Loud',
  'Shy', 'Brave', 'Rusty', 'Fuzzy', 'Spicy', 'Cosmic', 'Grumpy', 'Happy', 'Lazy', 'Wild',
  'Pixel', 'Noble', 'Feral', 'Crispy', 'Soggy', 'Mighty', 'Clumsy', 'Shiny', 'Dizzy', 'Jolly',
  'Moody', 'Nerdy', 'Rowdy', 'Silent', 'Speedy', 'Wobbly', 'Zesty', 'Bouncy', 'Cranky', 'Dapper',
  'Electric', 'Frosty', 'Glitchy', 'Hungry', 'Itchy', 'Jumpy', 'Kooky', 'Lunar', 'Midnight', 'Neon',
  'Odd', 'Plucky', 'Quiet', 'Retro', 'Stubborn', 'Tired', 'Unlucky', 'Velvet', 'Weird', 'Brisk',
];

export const SUFFIXES = [
  'Kid', 'Lord', 'Bot', 'Boy', 'Girl', 'Max', 'Prime', 'Jr', 'Zero', 'One',
  'Champ', 'Ace', 'Rex', 'Pal', 'Hero', 'Boss', 'Duke', 'Chief', 'Unit', 'X',
];

export const NOUNS_FALLBACK = [
  'pixel', 'button', 'cartridge', 'joystick', 'token', 'arcade', 'combo', 'glitch', 'bonus', 'credit',
  'sprite', 'level', 'boss', 'power', 'turbo', 'score', 'quest', 'lives', 'cheat', 'save',
];

export const ENEMIES = [
  'rugs', 'paper hands', 'bears', 'gravity', 'red candles', 'slow wifi', 'mondays', 'gas fees',
  'empty wallets', 'lag', 'the dip', 'fake news', 'jeets', 'boredom', 'game over screens', 'spam bots',
];
