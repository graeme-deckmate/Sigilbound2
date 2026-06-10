# 03 - CONTENT DATA (v1.1)

Single source of truth for game numbers and content. Transcribe into `src/data/` and `content/` exactly. Where 02 and this file disagree, this file wins. Sections 13+ are the v1.1 expansion (accepted per docs/05). v1.1 player-facing copy not written here is authored in its build phase per 02 tone rules and added to this file when final.

## 1. Elements (5)

| id | label | color | status on enemy | proc | notes |
|---|---|---|---|---|---|
| ember | Ember | #ff6b4a | Burning (DoT) | .35 | starter |
| rime | Rime | #5ad1ff | Chilled (dmg x0.65) | .40 | |
| volt | Volt | #ffd84a | Stunned (skip) | .28 | stun immunity 1 turn after expiry |
| thorn | Thorn | #7dde6a | Envenomed (DoT) | .50 | |
| gloom | Gloom | #b07ce8 | Withered (+25% taken) | .40 | new in v1.0 |

Enemy DoT values: Burning = 4 + ceil(playerLv * 1.2). Envenomed = 6 + ceil(playerLv * 1.5). Tick at the start of that enemy's turn.

## 2. Forms (5)

| id | label | pw | mp | targeting |
|---|---|---|---|---|
| wisp | Wisp | 0.62 | 0.50 | single |
| bolt | Bolt | 1.00 | 1.00 | single |
| lance | Lance | 1.42 | 1.55 | single |
| nova | Nova | 0.55 | 1.45 | all enemies (pw applies per target) |
| veil | Veil | 0.90 | 1.10 | self shield |
| call | Call | 0.55 | 1.70 | summons a familiar (v1.1, Act 4 unlock; section 22) |

## 3. Runes (6)

| id | label | effect | mp | suffix |
|---|---|---|---|---|
| none | No rune | - | 1.00 | (none) |
| fury | Fury | pw x1.5 | 1.65 | of Fury |
| thirst | Thirst | heal 35% of damage dealt (on shield break for Veil) | 1.35 | of Thirst |
| echo | Echo | 2 hits at 0.62 each (Veil: re-applies once after breaking) | 1.45 | of Echoes |
| hex | Hex | +0.40 status proc (and Veil rider proc) | 1.30 | of Hexes |
| keen | Keen | crit 26% at x1.75 (no effect on Veil, UI must state this) | 1.20 | of Keening |
| wyrd | Wyrd | pw x1.35; every cast rolls the surge table (section 18) | 1.15 | of the Wyrd |

**Relic runes (v1.1, hidden, one rule-bend each, section 19 for placement):**

| id | label | effect | mp | suffix |
|---|---|---|---|---|
| emberglass | Emberglass | enemy resists count as neutral (0.6 -> 1.0) for this spell | 1.10 | of Emberglass |
| stillwater | Stillwater | variance becomes 1.0..1.1 (no low rolls) | 1.15 | of Stillwater |
| stormcoil | Stormcoil | Wheel reactions triggered by this spell do not consume the setup status | 1.25 | of the Stormcoil |
| hollowlight | Hollowlight | if this spell kills its target, refund its full MP cost | 1.00 | of Hollowlight |
| wraithmark | Wraithmark | potency range extends to x1.80, always stable (section 23 drop) | 1.00 | of the Wraithmark |

Relics occupy the rune slot (a real trade against Fury/Keen). All have pw x1.0 and crit/proc defaults.

## 4. Spell formulas

```
potency p   = 0.70..1.50, step 0.05, default 1.00, locked at inscribe
              (wraithmark rune extends range to 1.80)
potCost(p)  = piecewise linear through (0.70, 0.60), (1.00, 1.00), (1.50, 2.00)
              (wraithmark segment continues (1.50, 2.00)..(1.80, 2.60))
twinMp      = 1.6 if the spell is twin-element else 1.0

cost        = max(2, round(6 * form.mp * rune.mp * potCost(p) * twinMp))
powerPerHit = 13 * form.pw * (rune.pw ?? 1) * p * (1 + (lv-1) * 0.22)
              * (rune.hits ? rune.pwEach : 1)        // echo
hit         = powerPerHit * elementMult * aspectMult * variance(0.9..1.1) * critMult?
proc        = clamp(element.proc + (rune.proc ?? 0) + aspectProc, 0, 0.95)
veilShield  = round(14 * (rune.pw ?? 1) * p * (1 + (lv-1) * 0.22) * form.pw)   // form.pw = 0.90
veilRider   = proc 0.40 base (volt rider 0.25), +0.40 with hex, status applied to attacker
crit        = 8% x1.5 base; keen overrides to 26% x1.75
elementMult = weak 1.6 | resist 0.6 | neutral 1.0 (bosses may override)
aspectMult  = 1.10 if the spell's element is the Vale Aspect (section 25), else 1.0
aspectProc  = +0.10 same condition, else 0

// Twin-element spells (Act 4 unlock, section 15):
twinElementMult = min(1.3, max(multA, multB))   // per-element matchup, best one, capped
twin status     = each element rolls its status independently at proc/2
twin greedy gate= the LOWER of the two elements' mastery tiers gates stability

// Unstable casts: p >= 1.30 with the gating element below mastery tier 2
// rolls the surge table (section 18) after the spell resolves. Wyrd always rolls.
```

