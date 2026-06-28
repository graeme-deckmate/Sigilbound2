/**
 * Pixel-grid art data, ported from the prototype. No Phaser imports so
 * tests can assert grid integrity (uniform row widths, palette refs).
 * '.' (and any char missing from the palette) is transparent.
 */

export type PixelGrid = readonly string[];
export type Palette = Readonly<Record<string, string>>;

/** Player palette: h/H hood, s skin, e eyes, r/R robe, b belt, f feet, w trim. */
export const PLAYER_PAL: Palette = {
  h: '#7c5cff',
  H: '#5a3fd0',
  s: '#f2c79b',
  e: '#16112b',
  r: '#4636a8',
  R: '#352683',
  b: '#ffc857',
  f: '#241d42',
  w: '#efe6d0',
};

export const PLAYER_FRONT: PixelGrid = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '.HHHHHHHHHH.',
  '....ssss....',
  '...s.ss.s...',
  '...ssssss...',
  '..rrrrrrrr..',
  '.rrrbbbbrrr.',
  '.rrrrrrrrrr.',
  '.RrrrrrrrrR.',
  '..RRRRRRRR..',
  '...ff..ff...',
  '...ff..ff...',
];

export const PLAYER_BACK: PixelGrid = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '.HHHHHHHHHH.',
  '...HHHHHH...',
  '...rrrrrr...',
  '..rrrrrrrr..',
  '.rrrrrrrrrr.',
  '.rrrbbbbrrr.',
  '.rrrrrrrrrr.',
  '.RrrrrrrrrR.',
  '..RRRRRRRR..',
  '...ff..ff...',
  '...ff..ff...',
];

/**
 * Villager palettes: the player grid with hood/robe hues swapped
 * (docs/03 section 12 allows palette swaps for the 6 villagers).
 */
export const VILLAGER_PALS: Readonly<Record<string, Palette>> = {
  elder: { ...PLAYER_PAL, h: '#efe6d0', H: '#c9bfa8', r: '#6b5a3f', R: '#52452f', b: '#9d7bff' },
  keeper: { ...PLAYER_PAL, h: '#69c98b', H: '#3da45c', r: '#2c6e49', R: '#1f5d3b' },
  dreamer: { ...PLAYER_PAL, h: '#5ad1ff', H: '#3f9fd1', r: '#1d4e89', R: '#16395f' },
  twin_a: { ...PLAYER_PAL, h: '#ff8fb3', H: '#d96a8e', r: '#8e4661', R: '#6e3349' },
  twin_b: { ...PLAYER_PAL, h: '#ffd84a', H: '#d9ad2a', r: '#8e7430', R: '#6e5a22' },
  scout: { ...PLAYER_PAL, h: '#b99a63', H: '#8a6a3f', r: '#6e5330', R: '#52452f' },
  murk: { ...PLAYER_PAL, h: '#43405c', H: '#2e2554', r: '#52452f', R: '#3b3322', b: '#9d7bff' },
};

/** Cosmetic player palettes (v2 V3): hood/robe recolors of PLAYER_PAL. */
export const PLAYER_PALETTES: Readonly<Record<string, Palette>> = {
  default: PLAYER_PAL,
  crimson: { ...PLAYER_PAL, h: '#ff6b6b', H: '#d04040', r: '#a83636', R: '#832626' },
  jade: { ...PLAYER_PAL, h: '#5fd6a0', H: '#3da472', r: '#2c6e52', R: '#1f5d3b' },
  gold: { ...PLAYER_PAL, h: '#ffd84a', H: '#d9ad2a', r: '#8e7430', R: '#6e5a22' },
  slate: { ...PLAYER_PAL, h: '#8a9bb5', H: '#5a6b85', r: '#3a4658', R: '#2a3242' },
};

export const PALETTE_IDS: readonly string[] = ['default', 'crimson', 'jade', 'gold', 'slate'];

/* ---------- battle sprites (docs/03 section 12) ---------- */

export interface BattleSprite {
  grid: PixelGrid;
  pal: Palette;
}

