# 02 - GAME DESIGN (v1.1)

The prototype (`reference/sigilbound.html`) is canon for feel. This doc defines v1.1 mechanics (v1.0 plus the accepted depth expansion, rationale in docs/05). Exact numbers live in `03-CONTENT-DATA.md`; if the two ever disagree, 03 wins.

## Core loop

Explore -> tall-grass encounter -> instanced battle -> XP + essence -> unlock and buy spell parts -> craft, tune, and name in the Grimoire -> open element gates, push deeper -> shrine or boss -> repeat. Three Wardens gate the finale; the finale gates the Sunken Sanctum.

## Spellcraft

A spell = **Element x Form x Rune x Potency**, inscribed into one of up to 6 slots (4 base, slots 5 and 6 bought with essence). Names are generated, ElementPrefix + FormRoot + RuneSuffix ("Rimelance of Thirst"), and the player may rename a spell at inscribe time (generated name becomes the subtitle).

- **Element** sets color, status effect, Wheel reaction role, and matchup vs enemy weaknesses
- **Form** sets the damage/cost profile and targeting (Wisp/Bolt/Lance single target, Nova hits all enemies, Veil is a self shield, Call summons a familiar, Act 4)
- **Rune** twists behavior (power, lifesteal, double-cast, status chance, crit, wyrd surge, plus hidden Relic runes that each bend one formula rule)
- **Potency** is a slider, x0.7 to x1.5 power with a matching cost curve, locked at inscribe. Greedy settings (1.3+) are unstable until element mastery tier 2: the cast still fires but takes a surge roll.

**Twin elements (Act 4 unlock):** a spell may carry two elements for a x1.6 MP surcharge. Both statuses proc at half chance, the matchup peak thins (best multiplier capped at 1.3), and each of the 10 pairs adds one bespoke rider (03 section 15). Twin names use the pair prefix ("Stormlance of Fury").

**Element mastery:** each element gains +1 mastery per battle won in which it dealt at least one hit (max +1 per element per battle). Tier thresholds grant small power, proc, and cost bonuses, and tier 2 stabilizes Greedy potency. Mastery persists through NG+. Numbers in 03 section 17.

Derived stats (formulas in 03): power, MP cost, status proc chance, and the full cost ledger; the Grimoire preview shows every term live (the cost is a conversation, never a surprise). The animated sigil stays.

Unlocks: the player picks a starter element (Ember, Rime, or Thorn) from the Elder; the unpicked two backfill at Lv 2 and Lv 6. Volt and Gloom stay level-gated. Runes come from shrines, the peddler, and hidden caches. Twin inscription and Call come from the Sunken Sanctum. Full schedule in 03.

## Battle rules (turn-based, instanced)

### Structure
- Formations of 1 to 3 enemies. Player always acts first, then enemies left to right.
- Player turn: cast a spell (pick target if single-target form), Focus, or Flee.
- Battles are launched from encounters (tall grass), boss interactables, or scripted moments. Never in the overworld.

### Player actions
- **Cast**: pay MP, resolve per spell rules below.
- **Focus**: restore 35% max MP and 10% max HP, and cleanse one player status (oldest first). Always available.
- **Scroll**: cast a held scroll (one-use, 0 MP, overcharged). Button appears only when scrolls are held.
- **Flee**: 65% success, fail wastes the turn. Disabled in boss battles.

### Damage resolution (per hit)
```
raw   = 13 * form.pw * (rune.pw ?? 1) * (1 + (playerLv-1) * 0.22)
hit   = raw * elementMult * variance(0.9..1.1) * (crit ? critMult : 1)
```
- elementMult: weak 1.6, resist 0.6, neutral 1.0 (bosses override, see below)
- crit: base 8% at x1.5. Keen rune: 26% at x1.75.
- Echo rune: 2 hits, each at 0.62 power. Status proc rolls per hit.
- Show "It is devastating!" / "...resisted." exactly as the prototype does. Teaching through feedback, not menus.

### Statuses ON ENEMIES (from player elements)
| Status | Element | Effect | Duration |
|---|---|---|---|
| Burning | Ember | DoT at start of its turn | 3 |
| Chilled | Rime | Its damage dealt x0.65 | 2 |
| Stunned | Volt | Skips its turn | 1 |
| Envenomed | Thorn | Stronger DoT | 3 |
| Withered | Gloom | Takes +25% damage from all sources | 2 |

