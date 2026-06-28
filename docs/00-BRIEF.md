# 00 - PROJECT BRIEF (v1.1)

Revised 2026-06-10 after v1.0 shipped and the depth proposal (docs/05) was accepted. The v1.0 brief's scope guardrails served their purpose; this revision lifts the ones that were scope calls and keeps the ones that are identity.

## One-liner

Sigilbound is a 4 to 5 hour top-down adventure where the player crafts, tunes, and names their own spells (Element x Form x Rune, with twin elements and a potency dial), explores a small vale dense with element-gated secrets, and fights instanced turn-based battles built around status-reaction combos, four story bosses, and an optional post-game superboss.

## Why v1.1

v1.0 proved the loop but solved too easily: the first two level-ups were RNG-hard (no decisions to make), everything after Lv 4 was easy (multiplicative player scaling vs linear enemies, floor-only balance assertions), and the crafting system collapsed into about six archetypes. v1.1 adds agency at the bottom, an optional ceiling at the top, and decision depth in the middle. Design rationale lives in docs/05-DEPTH-PROPOSAL.md.

## Design pillars (test every feature against these)

1. **The spell is the hero.** Player expression lives in the Grimoire. Inscription is free forever; experimentation is the game.
2. **Battles are moments, not grind.** Instanced, fast, readable. A standard fight is 30 to 90 seconds. Reactions reward a two-turn plan, never a spreadsheet.
3. **Small world, dense secrets.** Five maps plus the Sunken Sanctum. Every screen has a reason to exist, and now a reason to return (gates, caches, the peddler).
4. **Respect the session.** Mobile-first, auto-save, 10 minutes or 2 hours. Defeat stings (dropped essence) but never costs progress.
5. **Variance is content, never a coin flip.** Surges, elites, aspects, and rare encounters make runs differ. Plans (reactions, matchups) always resolve deterministically.

## Platform

Unchanged: Web, TypeScript + Vite + Phaser 3, installable PWA, GitHub Pages + itch.io. Capacitor Android remains the post-v1.1 stretch.

## Scope

### In (v1.1, on top of everything in v1.0)

- Starter element choice (Ember / Rime / Thorn) with backfilled unlocks
- The Vale's Wheel: five deterministic status reactions (setup, then detonate)
- Potency slider per inscription (cost-power dial with a visible ledger)
- Element mastery (per-element progression past the level cap)
- Unstable casts and the Wyrd rune (surge table: variance with stories)
- Twin-element inscription (10 hybrid pairs with bespoke riders), unlocked in Act 4
- Essence: the single currency. Battles, elites, caches, commissions earn it; grimoire slots 5 and 6, charms, scrolls, peddler trades, and waystone rematches spend it. Defeat drops it, recoverable.
- Elite ("aspected") enemies, sealed enemies, and rare encounter rolls
- Element gates and caches across all five maps; relic runes (one hidden per region plus one superboss drop)
- Charms (2 passive slots), scrolls (one-use overcharged spells, cap 3)
- The Peddler (wandering trader, essence only, no gold)
- Spell commissions (4 NPC asks, predicate-checked, no quest markers)
- Vale Aspects (rotating ascendant element, both sides affected)
- Act 4 post-game: the Sunken Sanctum, three reaction trials, the Summon form, the Hollow Warden superboss (3 bars, shape-keyed)
- Grimoire growth: Notes page, Bestiary, Feats, optional spell renaming, spell codes (sb1: export/import, recipe only)
- New Game+ (carry grimoire, mastery, charms, slots; enemies +50%, elites common)

### v2 (Sigilbound II) amendment

> Sigilbound II (the standalone fork) deliberately LIFTS the first two rules
> below: it adds **gold** (a town/gear currency, with sinks kept disjoint from
> essence) and **wearable gear** (which augments, never replaces, the grimoire).
> See `docs/06-V2-SYSTEMS.md`. The rest of this list still holds in v2.

### Still out (identity, not scope) - v1.1 rules

- ~~Gold or any second currency.~~ (Lifted in v2: gold is the town/gear currency.)
- ~~Equipment and gear tiers.~~ (Lifted in v2: gear augments the grimoire and is
  capped so composition still leads.) Charms remain the essence-bought exception.
- Party members as a system. The Summon familiar is the bounded exception: one temporary battlefield actor, no party UI.
- Generic consumables (potions). Scrolls are spellcraft, not items; Focus stays the designed recovery verb.
- Cast-failure chance. Overreach makes casts wild (surge), never cancelled. A lost turn to a die roll is the feel v1.1 exists to kill.
- Procedural map generation. Hand-authored density is the product.
- Multiplayer, accounts, servers, leaderboards. Spell codes are async strings, nothing more.

### Stretch (post-v1.1, in priority order)

1. Capacitor Android build
2. Gamepad support
3. Boss-rush mode stitched from waystone rematches

## Success criteria for v1.1

- A new player on a phone finishes the main story in 3 to 4 hours and Act 4 in 4 to 5, without instructions beyond in-game help
- Lv 1-2 win rates for a baseline player are within 10 points of Lv 3-4 win rates (the RNG cliff is gone, asserted by sim)
- An optimal player at Lv 12 beats the Hollow Warden 40 to 60% of attempts (the ceiling exists, asserted by sim)
- At least 3 of 5 starter/mastery/twin combinations see use in playtests (build diversity is real, checked by telemetry)
- All automated tests pass in CI; 60fps on a mid-range phone
- Grae replays it by choice

## Honest risks

- **Twin elements are the big balance risk.** Ten bespoke riders multiplied by runes and potency is a wide surface. Mitigation: they unlock in Act 4 where the sim floors do not apply, and tuning happens on pair riders, never on a player's inscribed spell.
- **The economy can rot the pacing.** If essence is too generous the sinks trivialize; too stingy and slots 5-6 feel mandatory-grindy. Budget table in 03 section 16; playtest before locking.
- **Reaction-aware sim policies are real work.** The balance sim must learn two-turn plans or the new assertions are noise.
- **Content is still the long pole.** Act 4, gates, and dialogue will take longer than the systems. Same lesson as v1.0 Phases 5-7.