/** Gloop, ported verbatim from the prototype. */
const GLOOP: BattleSprite = {
  grid: [
    '....aaaaaaaa....',
    '..aaaaaaaaaaaa..',
    '.aaaaaaaaaaaaaa.',
    '.aaeeaaaaaaeeaa.',
    'aaaeppaaaaeppaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaammmmmmmaaaaa',
    'aaaaammmmmaaaaaa',
    '.babababababab..',
    '.bbbbbbbbbbbbbb.',
    '..bbbbbbbbbbbb..',
    '....bbbbbbbb....',
  ],
  pal: { a: '#6fd96f', b: '#3da45c', e: '#ffffff', p: '#16112b', m: '#2c7a44' },
};

/** Pondscale: a marsh hopper, cool blue-green, big tongue-ready mouth. */
const PONDSCALE: BattleSprite = {
  grid: [
    '...gg......gg...',
    '..geeg....geeg..',
    '..gppg....gppg..',
    '.ggggggggggggg..',
    'gggggggggggggggg',
    'ggsssssssssssggg',
    'gsmmmmmmmmmmmsgg',
    'ggsssssssssssggg',
    '.gggggggggggggg.',
    '..ftg......gtf..',
    '..ff..........f.',
    '.fff..ffff..fff.',
  ],
  pal: {
    g: '#4fae8a',
    s: '#3a8a6c',
    m: '#1d4034',
    e: '#ffffff',
    p: '#16112b',
    t: '#2f6e57',
    f: '#26594a',
  },
};

/** Burrowkin: a squat digger, earth tones, heavy claws. */
const BURROWKIN: BattleSprite = {
  grid: [
    '.....bbbbbb.....',
    '...bbbbbbbbbb...',
    '..bbbeebbeebbb..',
    '..bbbeppbppbbb..',
    '.bbbbbbbbbbbbbb.',
    '.bbssssssssssbb.',
    'bbssddddddddssbb',
    'bbssddddddddssbb',
    '.bbssssssssssbb.',
    '.cbbbbbbbbbbbbc.',
    'ccc..bbbbbb..ccc',
    'cc....bbbb....cc',
    'c.....b..b.....c',
  ],
  pal: {
    b: '#8a6a3f',
    s: '#6e5330',
    d: '#52452f',
    e: '#ffffff',
    p: '#16112b',
    c: '#b99a63',
  },
};

/** Bogmaw: boss-sized marsh maw (docs/03 section 12, ~24x20). */
const BOGMAW: BattleSprite = {
  grid: [
    '........gggggggg........',
    '.....ggggggggggggg......',
    '...ggggggggggggggggg....',
    '..ggsgggeeggggeeggsgg...',
    '..gssgggepggggepggssg...',
    '.ggssggggggggggggssgg...',
    '.gggggggggggggggggggg...',
    'ggggmmmmmmmmmmmmmmgggg..',
    'gggmtmtmtmtmtmtmtmmggg..',
    'gggmmmmmmmmmmmmmmmmggg..',
    'gggmtmtmtmtmtmtmtmmggg..',
    '.ggmmmmmmmmmmmmmmmmgg...',
    '.gggggggggggggggggggg...',
    '..ggssggggggggggssgg....',
    '..ggssggggggggggssgg....',
    '...gggggggggggggggg.....',
    '....wwgggggggggggww.....',
    '...wwwwggggggggwwww.....',
    '..wwwwwwwwwwwwwwwwww....',
    '.wwwwwwwwwwwwwwwwwwww...',
  ],
  pal: {
    g: '#4d7a3a',
    s: '#6b9b4a',
    m: '#1d3326',
    t: '#e8e4c9',
    e: '#ffd84a',
    p: '#16112b',
    w: '#1d4e89',
  },
};