Reapplication refreshes duration. A target cannot be Stunned on consecutive turns (after a stun expires it is immune to stun for 1 turn). DoT values in 03.

### The Vale's Wheel (status reactions, new in v1.1)

One sentence: **each element cashes in the status before it**, in unlock order Ember -> Rime -> Volt -> Thorn -> Gloom -> Ember.

When a player hit of element E strikes an enemy bearing the status of the element before E on the wheel, the reaction fires: deterministic (no roll), announced in the log ("The frost SHATTERS!"), and it **consumes the setup status**. The five reactions (exact values in 03 section 14): Scald (Burning + Rime hit), Shatter (Chilled + Volt hit), Snare (Stunned + Thorn hit), Blight (Envenomed + Gloom hit), Kindle (Withered + Ember hit). The choice is real: keep the status's passive value or detonate it. Echo's two hits resolve in order, so hit 1 can react and hit 2 can re-apply. Bosses react like anything else. Taught by a Twin gossip line and the log, not a menu.

### Surges (unstable casts, new in v1.1)

Casting beyond your means never fizzles; it goes wild. A surge roll (table in 03 section 18) rides on: any Wyrd-rune cast, and any Greedy-potency cast (1.3+) below mastery tier 2. Distribution 50% mild, 30% board-changing, 20% backfire. The spell always resolves first. No surge can end a battle by itself.

### Vale Aspects (new in v1.1)

At any shrine or spring rest, the vale's ascendant element rotates (seeded). The ascendant element gets +10% power and +10% status proc **for both sides**. Announced by toast and the Scout; shown as a small HUD glyph. One global modifier, never stacked.

### Statuses ON PLAYER (new in v1.0, inflicted by some enemy moves)
Burning (DoT 5% maxhp), Chilled (spell power x0.7), Envenomed (DoT 7% maxhp), Withered (+25% damage taken). No player stun. Focus cleanses one. Statuses clear when battle ends.

### Veil form (new defensive verb)
Casting a Veil spell grants a shield that absorbs damage before HP. Shield amount scales like a spell (03). The element adds a rider when an enemy strikes the shield (chance to Burn/Chill/Stun/Envenom/Wither the attacker). Rune interactions: Fury bigger shield, Echo re-applies once after breaking, Thirst heals 35% of absorbed when it breaks, Hex boosts the rider proc, Keen has no effect (UI must say so). Only one Veil active; recasting replaces it.

### Enemy turns
Each enemy: resolve its DoTs, skip if Stunned, else pick a move by weight, deal `(a0 + al*lv) * move.mult * variance`, apply Chill x0.65 if Chilled, apply move riders (player status, MP drain). Telegraphed moves (bosses) announce one turn ahead.

### The familiar (Call form, Act 4)

Casting a Call spell summons an elemental familiar: a battlefield actor with its own HP that acts after the player each round (a typed hit with a halved status proc) and draws a share of enemy attacks. One familiar at a time; recasting replaces it. Rune interactions mirror Veil's pattern (03 section 22). Familiars and Veils coexist.

### Victory / defeat
- Victory: XP per enemy (03), essence per battle (03 section 16), then level-ups (full restore, +8 maxHP, +4 maxMP, unlock toasts), mastery ticks (+1 per element that landed a hit), iris back, 4 grace steps.
- Defeat: respawn at last used shrine/spring, full restore, 6 grace steps. Half the player's essence (round up) drops at the defeat tile as a recoverable marker that persists in the save; dying again before recovery forfeits the older drop. Track `stats.defeats`.

## Encounters

