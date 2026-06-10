# 02 - GAME DESIGN

The prototype (`reference/sigilbound.html`) is canon for feel. This doc defines v1.0 mechanics. Exact numbers live in `03-CONTENT-DATA.md`; if the two ever disagree, 03 wins.

## Core loop

Explore -> tall-grass encounter -> instanced battle -> XP -> unlock spell parts -> craft in Grimoire -> push deeper -> shrine or boss -> repeat. Three Wardens gate the finale.

## Spellcraft

A spell = **Element x Form x Rune**, inscribed into one of 4 slots. Names are generated: ElementPrefix + FormRoot + RuneSuffix ("Rimelance of Thirst").

- **Element** sets color, status effect, and matchup vs enemy weaknesses
- **Form** sets the damage/cost profile and targeting (Wisp/Bolt/Lance single target, Nova hits all enemies, Veil is a self shield)
- **Rune** twists behavior (power, lifesteal, double-cast, status chance, crit)

Derived stats (formulas in 03): power, MP cost, status proc chance. The Grimoire shows a live preview with the animated sigil (signature element from the prototype, keep it).

Unlocks: elements and forms come from levels, runes come from shrines (plus Hex at Lv9). Full schedule in 03.

## Battle rules (turn-based, instanced)

### Structure
- Formations of 1 to 3 enemies. Player always acts first, then enemies left to right.
- Player turn: cast a spell (pick target if single-target form), Focus, or Flee.
- Battles are launched from encounters (tall grass), boss interactables, or scripted moments. Never in the overworld.

### Player actions
- **Cast**: pay MP, resolve per spell rules below.
- **Focus**: restore 35% max MP and 10% max HP, and cleanse one player status (oldest first). Always available.
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

### Statuses ON PLAYER (new in v1.0, inflicted by some enemy moves)
Burning (DoT 5% maxhp), Chilled (spell power x0.7), Envenomed (DoT 7% maxhp), Withered (+25% damage taken). No player stun. Focus cleanses one. Statuses clear when battle ends.

### Veil form (new defensive verb)
Casting a Veil spell grants a shield that absorbs damage before HP. Shield amount scales like a spell (03). The element adds a rider when an enemy strikes the shield (chance to Burn/Chill/Stun/Envenom/Wither the attacker). Rune interactions: Fury bigger shield, Echo re-applies once after breaking, Thirst heals 35% of absorbed when it breaks, Hex boosts the rider proc, Keen has no effect (UI must say so). Only one Veil active; recasting replaces it.

### Enemy turns
Each enemy: resolve its DoTs, skip if Stunned, else pick a move by weight, deal `(a0 + al*lv) * move.mult * variance`, apply Chill x0.65 if Chilled, apply move riders (player status, MP drain). Telegraphed moves (bosses) announce one turn ahead.

### Victory / defeat
- Victory: XP per enemy (03), then level-ups (full restore, +8 maxHP, +4 maxMP, unlock toasts), iris back, 4 grace steps.
- Defeat: no penalty. Respawn at last used shrine/spring, full restore, 6 grace steps. Track `stats.defeats`.

## Encounters

- Tall grass: 14% per step after grace expires. Grace: 4 steps post-battle, 6 post-defeat.
- Zones are rectangles in map metadata pointing at formation tables (03). Formation pick is weighted.
- Out-of-battle regen: +1 HP and +1 MP every 6 steps. Shrines and springs fully restore.

## World and story

### Shape
```
            North Hollow (Act 3, gated)
                  |
Westwood -- HEARTH (hub) -- Ashen Reach
   (Act 2a)       |              (Act 2b)
             Hearthvale (Act 1)
```
Five maps. Hearth is safe (no encounters). Westwood and Ashen Reach can be done in either order. North Hollow's gate opens when all three Grand Sigils are held.

### Story beats (kept light, told through 8 NPCs, signposts, and lore stones)
1. **Intro**: the Vale Wraith has bound the three Wardens with corrupted sigils. The Elder gives you the Grimoire.
2. **Act 1, Hearthvale**: learn the loop, defeat **Bogmaw** (corrupted Marsh Warden), receive Grand Sigil 1.
3. **Act 2, either order**: Westwood's **Thornveil Warden** and Ashen Reach's **Ashen Warden**. Grand Sigils 2 and 3.
4. **Gate**: Elder dialogue acknowledges progress, the North Hollow seal breaks.
5. **Act 3**: climb North Hollow, face the **Vale Wraith** (three phases).
6. **Ending**: stats screen (level, battles, spells inscribed, steps, defeats), then free roam with post-game NPC lines.

### Bosses (full stats in 03)
- **Bogmaw** (target Lv4): every 3rd turn it Submerges (untargetable, next hit x1.5). While submerged it is weak ONLY to Volt at x2.0 (water conducts); a Volt hit cancels the empowered attack and Stuns it. Teaches: react to states.
- **Thornveil Warden** (target Lv6-7): summons 2 Thornlings at 60% HP, casts its own Bramble Veil (shield 30). Teaches: target priority and shield breaking, and shows the player what Veil does before they unlock it at Lv7.
- **Ashen Warden** (target Lv8-9): inflicts Burning on the player, enrages below 30% HP (+40% damage). Teaches: Focus cleansing and race-vs-sustain decisions.
- **Vale Wraith** (target Lv11): Phase 1 attunes to an element every 2 turns (weak x1.8 to it, x0.85 otherwise). Phase 2 at 50%: summons 2 Hollowshades, attunement shifts every turn. Phase 3 at 20%: telegraphs **Doom of the Vale** (huge hit next turn; survive via Veil, Chill, burst kill, or eating it with high HP). No fleeing.

## Balancing targets (the balance sim asserts these)

| Checkpoint | Player level | Real time | Standard fight length |
|---|---|---|---|
| Bogmaw down | 4 | ~25 min | 2-4 player turns |
| Both Act 2 Wardens down | 7-8 | ~90 min | 3-5 player turns |
| Vale Wraith down | 10-12 | 2-3 hrs | boss: 8-14 player turns |

Simulation rules (`tests/balanceSim.spec.ts`): scripted "sensible player" policies (always-bolt baseline, weakness-aware, defensive) fight each formation and boss at the target level across 200 seeded runs. Assert: win rates (baseline >= 70% on standard packs at level, weakness-aware >= 95%), turn counts within the windows above, no formation where the baseline policy win rate is under 40% at target level. Boss fights: weakness-aware policy wins >= 80% at target level, <= 25% two levels under.

## UX requirements

- Mobile-first: d-pad + A button (port prototype), all battle/Grimoire actions tappable, hit targets >= 44px
- Battle log line paced by textSpeed setting; damage numbers, screen shake, hurt flash, element-colored FX per prototype
- Grimoire: chip rows (Element/Form/Rune), locked chips show their unlock hint, live sigil preview, 4 slot inscribe, works only outside battle
- Help available from World (the "How to play" dialogue, updated for v1.0 verbs)
- First 3 minutes must teach: move, interact, encounter, cast, craft. Done via Elder dialogue + one guaranteed scripted Gloop fight just outside Hearth.

## Tone and writing

Terse, warm, a little wry. The Vale is melancholy but never grim. Signposts gossip. No walls of text: 1 to 3 lines per dialogue page. No em dashes anywhere in player-facing text.