/** Gloomwing, ported verbatim from the prototype. */
const GLOOMWING: BattleSprite = {
  grid: [
    'aa....aaaa....aa',
    'aaa..aaaaaa..aaa',
    'aaaa.aaaaaa.aaaa',
    '.aaaaaaaaaaaaaa.',
    '..aaabbbbbbaaa..',
    '..aabeppppebaa..',
    '...abbbbbbbba...',
    '...abbmmmmbba...',
    '....abbbbbba....',
    '.....a.bb.a.....',
    '......b..b......',
    '.....bb..bb.....',
  ],
  pal: { a: '#5e4a8f', b: '#3c2f63', e: '#ffffff', p: '#ff5d5d', m: '#efe6d0' },
};

/** Thornling, ported verbatim from the prototype. */
const THORNLING: BattleSprite = {
  grid: [
    '......gg......',
    '.....gggg.....',
    '..g..gggg..g..',
    '.ggg..gg..ggg.',
    '..gggssssggg..',
    '....ssssss....',
    '..ssepsspess..',
    '...ssssssss...',
    '..ssmmmmmmss..',
    '...ssssssss...',
    '....tttttt....',
    '....tt..tt....',
    '...ttt..ttt...',
    '...tt....tt...',
    '..ttt....ttt..',
    '..tt......tt..',
  ],
  pal: { g: '#7dde6a', s: '#5cae54', e: '#ffffff', p: '#16112b', m: '#33773a', t: '#7a5a36' },
};

/** Mossback: a stone-shelled tortoise, volt cracks it open. */
const MOSSBACK: BattleSprite = {
  grid: [
    '....ssssssss....',
    '..ssmmssmmssss..',
    '.sssssssssssoss.',
    '.smmsssmmssssss.',
    'ssssssssssssssss',
    'hsssmmssssmmsssh',
    'hhhssssssssssshh',
    '.hehhhhhhhhhhpe.',
    '.hhhhhhhhhhhhhh.',
    '..ff..ffff..ff..',
    '..ff..f..f..ff..',
    '.fff..f..f..fff.',
  ],
  pal: {
    s: '#5d6e4a',
    m: '#7a9b54',
    o: '#9bb86a',
    h: '#8a7a5a',
    e: '#ffffff',
    p: '#16112b',
    f: '#6b5a3f',
  },
};

/** Cindermote: a popping spark with a smoke trail. */
const CINDERMOTE: BattleSprite = {
  grid: [
    '...kk....kk...',
    '..k..o..o..k..',
    '....ooooooo...',
    '..oorrrrrroo..',
    '.oorreeperroo.',
    '.orrrrrrrrrro.',
    '.oorryyyyrroo.',
    '..oorryyrroo..',
    '....oorroo....',
    '..k..o..o..k..',
    '.k....kk....k.',
  ],
  pal: { o: '#ff8a3a', r: '#ff6b4a', y: '#ffd84a', e: '#ffffff', p: '#16112b', k: '#43405c' },
};

/** Hexbinder: a stooped caster wrapped in ash-gray robes. */
const HEXBINDER: BattleSprite = {
  grid: [
    '.....rrrr.....',
    '....rrrrrr....',
    '...rrhhhhrr...',
    '...rhepperh...',
    '...rrhhhhrr...',
    '..rrrrrrrrrr..',
    '.rrarrrrrrar..',
    '.rrarrggrrar..',
    'rrrarrggrrarrr',
    'rrraarrrraarrr',
    '.rrrrrrrrrrrr.',
    '..rrrrrrrrrr..',
    '...rr....rr...',
    '..rrr....rrr..',
  ],
  pal: {
    r: '#5a4a6b',
    h: '#43405c',
    a: '#8a7a9b',
    g: '#b07ce8',
    e: '#ffffff',
    p: '#16112b',
  },
};

/** Ashling: a smoldering ember wisp trailing soot. */
const ASHLING: BattleSprite = {
  grid: [
    '....kkkkkk....',
    '..kkkakkakk...',
    '.kkaakkkkaak..',
    '.kakrrkkrrak..',
    'kkkrreprrekkkk',
    'kkkrrrrrrrkkkk',
    '.kkarrrrrakk..',
    '..kkarrrakk...',
    '...kkaaakk....',
    '....kkakk.....',
    '.....kkk......',
    '....k...k.....',
  ],
  pal: { k: '#43405c', a: '#6b5a5a', r: '#ff6b4a', e: '#ffd84a', p: '#16112b' },
};