- Tall grass: 14% per step after grace expires. Grace: 4 steps post-battle, 6 post-defeat.
- Zones are rectangles in map metadata pointing at formation tables (03). Formation pick is weighted.
- **Elites (after Bogmaw falls):** 10% of rolled formations promote one member to an aspected elite: name prefix, one affix (Veiled, Frenzied, Mirrorhide, Fleet, Sealed), double XP, bonus essence. Affix table in 03 section 13. Sealed enemies take no damage until the seal breaks: any Wheel reaction, or the stated anti-element (the log names the key).
- **Rare rolls:** 4% of encounters are special: an ambush (enemies act first in round 1), a glimmer (a fleeing bonus creature, big XP and essence if caught in 2 rounds), or an elite pack (every member promoted). Table in 03 section 13.
- Out-of-battle regen: +1 HP and +1 MP every 6 steps. Shrines and springs fully restore (and rotate the Vale Aspect).
- **Overworld casting exists only at element gates:** interacting with a gate lists matching inscribed spells; casting one (normal MP cost) opens it. No free-aim overworld casting.

## World and story

### Shape
```
            North Hollow (Act 3, gated) -- Sunken Sanctum (Act 4, post-Wraith)
                  |
Westwood -- HEARTH (hub) -- Ashen Reach
   (Act 2a)       |              (Act 2b)
             Hearthvale (Act 1)
```
Six maps. Hearth is safe (no encounters). Westwood and Ashen Reach can be done in either order. North Hollow's gate opens when all three Grand Sigils are held. The Sunken Sanctum opens off North Hollow after the Wraith falls.

### Element gates and caches (new in v1.1)

Every map except Hearth carries 2 to 3 element gates: plain-stated obstacles keyed to a spell *shape*, never a specific spell ("A strong flame would clear these briars."). Any inscribed spell of the named element opens it. Behind each: a cache (relic rune, charm, essence, lore, or a commission NPC). Placement table in 03 section 19. Gates make utility crafting matter and give every region a return trip.

### The Peddler (new in v1.1)

Murk, a wandering trader, moves between maps as sigils are won (schedule in 03 section 20). Trades in essence only: charms, scroll reagent bundles, the Wyrd rune, relic hints. He barters; he is not a shop economy. No gold exists.

### Spell commissions (new in v1.1)

Four NPCs each want a spell by composition ("Write me something warm that wears a shield."). Talking to them with a matching spell inscribed completes the ask (predicate table in 03 section 21). Rewards: charms, essence, hints, a feat. No quest markers; the Grimoire Notes page lists asks heard in the player's own words.

### Story beats (kept light, told through NPCs, signposts, and lore stones)
1. **Intro**: the Vale Wraith has bound the three Wardens with corrupted sigils. The Elder gives you the Grimoire and asks what the first page answers to: **Ember, Rime, or Thorn** (starter choice; the unpicked two backfill at Lv 2 and Lv 6).
2. **Act 1, Hearthvale**: learn the loop, defeat **Bogmaw** (corrupted Marsh Warden), receive Grand Sigil 1.
3. **Act 2, either order**: Westwood's **Thornveil Warden** and Ashen Reach's **Ashen Warden**. Grand Sigils 2 and 3.
4. **Gate**: Elder dialogue acknowledges progress, the North Hollow seal breaks.
5. **Act 3**: climb North Hollow, face the **Vale Wraith** (three phases).
6. **Ending**: stats screen (level, battles, spells inscribed, most-cast spell by its given name, steps, defeats), then free roam.
7. **Act 4, post-game**: the Hollow drains; the **Sunken Sanctum** opens (the lore stones already named the fourth Warden). Three trial stones, each demanding a Wheel reaction; the first grants the **Call** form, all three unlock **twin inscription**. At the bottom: the **Hollow Warden** superboss. NG+ offered from the ending screen.

