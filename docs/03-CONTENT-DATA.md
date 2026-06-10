# 03 - CONTENT DATA

Single source of truth for game numbers and content. Transcribe into `src/data/` and `content/` exactly. Where 02 and this file disagree, this file wins.

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

## 3. Runes (6)

| id | label | effect | mp | suffix |
|---|---|---|---|---|
| none | No rune | - | 1.00 | (none) |
| fury | Fury | pw x1.5 | 1.65 | of Fury |
| thirst | Thirst | heal 35% of damage dealt (on shield break for Veil) | 1.35 | of Thirst |
| echo | Echo | 2 hits at 0.62 each (Veil: re-applies once after breaking) | 1.45 | of Echoes |
| hex | Hex | +0.40 status proc (and Veil rider proc) | 1.30 | of Hexes |
| keen | Keen | crit 26% at x1.75 (no effect on Veil, UI must state this) | 1.20 | of Keening |

## 4. Spell formulas

```
cost        = max(2, round(6 * form.mp * rune.mp))
powerPerHit = 13 * form.pw * (rune.pw ?? 1) * (1 + (lv-1) * 0.22)
              * (rune.hits ? rune.pwEach : 1)        // echo
hit         = powerPerHit * elementMult * variance(0.9..1.1) * critMult?
proc        = clamp(element.proc + (rune.proc ?? 0), 0, 0.95)
veilShield  = round(14 * (rune.pw ?? 1) * (1 + (lv-1) * 0.22) * form.pw)   // form.pw = 0.90
veilRider   = proc 0.40 base (volt rider 0.25), +0.40 with hex, status applied to attacker
crit        = 8% x1.5 base; keen overrides to 26% x1.75
elementMult = weak 1.6 | resist 0.6 | neutral 1.0 (bosses may override)
```

Naming: `ELEM_PRE[element] + FORM_ROOT[form] + rune.suffix`. Prefixes: Ember, Rime, Volt, Thorn, Gloom. Roots: wisp, bolt, lance, nova, veil. Examples: Gloomnova of Hexes, Emberveil of Thirst, Voltlance of Keening.

## 5. Unlock schedule

| Trigger | Unlock |
|---|---|
| start | Ember; Wisp, Bolt; (no rune) |
| Lv 2 | Rime |
| Lv 3 | Lance |
| Lv 4 | Volt |
| Lv 5 | Nova |
| Lv 6 | Thorn |
| Lv 7 | Veil |
| Lv 8 | Gloom |
| Lv 9 | Hex |
| Shrine: Hearthvale (hidden SW) | Fury |
| Shrine: Westwood (deep NW) | Thirst |
| Shrine: Ashen Reach (far E) | Echo |
| Shrine: North Hollow (mid) | Keen |

Locked Grimoire chips show the hint text: "Reach Lv N" or "Pray at the <region> shrine."

## 6. Progression

```
xpNext(lv) = 18 + (lv-1) * 14          // cap 12
levelUp    = +8 maxHP, +4 maxMP, full restore
base       = 46 HP, 22 MP at Lv 1     // Lv 12: 134 HP, 66 MP
regen      = +1 HP and +1 MP per 6 overworld steps
encounter  = 14% per tall-grass step; grace 4 after battle, 6 after defeat
focus      = +35% maxMP, +10% maxHP, cleanse 1 player status
flee       = 65%, disabled vs bosses
```

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

**Music** (`content/audio/music/*.ogg`): title, hearth, hearthvale, westwood, ashenreach, northhollow, battle, boss, ending. Suggested CC0 source: Juhani Junkala's free chiptune music packs on OpenGameArt (verify CC0 license per file before committing; record attribution in `content/audio/CREDITS.md` regardless).

**SFX** (`content/audio/sfx/*.ogg`): select, confirm, deny, cast, hit, crit, hurt, heal, shield_up, shield_break, status_apply, encounter, victory, defeat, levelup, unlock, step_grass (optional), boss_telegraph. Suggested CC0 source: Juhani Junkala "512 Sound Effects" pack (CC0) or Kenney audio packs (CC0). Synth fallback must cover every id.

## 12. Battle sprite plan (procedural pixel grids)

Port `spriteFromGrid` + white-flash variant from the prototype. Overworld: player front/back 12x14 (existing). New overworld NPC grids: 6 villagers (12x14, palette swaps acceptable). Battle grids (16x16 to 24x24, scaled 4-6x): gloop, gloomwing, thornling, quartzling, wraith exist in the prototype; author new grids for pondscale, burrowkin, mossback, cindermote, hexbinder, ashling, galeharrow, hollowshade, bogmaw (boss-sized ~24x20), thornveil (~24x22), ashen warden (~22x22). Keep each grid's rows uniform width; a test asserts this for every registered sprite.