/** Thornveil Warden: a knotted grove given shape (boss, ~24x22). */
const THORNVEIL: BattleSprite = {
  grid: [
    '...g..gggg..gggg..g.....',
    '..ggg.gggggggggg.ggg....',
    '.gggggggggggggggggggg...',
    '..ggttggggggggggttgg....',
    '..gttttgggggggttttgg....',
    '.ggttggeeggggeeggttgg...',
    '.ggttggepggggepggttgg...',
    '.gggggggggggggggggggg...',
    '..ggggssssssssssgggg....',
    '..ggssssssssssssssgg....',
    '.ggssssmmmmmmmmssssgg...',
    '.ggssssssssssssssssgg...',
    '.ggttssssssssssssttgg...',
    '..gttttssssssssttttg....',
    '..ggttssssssssssttgg....',
    '...ggssssssssssssgg.....',
    '...ggttssssssttttgg.....',
    '....ggttttttttttgg......',
    '.....tttt....tttt.......',
    '....tttt......tttt......',
    '...tttt........tttt.....',
    '...ttt..........ttt.....',
  ],
  pal: {
    g: '#5cae54',
    t: '#7a5a36',
    s: '#33773a',
    m: '#1d3326',
    e: '#ffd84a',
    p: '#16112b',
  },
};

/** Ashen Warden: a pillar of cinders in a cracked shell (boss, ~22x22). */
const ASHENWARDEN: BattleSprite = {
  grid: [
    '......kkkkkkkkk.......',
    '....kkkrrrrrrkkk......',
    '...kkrrryyyyrrrkk.....',
    '...krryeeyyeeyrrk.....',
    '...krryepyyepyrrk.....',
    '...kkrryyyyyyrrkk.....',
    '....kkkrrrrrrkkk......',
    '...kkkkkrrrrkkkkk.....',
    '..kkrrkkkrrkkkrrkk....',
    '.kkrrrrkkrrkkrrrrkk...',
    '.krryyrrkrrkrryyrrk...',
    '.krryyrrrrrrrryyrrk...',
    '.kkrrrrrryyrrrrrrkk...',
    '..kkkrrryyyyrrrkkk....',
    '...kkkrrryyrrrkkk.....',
    '....kkrrrrrrrrkk......',
    '....kkrrkkkkrrkk......',
    '...kkrrkk..kkrrkk.....',
    '...krrkk....kkrrk.....',
    '..kkrkk......kkrkk....',
    '..kkk..........kkk....',
    '.kk..............kk...',
  ],
  pal: { k: '#43405c', r: '#ff6b4a', y: '#ffd84a', e: '#ffffff', p: '#16112b' },
};

/** Quartzling, ported verbatim from the prototype. */
const QUARTZLING: BattleSprite = {
  grid: [
    '....q......q....',
    '...qq..qq..qq...',
    '..qqq.qqqq.qqq..',
    '.aqqqaqqqqaqqqa.',
    '.aaaaaaaaaaaaaa.',
    'aaeppaaaaaaeppaa',
    'aaaaaaaaaaaaaaaa',
    '.aammmmmmmmmaa..',
    '..aaaaaaaaaaaa..',
    '.ba..baab..ab...',
    '.bb..bbbb..bb...',
    'bb....bb....bb..',
  ],
  pal: { q: '#bfe8ff', a: '#7fb6d9', b: '#4d7fa3', e: '#ffffff', p: '#16112b', m: '#39627f' },
};

/** Galeharrow: a storm-raptor banking on a cold wind. */
const GALEHARROW: BattleSprite = {
  grid: [
    'ww...........ww.',
    'www..ggggg..www.',
    '.wwwggggggggwww.',
    '..wwgeppgggww...',
    '...ggggggggg....',
    '..gggkkkkkggg...',
    '.gggkkkkkkkggg..',
    'wwggkkkkkkkggww.',
    'www.ggkkkgg.www.',
    'ww...ggggg...ww.',
    '......g.g.......',
    '.....gg.gg......',
  ],
  pal: { g: '#8aa3b8', k: '#5d7a94', w: '#c9d8e8', e: '#ffd84a', p: '#16112b' },
};