Naming: `ELEM_PRE[element] + FORM_ROOT[form] + rune.suffix`. Prefixes: Ember, Rime, Volt, Thorn, Gloom. Twin spells use the pair prefix from section 15. Roots: wisp, bolt, lance, nova, veil, call. Examples: Gloomnova of Hexes, Emberveil of Thirst, Voltlance of Keening, Stormlance of Fury. The player may rename at inscribe (1 to 18 chars, generated name becomes the subtitle); log lines use the player's name.

## 5. Unlock schedule

The player chooses a **starter element** from the Elder: Ember, Rime, or Thorn. The two unpicked starters backfill in wheel order from the chosen one (chose Ember: Rime at Lv 2, Thorn at Lv 6. Chose Rime: Thorn at Lv 2, Ember at Lv 6. Chose Thorn: Ember at Lv 2, Rime at Lv 6).

| Trigger | Unlock |
|---|---|
| start | chosen starter element; Wisp, Bolt; (no rune); potency slider |
| Lv 2 | first unpicked starter (wheel order) |
| Lv 3 | Lance |
| Lv 4 | Volt |
| Lv 5 | Nova |
| Lv 6 | second unpicked starter (wheel order) |
| Lv 7 | Veil |
| Lv 8 | Gloom |
| Lv 9 | Hex |
| Shrine: Hearthvale (hidden SW) | Fury |
| Shrine: Westwood (deep NW) | Thirst |
| Shrine: Ashen Reach (far E) | Echo |
| Shrine: North Hollow (mid) | Keen |
| Peddler trade (30 essence) | Wyrd |
| Gate caches (section 19) | Emberglass, Stillwater, Stormcoil, Hollowlight |
| Essence (40 / 80, section 16) | Grimoire slots 5 and 6 |
| Sanctum trial 1 (section 23) | Call form |
| Sanctum trials complete | Twin inscription |
| Hollow Warden | Wraithmark |

Wheel reactions (section 14) are intrinsic: no unlock, live from the first battle that lines one up.

Locked Grimoire chips show the hint text: "Reach Lv N", "Pray at the <region> shrine", "Murk trades in such things", "Sealed behind an old gate", or "The Sanctum remembers."

## 6. Progression

```
xpNext(lv) = 14 + (lv-1)^1.35 * 14     // cap 12 (v1.1 reshape: cheaper 2-3, pricier 9-11)
levelUp    = +8 maxHP, +4 maxMP, full restore
base       = 46 HP, 26 MP at Lv 1     // v1.1: +4 starting MP (the Lv 1 fourth-bolt fix)
regen      = +1 HP and +1 MP per 6 overworld steps
encounter  = 14% per tall-grass step; grace 4 after battle, 6 after defeat
focus      = +35% maxMP, +10% maxHP, cleanse 1 player status
flee       = 65%, disabled vs bosses
```