### Bosses (full stats in 03)
- **Bogmaw** (target Lv4): every 3rd turn it Submerges (untargetable, next hit x1.5). While submerged it is weak ONLY to Volt at x2.0 (water conducts); a Volt hit cancels the empowered attack and Stuns it. Teaches: react to states.
- **Thornveil Warden** (target Lv6-7): summons 2 Thornlings at 60% HP, casts its own Bramble Veil (shield 30). Teaches: target priority and shield breaking, and shows the player what Veil does before they unlock it at Lv7.
- **Ashen Warden** (target Lv8-9): inflicts Burning on the player, enrages below 30% HP (+40% damage). Teaches: Focus cleansing and race-vs-sustain decisions.
- **Vale Wraith** (target Lv11): Phase 1 attunes to an element every 2 turns (weak x1.8 to it, x0.85 otherwise). Phase 2 at 50%: summons 2 Hollowshades, attunement shifts every turn. Phase 3 at 20%: telegraphs **Doom of the Vale** (huge hit next turn; survive via Veil, Chill, burst kill, or eating it with high HP). No fleeing.
- **Hollow Warden** (Act 4 superboss, target Lv12, optional): three HP bars, each keyed to a spell shape: bar 1 takes full damage only from multi-target hits (novas, twin Storm arcs), bar 2 only from Wheel reactions, bar 3 only from Greedy-potency hits and scrolls. Off-key hits deal 25%. The lesson is Glyphwright's: a diverse grimoire beats a min-maxed spell. Stats and moves in 03 section 23. No sim floor protects this fight; target 40-60% for optimal play at Lv 12.
- **Waystone rematches**: a defeated boss's waystone offers a rematch at +2 levels with elite adds, entry paid in essence, first-clear reward (03 section 16).

## Balancing targets (the balance sim asserts these)

| Checkpoint | Player level | Real time | Standard fight length |
|---|---|---|---|
| Bogmaw down | 4 | ~30 min | 2-4 player turns |
| Both Act 2 Wardens down | 7-8 | ~100 min | 3-5 player turns |
| Vale Wraith down | 10-12 | 3-4 hrs | boss: 8-14 player turns |
| Hollow Warden down (optional) | 12 | 4-5 hrs | superboss: 10-18 player turns |

Simulation rules (`tests/balanceSim.spec.ts`): scripted "sensible player" policies fight each formation and boss at the target level across 200 seeded runs. Policies: always-bolt baseline, weakness-aware, defensive, and (new) **reaction-aware**, which executes two-turn Wheel plans and uses potency. Assert: win rates (baseline >= 70% on standard packs at level, weakness-aware >= 95%), turn counts within the windows above, no formation where the baseline policy win rate is under 40% at target level. Boss fights: weakness-aware policy wins >= 80% at target level, <= 25% two levels under.

New v1.1 assertions:
- **The RNG cliff is gone**: baseline win rate at Lv 1-2 (each starter element) within 10 points of its Lv 3-4 rate on Act 1 packs.
- **Reactions pay**: reaction-aware beats weakness-aware on median turn count for Act 2+ packs.
- **The ceiling exists**: reaction-aware at Lv 12 vs the Hollow Warden lands in 40-60%. Ceiling assertions apply ONLY to optional content (Sanctum, rematches, NG+); the critical path keeps floors only.
- **Starters are fair**: Bogmaw-down win rates per starter element within 8 points of each other.

## UX requirements

- Mobile-first: d-pad + A button (port prototype), all battle/Grimoire actions tappable, hit targets >= 44px (including the potency slider handle; it carries snap detents at 0.7 / 1.0 / 1.5)
- Battle log line paced by textSpeed setting; damage numbers, screen shake, hurt flash, element-colored FX per prototype; reaction lines get their own color and SFX
- Grimoire: chip rows (Element/Form/Rune), locked chips show their unlock hint, live sigil preview, potency slider with full cost ledger, rename field, up to 6 slots, works only outside battle
- Grimoire pages (tabs): Spells, **Notes** (commissions heard, gates seen, one line each, player voice), **Bestiary** (per species: kills, weaknesses seen, statuses landed, reactions used; fills by play), **Feats** (03 section 24), **Mastery** (five element bars)
- Spell codes: export any inscribed spell as an `sb1:` string from its page; import via Settings. Recipe only: missing unlocks are named, never granted (no binary gates: the import screen says exactly what is missing)
- Help available from World, updated for v1.1 verbs (reactions, potency, scrolls, gates, essence)
- First 3 minutes must teach: move, interact, encounter, cast, craft, plus the starter choice. Done via Elder dialogue + one guaranteed scripted Gloop fight just outside Hearth.
- The Wheel is taught by one Twin gossip line, one sign, and the reaction log lines. Never a tutorial popup.

## Tone and writing

Terse, warm, a little wry. The Vale is melancholy but never grim. Signposts gossip. No walls of text: 1 to 3 lines per dialogue page. No em dashes anywhere in player-facing text.