/** Hollowshade: a torn shadow with grasping hands. */
const HOLLOWSHADE: BattleSprite = {
  grid: [
    '.....kkkkkk.....',
    '...kkkkkkkkkk...',
    '..kkkvvkkvvkkk..',
    '..kkkvpkkvpkkk..',
    '..kkkkkkkkkkkk..',
    '...kkkmmmmkkk...',
    '..kkkkkkkkkkkk..',
    '.kkk.kkkkkk.kkk.',
    '.kk..kkkkkk..kk.',
    '.k..kkkkkkkk..k.',
    '....kkk..kkk....',
    '...kk......kk...',
  ],
  pal: { k: '#3a2f6b', v: '#c9b8ff', m: '#1a1433', p: '#16112b' },
};

/** Vale Wraith, ported verbatim from the prototype (boss). */
const VALEWRAITH: BattleSprite = {
  grid: [
    '......kkkkkk......',
    '....kkkkkkkkkk....',
    '...kkkkkkkkkkkk...',
    '..kkkvvkkkkvvkkk..',
    '..kkkvvkkkkvvkkk..',
    '..kkkkkkkkkkkkkk..',
    '...kkkkmmmmkkkk...',
    '...kkkkkkkkkkkk...',
    '..kkkkkkkkkkkkkk..',
    '.kkk.kkkkkkkk.kkk.',
    '.kk..kkkkkkkk..kk.',
    '.k...kkkkkkkk...k.',
    '.....kkkkkkk......',
    '......kkkkkk......',
    '.......kkkk.......',
    '......kk..kk......',
    '.....k......k.....',
    '....k........k....',
  ],
  pal: { k: '#3a2f6b', v: '#c9b8ff', m: '#1a1433' },
};

/** Glimmerkin: a skittish mote of vale-light (v1.1 rare roll). */
const GLIMMERKIN_SPRITE: BattleSprite = {
  grid: [
    '....gg....',
    '..ggyygg..',
    '.gyywwyyg.',
    '.gywwwwyg.',
    'ggywwwwygg',
    '.gywwwwyg.',
    '.gyywwyyg.',
    '..ggyygg..',
    '....gg....',
    '...g..g...',
  ],
  pal: { g: '#9d7bff', y: '#ffd84a', w: '#ffffff' },
};

/** Trial Guardian: graven sanctum stone, one demand burning in it. */
const TRIALGUARDIAN: BattleSprite = {
  grid: [
    '....ssssssss....',
    '..ssssssssssss..',
    '.ssssrrssrrssss.',
    '.ssssrrssrrssss.',
    'ssssssssssssssss',
    'ssssddddddddssss',
    'ssssdrrrrrrdssss',
    'ssssddddddddssss',
    'ssssssssssssssss',
    '.ssss.ssss.ssss.',
    '.sss..ssss..sss.',
    '.ss...ssss...ss.',
    '..s..ssssss..s..',
    '....ssssssss....',
  ],
  pal: { s: '#6b6480', r: '#ffd84a', d: '#3c3650' },
};

/** Hollow Warden: the Vale's drowned author, pen raised (03 s23). */
const HOLLOWWARDEN: BattleSprite = {
  grid: [
    '.......pppp.......',
    '......pp..pp......',
    '.......p..p.......',
    '....hhhhhhhhhh....',
    '..hhhhhhhhhhhhhh..',
    '.hhhwwhhhhhhwwhhh.',
    '.hhhwwhhhhhhwwhhh.',
    '.hhhhhhhhhhhhhhhh.',
    '..hhhhmmmmmmhhhh..',
    '.hhhhhhhhhhhhhhhh.',
    'hhhh.hhhhhhhh.hhhh',
    'hhh..hhhhhhhh..hhh',
    'hh...hhhhhhhh...hh',
    '.....hhhhhhhh.....',
    '......hhhhhh......',
    '.......hhhh.......',
    '......hh..hh......',
    '.....h......h.....',
  ],
  pal: { h: '#4a3f8a', w: '#e8e0ff', m: '#241d42', p: '#ffd84a' },
};