v1.1 early-game smoothing (with the sim assertions from 02): formations with 2+ members never roll in `hearthvale.meadow` while the player is Lv 1 (the zone's table re-weights to singles). Marsh is unchanged; walking south early is meant to sting.

Essence, mastery, and the v1.1 progression systems: sections 16 and 17.

## 7. Enemy roster

Stats: `hp = h0 + hpl*lv`, `atkRaw = a0 + al*lv`, damage = atkRaw * move.mult * variance(0.9..1.1), x0.65 if Chilled. Moves listed as name | mult | rider. Player-status riders begin in Act 2.

### Act 1: Hearthvale (enemy Lv 1-4)
| id | h0/hpl | a0/al | xp | weak | resist | moves |
|---|---|---|---|---|---|---|
| gloop | 22/8 | 5/1.6 | 11+3l | ember, volt | thorn | squelches forward 1.0; spits stinging ooze 0.85; wobbles, then slams 1.15 |
| pondscale | 24/8 | 5/1.7 | 12+3l | rime | ember | tongue lash 1.0; bog hop 0.9; mire croak 1.1 |
| burrowkin | 26/9 | 6/1.7 | 13+3l | ember | volt | claw swipe 1.0; flings dirt 0.8; undermines 1.2 |

**BOSS: Bogmaw** (Lv 4, hp 150 flat, atk 9/2.0, xp 60)
Normally weak ember. Every 3rd turn: **Submerge** (telegraphed, untargetable by wisp/bolt/lance/nova at normal mult). While submerged: ONLY volt hits, at x2.0, and a volt hit cancels the follow-up and Stuns it. If not interrupted, next turn: **Crashing Breach** at 1.6. Other moves: maw crush 1.1; mire wave 0.85.

### Act 2a: Westwood (enemy Lv 4-7)
| id | h0/hpl | a0/al | xp | weak | resist | moves |
|---|---|---|---|---|---|---|
| gloomwing | 24/9 | 6/1.8 | 14+3l | rime | ember | hooked claws 1.0; numbing shriek 0.8 + Chill player 30%; dives from the dark 1.2 |
| thornling | 30/10 | 7/1.9 | 16+3l | ember | volt, thorn | bramble lash 1.0; needle seeds 0.85 + Envenom player 30%; root surge 1.2 |
| mossback | 36/11 | 6/1.8 | 18+3l | volt | ember, rime | shell ram 1.0; hardens (self shield 16); moss spores 0.8 + Wither player 30% |

**BOSS: Thornveil Warden** (Lv 6, hp 230, atk 10/2.0, xp 110)
Weak ember; resist thorn, volt. At 60% HP summons 2 Thornlings (Lv 5). Every 4th turn: **Bramble Veil** (self shield 30). Moves: warden's lash 1.1; thorn volley 0.8 + Envenom player 35%.

### Act 2b: Ashen Reach (enemy Lv 5-8)
| id | h0/hpl | a0/al | xp | weak | resist | moves |
|---|---|---|---|---|---|---|
| cindermote | 26/9 | 7/1.9 | 16+3l | rime | ember | spark snap 1.0; flare 0.85 + Burn player 35%; popping burst 1.25 |
| hexbinder | 28/9 | 6/1.8 | 18+3l | volt, gloom | rime | binding sigil 0.9 + drains 6 MP; muttered curse 0.8 + Wither player 35%; staff strike 1.0 |
| ashling | 30/10 | 7/2.0 | 17+3l | rime | ember, thorn | cinder swipe 1.0; smolders 0.85 + Burn player 30%; ash veil (self shield 12) |

**BOSS: Ashen Warden** (Lv 8, hp 280, atk 11/2.1, xp 130)
Weak rime; resist ember. **Enrage** below 30% HP: damage +40%, announced. Moves: warden's brand 0.9 + Burn player 50%; pyre sweep 1.15; collapsing pillar 1.3 (weighted up while enraged).

### Act 3: North Hollow (enemy Lv 8-12)
| id | h0/hpl | a0/al | xp | weak | resist | moves |
|---|---|---|---|---|---|---|
| quartzling | 34/11 | 8/2.1 | 20+4l | volt | rime, ember | crystal claw 1.0; shard volley 0.9; refracted beam 1.25 |
| galeharrow | 30/10 | 8/2.2 | 21+4l | thorn | volt | talon dive 1.1; tailwind shriek 0.8 + Chill player 30%; gale rake 1.0 |
| hollowshade | 32/10 | 9/2.2 | 22+4l | gloom | thorn, rime | rending grasp 1.0; soul leech 0.8 + drains 5 MP; gloom lash 1.15 + Wither player 30% |

**FINAL BOSS: Vale Wraith** (Lv 11, hp 520, atk 13/2.2, no xp, ends the game)
- Phase 1 (100-50%): attunes to an element every 2 turns. Attuned element x1.8, all others x0.85.
- Phase 2 (<50%): summons 2 Hollowshades (Lv 9), attunement shifts every turn.
- Phase 3 (<20%): telegraphs **Doom of the Vale**, next turn hits at 2.6x. Counterable by Veil, Chill, a burst kill, or simply surviving it.
- Moves: reaps with a crescent of shadow 1.15; siphons your spirit 0.7 + drains 9 MP; howls the cold of the Vale 1.35. No fleeing.

## 8. Formations (weighted)

Format: `[members] weight`. Enemy level rolls within the zone band.

```
hearthvale.meadow   : [gloop] 3, [gloop,gloop] 2, [pondscale] 2, [gloop,pondscale] 1
hearthvale.marsh    : [pondscale] 3, [pondscale,gloop] 2, [burrowkin] 2, [burrowkin,pondscale] 1
westwood.outer      : [gloomwing] 3, [thornling] 2, [gloomwing,gloomwing] 2
westwood.deep       : [thornling,gloomwing] 2, [mossback] 2, [thornling,thornling] 2, [mossback,gloomwing] 1
ashenreach.outer    : [cindermote] 3, [ashling] 2, [cindermote,cindermote] 2
ashenreach.inner    : [hexbinder] 2, [ashling,cindermote] 2, [hexbinder,ashling] 2, [ashling,ashling,cindermote] 1
northhollow.cliffs  : [quartzling] 2, [galeharrow] 2, [quartzling,galeharrow] 2, [quartzling,quartzling] 1
northhollow.hollow  : [hollowshade] 2, [hollowshade,galeharrow] 2, [quartzling,hollowshade] 2, [hollowshade,hollowshade,galeharrow] 1
```

## 9. Maps

ASCII terrain + metadata entities (see 01 for format). Terrain legend:

```
#  tree (solid)      o  rock (solid)      ^  cliff (solid)
~  water (solid)     =  bridge            .  grass
,  tall grass        *  flowers           -  path
x  void (solid, map edge fill)
```

All entities (shrines, springs, rune shrines, bosses, NPCs, signs, lore stones, gates, exits, spawn points) are metadata lines with coordinates. `npm run genmaps` + `mapConnectivity.spec.ts` must prove every entity and exit reachable from every spawn.

| map | size | palette accent | contents |
|---|---|---|---|
| hearth | 30x20 | gold | safe hub, no encounters. Elder, Keeper, Twins (2 NPCs), Scout, Dreamer. Spring. Gate (north). Exits: S hearthvale, W westwood, E ashenreach, N northhollow (gated). One scripted Gloop fight trigger just outside the S exit, first visit only. |
| hearthvale | 60x40 | meadow green | zones meadow + marsh. Rune shrine FURY hidden behind a rock maze SW. Bogmaw arena SE. 3 signs, 1 lore stone, 1 spring. |
| westwood | 60x40 | deep green | dense tree corridors. Zones outer + deep. Rune shrine THIRST deep NW. Thornveil arena W center. 2 signs, 1 lore stone. |
| ashenreach | 60x40 | ash mauve | burnt palette. Zones outer + inner. Rune shrine ECHO far E. Ashen Warden arena NE. 1 spring mid, 2 signs, 1 lore stone. |
| northhollow | 50x40 | cold indigo | climbing switchbacks. Zones cliffs + hollow. Rune shrine KEEN mid. Spring before the summit. Vale Wraith at the top. 1 sign, 2 lore stones. |

Region palettes (world tiles tinted, battle backdrops keyed the same): define in `data/constants.ts` from the prototype palette family (ink #16112b, night #241d42, arcane #9d7bff, gold #ffc857, parch #efe6d0).

## 10. Dialogue (player-facing text, final copy)

Keep pages to 1-3 short lines. IDs referenced from map metadata.

**elder_intro** (Hearth):
1. "You feel it too, then. The Vale holds its breath."
2. "The Wraith bound our three Wardens with sigils of its own making. Marsh, wood, and ash."
3. "Take the Grimoire. Craft what the Vale has never seen, and unbind them."
4. "Start south. Even a Gloop will test a new wisp."

**elder_progress** (1+ sigils): "A Grand Sigil. So the old craft still answers. The others will be crueler."
**elder_gate** (3 sigils): "Three sigils, three Wardens freed. The northern seal is broken. The Wraith knows you are coming. Go anyway."
**elder_postgame**: "The Vale breathes again. Wander it. You earned the quiet."

**keeper_tips** (Hearth): "Tall grass bites. The shrine heals for free, so lean on it. And craft often, slots are not promises."
**twins_gossip_a**: "Slimes hate a good scorch. And a shock. Mostly they just lose."
**twins_gossip_b**: "The turtle things out west? Crack them with Volt. Everything else just bounces."
**scout_hints**: "Shrines glow where people stopped going. West woods, the ash flats, and one right here in the vale, behind the rocks southwest."
**dreamer_lore**: "I dreamt the Wraith was a Warden once. The fourth one. Nobody likes that dream."

**Signs**, by region:
- hearthvale_1: "Home shrine NORTH heals you. The marsh SOUTH does not."
- hearthvale_2: "Bogmaw sleeps southeast. When it dives, only lightning finds it."
- hearthvale_3: "Rock maze southwest. Something old glows in there."
- westwood_1: "WESTWOOD. Gloomwings nest here. They hate the cold."
- westwood_2: "The Warden's grove lies west. Burn a path."
- ashenreach_1: "ASHEN REACH. What burns here was born burning. Bring frost."
- ashenreach_2: "Hexbinders drink your wellspring. Shock them first."
- northhollow_1: "Past here the Vale ends and the Hollow begins. Be ready, or be brief."

**Lore stones** (Wraith backstory, one per region plus two in the Hollow):
- lore_vale: "Four Wardens kept the Vale. Marsh, Wood, Ash... and Hollow."
- lore_wood: "The Hollow Warden asked for more than its share of the craft. The Vale said no."
- lore_ash: "It carved sigils no one taught it. The other three sealed it away, and it learned to wait."
- lore_hollow_1: "It does not want the Vale. It wants the craft. Your craft."
- lore_hollow_2: "Whatever it attunes to, it fears. It always did."

**Boss intro lines** (battle log): Bogmaw "The marsh heaves. Bogmaw surfaces!" / Thornveil "The grove knots itself into a Warden!" / Ashen "The ash takes a burning shape!" / Wraith "The Vale Wraith rises from the Hollow!"

**How to play** (help dialogue): update prototype copy for v1.0 verbs (targets, Veil, player statuses, Focus cleanse).

## 11. Audio manifest

Loader checks `content/audio/`, falls back to the synth (`audio/synth.ts`, ported from prototype) per track/SFX if a file is missing. All sourced files must be CC0.

**Music** (`content/audio/music/*.ogg`): title, hearth, hearthvale, westwood, ashenreach, northhollow, battle, boss, ending (v1.1: sanctum, hollowwarden). Suggested CC0 source: Juhani Junkala's free chiptune music packs on OpenGameArt (verify CC0 license per file before committing; record attribution in `content/audio/CREDITS.md` regardless).

**SFX** (`content/audio/sfx/*.ogg`): select, confirm, deny, cast, hit, crit, hurt, heal, shield_up, shield_break, status_apply, encounter, victory, defeat, levelup, unlock, step_grass (optional), boss_telegraph. v1.1 additions: reaction, surge, gate_open, essence_pickup, scroll_cast, commission_done, summon, mastery_tier. Suggested CC0 source: Juhani Junkala "512 Sound Effects" pack (CC0) or Kenney audio packs (CC0). Synth fallback must cover every id.

v1.1 music additions: sanctum, hollowwarden (synth fallback like all tracks).

## 12. Battle sprite plan (procedural pixel grids)

Port `spriteFromGrid` + white-flash variant from the prototype. Overworld: player front/back 12x14 (existing). New overworld NPC grids: 6 villagers (12x14, palette swaps acceptable). Battle grids (16x16 to 24x24, scaled 4-6x): gloop, gloomwing, thornling, quartzling, wraith exist in the prototype; author new grids for pondscale, burrowkin, mossback, cindermote, hexbinder, ashling, galeharrow, hollowshade, bogmaw (boss-sized ~24x20), thornveil (~24x22), ashen warden (~22x22). Keep each grid's rows uniform width; a test asserts this for every registered sprite.

v1.1 additions: murk + fisher NPC grids (12x14), glimmerkin battle grid (14x14, shimmering palette cycle), trial guardian grid (20x20, tinted per trial), hollow warden (~24x24), familiar grid (12x12, palette-swapped per element), element gate tiles (5 variants + broken state), sanctum tileset accent (drowned violet, palette in section 23), HUD aspect glyph (8x8), scroll button icon, elite prefix tint rule (one-hue shift + 1px outline in the affix color).

---

# v1.1 EXPANSION DATA (sections 13+)

## 13. Elites and rare encounters

**Elites ("aspected"):** eligible after `world.bosses` includes bogmaw. On formation roll: 10% chance (NG+: 25%) to promote ONE member (the highest-level one). Promotion: name prefix, one affix, xp x2, +5 essence. Affix is rolled uniformly:

| affix | prefix | effect |
|---|---|---|
| veiled | Veiled | starts with shield 10 + 2*lv |
| frenzied | Frenzied | below 50% HP its damage x1.4 (announced) |
| mirrorhide | Mirrorhide | when hit by element E: 35% apply E's player-status to the player (volt has no player stun: drain 4 MP instead) |
| fleet | Fleet | acts twice per round, each at x0.6 damage |
| sealed | Sealed | takes 0 damage until broken by any Wheel reaction OR its weakness element (log names the key); +1 essence on kill |

**Rare rolls:** independent 4% on each encounter (before formation pick):

| roll (weight) | encounter |
|---|---|
| ambush (2) | normal formation, enemies act first in round 1 ("You are set upon!") |
| glimmer (1) | single Glimmerkin: hp 14+4l, never attacks, flees at end of round 2; xp 30+6l, +6 essence if caught |
| elite pack (1) | normal formation, EVERY member promoted (one affix each) |

## 14. The Vale's Wheel (status reactions)

Wheel order: ember -> rime -> volt -> thorn -> gloom -> ember. A player hit of element E on an enemy bearing the status of the element BEFORE E fires the reaction. Deterministic, per hit (Echo hit 1 can react, hit 2 can re-apply), consumes the setup status (exception: stormcoil rune). Twin spells check both elements (left element first; max one reaction per hit).

| reaction | setup status | trigger element | effect |
|---|---|---|---|
| Scald | Burning | rime | instant damage = 2 * burnTick, where burnTick = 4 + ceil(playerLv * 1.2) |
| Shatter | Chilled | volt | that hit deals +60% |
| Snare | Stunned | thorn | applies Envenomed at 100% with duration 4 |
| Blight | Envenomed | gloom | all remaining venom ticks deal immediately (turnsLeft * venomTick) |
| Kindle | Withered | ember | that hit deals +40% and applies Burning at 100% |

Reaction damage portions are affected by the Withered amp and boss overrides like any damage. Log lines (final copy): "Scalding burst!" / "The frost SHATTERS!" / "Snared!" / "The venom BLOOMS!" / "It KINDLES!". Reactions work on bosses. The wheelwright charm multiplies the damage portions x1.2.

## 15. Twin-element spells (Act 4 unlock)

A spell may carry two elements (any pair, order matters only for naming and reaction check order). Cost: twinMp x1.6 (section 4). Matchup: best element's multiplier capped at 1.3. Statuses: both roll at proc/2. Greedy stability gates on the lower mastery tier. Plus one bespoke pair rider:

| pair | prefix | rider |
|---|---|---|
| ember+rime | Steam | after this hit, target's next move deals x0.7 |
| ember+volt | Storm | single-target forms arc to one other random enemy for 50% of the hit |
| ember+thorn | Wildfire | on kill, applies Burning at 100% to all remaining enemies |
| ember+gloom | Hollowflame | damage ignores shields entirely |
| rime+volt | Static | Shatter from this spell deals +120% instead of +60% |
| rime+thorn | Mire | target acts last next round |
| rime+gloom | Depth | target cannot gain shields for 2 turns |
| volt+thorn | Surge | restore 3 MP per enemy hit |
| volt+gloom | Night | Withered applied by this spell is +40% damage taken (not +25%) |
| thorn+gloom | Rot | DoTs applied by this spell tick at the start AND end of the enemy's turn |

Naming: PairPrefix + FormRoot + rune suffix ("Stormlance of Fury", "Rotnova of Hexes").

## 16. Essence economy

Single currency. No gold exists anywhere.

**Earn:** battle victory +1 (NG+: +2). Elite +5 each. Sealed elite +1 extra. Glimmerkin caught +6. Caches: per section 19. Commissions: per section 21. Waystone rematch first-clear +25.

**Spend:** Grimoire slot 5 = 40, slot 6 = 80 (bought at any shrine). Charm craft at peddler = 25. Scroll at any shrine = 8. Wyrd rune at peddler = 30. Relic hint at peddler = 5. Waystone rematch entry = 10.

**Defeat:** drop ceil(essence / 2) at the defeat tile as a persistent marker (survives save/load). Walk onto it to recover. Only one marker exists; dying again before recovery forfeits the old drop. Boss arenas place the marker at the arena entrance.

**Waystone rematches:** a defeated boss's waystone offers REMATCH: the boss at +2 levels with 1 elite add (2 for the Wraith). Entry 10 essence. First clear: +25 essence and a feat. Repeatable for nothing but pride.

Budget sanity (playtest target, not asserted): a mainline player earns ~140 essence by the Wraith; a completionist ~320 by the Hollow Warden. Slots 5+6 plus three charms plus scroll use should require choosing, not grinding.

## 17. Element mastery

Per element: +1 per battle VICTORY in which that element dealt at least one hit (max +1 per element per battle; familiar hits count as their element). Cap 50. Persists through NG+.

| tier | threshold | grant |
|---|---|---|
| 1 | 10 | +5% power for that element's spells |
| 2 | 25 | +10% status proc, and Greedy potency (1.30+) becomes stable |
| 3 | 50 | that element's spells cost -1 MP (min 2 still applies) |

Grimoire Mastery page: five bars with tier pips. Tier-up plays mastery_tier SFX and a toast.

## 18. Surge table (unstable casts)

Triggers: every Wyrd-rune cast; any cast at potency >= 1.30 where the gating element is below mastery tier 2. The spell resolves fully FIRST, then roll d10 on the battle RNG stream:

| d10 | severity | effect |
|---|---|---|
| 1 | mild | violet afterglow on the caster (cosmetic, 2 turns) |
| 2 | mild | a crow caws somewhere wrong (log line only) |
| 3 | mild | the cast bites deeper: +2 damage (already resolved hits gain it as a rider tick) |
| 4 | mild | stolen warmth: heal 3 HP |
| 5 | mild | quick gift: refund 3 MP |
| 6 | moderate | the spell's status applies at 100% to its (surviving) target |
| 7 | moderate | echo of the echo: the spell re-casts at half power, free (no new surge roll) |
| 8 | moderate | shadows grasp: a random enemy is Withered for 1 turn |
| 9 | severe | the dark collects: caster takes 8% maxHP (cannot KO; floors at 1 HP) |
| 10 | severe | reversal: the spell's element applies its player-status to YOU (volt: drain 5 MP) |

Rules carried from the Runecast table: no surge can end a battle by itself, severity is 50/30/20, one roll per cast regardless of hits or twins, every entry thematic to wild craft.

## 19. Element gates and caches

Gate = map entity (`@egate x y element cacheId`). Interact: lists inscribed spells matching the element; casting one (normal MP cost) breaks the gate permanently (world flag). Gate copy states the element in plain text. Cache contents spawn behind it.

| map | gate (element) | cache |
|---|---|---|
| hearth | cracked shed (any damaging element) | 5 essence + a sign explaining gates |
| hearthvale | Briarfall, near the arena (ember) | relic EMBERGLASS + lore stone |
| hearthvale | Mirepool, marsh west (rime) | 12 essence + charm springstep |
| westwood | Lightless Hollow (gloom; unreachable until Lv 8, deliberate return trip) | relic STILLWATER |
| westwood | Barren Trellis (thorn) | charm longbrand |
| ashenreach | Dead Circuit (volt) | relic STORMCOIL |
| ashenreach | Scalded Spring (rime) | 15 essence + charm sigilglass |
| northhollow | Frozen Fall (ember) | charm stillmind |
| northhollow | Hungry Dark (gloom) | relic HOLLOWLIGHT |

## 20. The Peddler (Murk)

Overworld NPC, no battles. Location by progress: after Bogmaw, Hearth well. After 2 sigils, the North gate. After 3 sigils, North Hollow midway camp. Post-Wraith, the Sanctum entrance. Intro copy (final): "Murk. Purveyor of the misplaced. Essence only. Coin is a lowland superstition."

Trades: Wyrd rune (30, once), relic hint (5, names the map and direction of an unfound relic), charms (25 each, stock of 3 rotating per visit from the list below; graverobber is peddler-exclusive).

**Charms** (2 slots, swappable anywhere outside battle):

| id | label | effect |
|---|---|---|
| emberknot | Emberknot | battles start with a 10-point shield |
| springstep | Springstep | overworld regen every 4 steps instead of 6 |
| stillmind | Stillmind | Focus cleanses ALL player statuses |
| longbrand | Longbrand | enemy statuses you apply last +1 turn |
| wheelwright | Wheelwright | Wheel reaction damage portions x1.2 |
| scrollsash | Scrollsash | scroll carry cap 4 |
| sigilglass | Sigilglass | enemy weaknesses shown in battle UI |
| graverobber | Graverobber | +1 essence per battle victory |

## 21. Spell commissions

Predicate checked against INSCRIBED spells when talking to the NPC. One-time flags. Asks are listed on the Grimoire Notes page in the player's voice.

| npc (where) | ask (copy is final) | predicate | reward |
|---|---|---|---|
| Fisher (hearthvale dock, new NPC) | "My nets freeze stiff before dawn. Write me something warm that wears a shield, and I will owe you." | element ember + form veil | charm emberknot + 10 essence |
| Scout (hearth) | "Something far-striking and storm-flavored, with real ink behind it." | element volt + form lance + potency >= 1.2 | 15 essence + a relic hint |
| Dreamer (hearth) | "In the dream the dark spread everywhere at once. Make it real." | element gloom + form nova | 10 essence + Wyrd hint line |
| Keeper (hearth, post-trials) | "Two natures on one page. The old books say it cannot be done." | any twin-element spell | charm wheelwright + 15 essence |

## 22. The Call form and familiars

Unlocked at Sanctum trial 1. Casting Call (form pw 0.55, mp 1.70) summons a familiar of the spell's element. One familiar at a time; recast replaces (toast: "The old one fades.").

```
familiar hp     = 20 + 6 * playerLv (potency scales it: * p)
familiar act    = after the player each round: one typed hit at the Call
                  spell's computed power, status proc at element.proc / 2
targeting       = while alive, each enemy attack redirects to the familiar 40%
statuses        = familiars are immune to statuses; at 0 HP it fades, no penalty
persistence     = battle-scoped; never carries between battles
```

Rune interactions (UI must state them, Veil precedent): fury power x1.5. echo: strikes twice at 0.62. keen: crits 26% x1.75. hex: proc at full element.proc instead of half. thirst: 35% of familiar damage heals the player. wyrd: surge rolls once on the summon cast only. Relics apply as written. Twin Call: familiar alternates elements per round, riders apply on their element's round.

## 23. Act 4: the Sunken Sanctum

**Map:** sanctum, ~40x28, entered from a revealed stair in North Hollow's summit basin after the Wraith falls (the Hollow "drains"). Palette: drowned violet (accent #7a6bd8 family). 1 spring, 1 lore stone trio, no rune shrine. Encounters: Lv 11-12 remixes of hollowshade / galeharrow / quartzling (formations below), elite rate 15% here.

```
sanctum.halls : [hollowshade,quartzling] 2, [galeharrow,hollowshade] 2,
                [quartzling,quartzling,hollowshade] 1, [hollowshade,hollowshade] 1
```

**Trial stones (3):** fixed battles vs a Trial Guardian (hp 120 flat, atk 8/1.3, Lv 11, permanently Sealed until the named reaction hits it, then takes normal damage; xp 80). Trial of Frost demands SHATTER. Trial of Rot demands BLIGHT. Trial of Flame demands KINDLE. The stone states its demand in plain text. Trial 1 (any order; the first one cleared) grants the Call form. All three: twin inscription unlocks vale-wide (toast + Keeper commission opens).

**FINAL OPTIONAL BOSS: Hollow Warden** (Lv 13, three bars of 140 each, atk 12/1.4, no xp, no flee, drops WRAITHMARK + feat)

- **Bar 1, the Choir**: full damage only from hits that struck 2+ targets this cast (nova, Storm arcs, Wildfire spreads). Other hits x0.25.
- **Bar 2, the Wheel**: full damage only from Wheel reaction hits and their reaction portions. Other hits x0.25.
- **Bar 3, the Author**: full damage only from hits at potency >= 1.30 and scroll casts. Other hits x0.25.
- Bar transitions fully heal nothing, announce the new key in the log ("Its script shifts."), and summon 1 Hollowshade (Lv 11).
- Moves: hollow rend 1.1; unmaking sigh 0.8 + drains 6 MP; the vale forgets 1.3 + Wither player 35%. Every 4th turn telegraphs **Unwriting** (x2.2 next turn; Veil, Chill, or a bar break cancels it).
- Target: reaction-aware optimal play at Lv 12 wins 40-60% (asserted; this fight has no floor).

## 24. Scrolls, feats, bestiary, notes, spell codes

**Scrolls:** crafted at any shrine: choose any currently-craftable composition, pay 8 essence. A scroll casts that spell at fixed potency 2.5 (ignores slider cap) for 0 MP, once. Carry cap 3 (scrollsash: 4). Battle UI: SCROLL button appears when held. Scrolls are spellcraft, not loot: never dropped, never sold.

**Feats** (Grimoire page, local only): first_page (inscribe a spell), wordsmith (rename one), wheel_turns (trigger all 5 reactions), shatterstorm (3 reactions in one battle), quiet_hands (win with only Wisp casts), patient_author (win a battle untouched), greedy_ink (inscribe at 1.5), thrift (beat a Warden with no spell above potency 1.0), gatewright (open every gate), relic_road (own all 5 relics), commissioned (all 4 commissions), surge_rider (survive 5 severe surges), glimmer_catcher (catch 3 glimmerkin), elite_hunter (fell 10 elites), fourth_warden (Hollow Warden), twice_written (finish NG+).

**Bestiary** (Grimoire page): per species row fills by play: kills, weaknesses seen (only elements actually tried), statuses landed, reactions triggered on it. No pre-filled data: discovery beats optimisation.

**Notes** (Grimoire page): auto-lines for commissions heard, gates seen (map + element), peddler location, relic hints bought. One line each, player voice, no markers.

**Spell codes:** export from a spell's page: `sb1:` + base64url of `{v:1, e, e2?, f, r, p, name}`. Import via Settings: validates, names exactly which parts the player lacks (never grants them), inscribes into a chosen free slot when all parts are owned.

## 25. Vale Aspects and New Game+

**Aspects:** at every shrine or spring rest, the ascendant element rotates (seeded roll, never repeats the current one). Effect: player spells of that element get power x1.10 and proc +0.10; enemy moves that inflict that element's player-status get +0.10 rider proc and that element's DoTs tick +10%. HUD shows a small aspect glyph; toast on change ("The Vale leans toward Ember."). Battles snapshot the aspect at start.

**NG+** (offered from the ending screen, repeatable): keep grimoire, renames, mastery, charms, slots, relics, feats, bestiary. Reset: sigils, world flags, gates, caches (relics re-collectable as 15 essence), level (back to 1, the XP curve is the same). Enemies: hp and atk x1.5. Elites 25%, glimmer 6%, all battle essence x2 (victory base and elite/glimmer bonuses). Aspects also rotate on map transitions. Hollow Warden at +2 levels. Title screen shows a NG+ pip per completion.

## 26. v1.1 asset and copy addendum

New dialogue copy written in this doc is final (Elder choice page, Murk intro, the four commission asks, aspect toast, reaction log lines). Remaining v1.1 copy (gate descriptions, trial stones, sanctum lore trio, Hollow Warden telegraphs, feat names as shown) is authored in its build phase per 02 tone rules and folded back into this file when final. Elder starter-choice copy (final):

1. "Take the Grimoire. Its first page is blank, and it is asking."
2. (choice) "Ember burns answers. Rime keeps them. Thorn grows its own."
3. "Start south. Even a Gloop will test a new wisp."

Twin gossip teaching the Wheel (final, replaces twins_gossip_b in rotation after Act 1): "Burn, frost, shock, thorn, gloom. Each one cashes in the one before. Gran called it the Wheel."

**Act 4 and NG+ copy (final, folded back from Phases 14-15):**

Trial stone demands (choice page title is the trial name):
- Trial of Frost: "FROST, it reads. Chill me, then strike with storm. SHATTER me or leave."
- Trial of Rot: "ROT, it reads. Poison me, then call the gloom. BLIGHT me or leave."
- Trial of Flame: "FLAME, it reads. Wither me, then put me to the torch. KINDLE me or leave."
- Satisfied stone: "The stone is satisfied. It hums an old, settled note."

Sanctum lore trio:
1. "The Vale did not build this place. It remembered it, and the memory sank."
2. "Three trials, three answers. The Wheel turns even under water."
3. "Past this hall sits the one who writes the Vale's forgetting." / "Bring your own pen."

Sanctum stair (North Hollow summit basin): sealed: "A stair winds down into drowned dark, but the way is sealed stone." / "Something below is still holding its breath." Open: "The Hollow has drained. The stair waits, patient as ink."

Hollow Warden log lines: bar break: "Its script shifts." Unwriting telegraph: "The Warden lifts its pen. UNWRITING gathers." Cancels: veil "Your veil holds. The word dies unwritten." / chill "Too cold to write. The word dies." / bar "The broken bar spoils the page. The word dies." Aftermath (chamber): "The chamber is quiet. The script on the walls has nothing left to say."

Unlock toasts: first trial: "The CALL form is yours. Something will answer." All trials: "Twin inscription unlocked. Two natures, one page." Warden felled: "The WRAITHMARK rune is yours."

NG+ (ending screen): button "BEGIN AGAIN (NG+)", armed "THE VALE FORGETS?", toast on start "The Vale forgets. You do not." Re-opened relic cache: "+15 essence (the relic remembers you)".