// v2 W4: new enemies reuse existing grids with recolored palettes (same keys).
const CRYPTCRAWLER: BattleSprite = {
  grid: PONDSCALE.grid,
  pal: {
    g: '#6b5a8f',
    s: '#4a3c6b',
    m: '#2a2042',
    e: '#d9ccff',
    p: '#16112b',
    t: '#5a4a7a',
    f: '#3a2f5a',
  },
};
const BONESHADE: BattleSprite = {
  grid: GLOOMWING.grid,
  pal: { a: '#cfc7b0', b: '#8a8270', e: '#ffffff', p: '#6f4fd8', m: '#3a3630' },
};
const MARSHLURK: BattleSprite = {
  grid: PONDSCALE.grid,
  pal: {
    g: '#6e7a3f',
    s: '#55602f',
    m: '#3a4020',
    e: '#e8ffd9',
    p: '#16112b',
    t: '#4a5528',
    f: '#3a4020',
  },
};
// v2 W5: boss-like dungeon foes (recolored existing grids).
const BONELORD: BattleSprite = {
  grid: THORNLING.grid,
  pal: { g: '#cfc7b0', s: '#a89e80', e: '#ff5d5d', p: '#16112b', m: '#8a8270', t: '#6b6450' },
};
const CIRCUITWARDEN: BattleSprite = {
  grid: GLOOMWING.grid,
  pal: { a: '#5ad1ff', b: '#2a6f9b', e: '#ffffff', p: '#ffd84a', m: '#16112b' },
};

export const BATTLE_SPRITES: Readonly<Record<string, BattleSprite>> = {
  gloop: GLOOP,
  pondscale: PONDSCALE,
  burrowkin: BURROWKIN,
  bogmaw: BOGMAW,
  gloomwing: GLOOMWING,
  thornling: THORNLING,
  mossback: MOSSBACK,
  cindermote: CINDERMOTE,
  hexbinder: HEXBINDER,
  ashling: ASHLING,
  thornveil: THORNVEIL,
  ashenwarden: ASHENWARDEN,
  quartzling: QUARTZLING,
  galeharrow: GALEHARROW,
  hollowshade: HOLLOWSHADE,
  valewraith: VALEWRAITH,
  glimmerkin: GLIMMERKIN_SPRITE,
  trialguardian: TRIALGUARDIAN,
  hollowwarden: HOLLOWWARDEN,
  cryptcrawler: CRYPTCRAWLER,
  boneshade: BONESHADE,
  marshlurk: MARSHLURK,
  bonelord: BONELORD,
  circuitwarden: CIRCUITWARDEN,
};

/** Every grid registered here gets row-uniformity asserted in tests. */
export const ALL_GRIDS: Readonly<Record<string, PixelGrid>> = {
  player_front: PLAYER_FRONT,
  player_back: PLAYER_BACK,
  gloop: GLOOP.grid,
  pondscale: PONDSCALE.grid,
  burrowkin: BURROWKIN.grid,
  bogmaw: BOGMAW.grid,
  gloomwing: GLOOMWING.grid,
  thornling: THORNLING.grid,
  mossback: MOSSBACK.grid,
  cindermote: CINDERMOTE.grid,
  hexbinder: HEXBINDER.grid,
  ashling: ASHLING.grid,
  thornveil: THORNVEIL.grid,
  ashenwarden: ASHENWARDEN.grid,
  quartzling: QUARTZLING.grid,
  galeharrow: GALEHARROW.grid,
  hollowshade: HOLLOWSHADE.grid,
  valewraith: VALEWRAITH.grid,
  glimmerkin: GLIMMERKIN_SPRITE.grid,
  trialguardian: TRIALGUARDIAN.grid,
  hollowwarden: HOLLOWWARDEN.grid,
};
