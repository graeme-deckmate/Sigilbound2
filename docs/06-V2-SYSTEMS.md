# 06 - SIGILBOUND II (v2) SYSTEMS

This is the design-rationale record for the v2 fork. v1's docs 00-05 describe the
shipped v1.1 game; this file captures what v2 adds and the decisions behind it.
Where this disagrees with the older docs, this file wins for v2.

## Why v2

Sigilbound II is a standalone fork (v1 stays deployed and untouched). The owner
asked for: a more complex, less-linear world; more discoverable encounters,
towns, shops, items; enterable dungeons with a suggested level, puzzles, and a
complete-or-fail outcome; more enemies and bosses; much more customisation; and a
fix for the boss re-fight bug. v2 deliberately lifts two of v1's identity rules:
it adds a **gold economy** and **wearable gear** on top of the grimoire.

## The non-negotiable: the balance sim stays byte-identical

`tests/balanceSim.spec.ts` is the determinism contract. Every new system is
**default-off**: a player with no gear, no class, and Standard difficulty derives
byte-identical numbers, so the sim's win-rate windows are unchanged. This is
enforced by aggregating all new modifiers through one place (`deriveLoadout` ->
`StatMods`) and threading them as final `?? 1` / `?? 0` factors in the existing
spellcraft derivations, plus a `STANDARD` difficulty profile that is the numerical
identity. The full suite (incl. the sim) is green after every phase.

## Systems added

- **The fork** (Phase 0): own save key (`sigilbound2.save.v1`), PWA name, package,
  zip, wordmark, and the corrected deploy URL.
- **Re-fight bug fix** (Phase 1): the waystone rematch failed because `afterBattle`
  called `scene.restart()` from inside the one-shot `WAKE` handler. Fixed by
  deferring all post-battle rebuilds to a `pendingRebuild` flag handled on the next
  `update()` tick, and lifting rematch logic into pure tested functions.
- **Dungeons** (Phases 2-3, 8): ordinary `MapId` maps entered via `@portal` with a
  shown suggested level. Single-map puzzle state (levers/doors/keys/plates/seq) is
  scene-local, so failing (wipe or leave) ejects to the entrance keeping all gains
  and resets the puzzle for free. Objectives are boss-like fights; completion grants
  essence + gold + a rolled gear reward. Two dungeons ship: the Sunken Crypt
  (Lv 6, sluice-sequence) and the Dead Circuit Vault (Lv 8, plate-gated).
- **Economy + gear** (Phases 4, 6): gold (town currency, disjoint sinks from
  essence). Gear is a composition (base + rarity + affixes) that derives `StatMods`;
  it flows into combat via `deriveLoadout` and the extended `CastMods` seam, with
  aggregate power clamped so it can't blow the ceiling.
- **Less-linear world + shop** (Phase 5): a waystone fast-travel network (attune,
  then step between discovered waystones) so the vale is no longer hub-routed; a
  functional armorer shop; a generalized `SOFT_GATES` table.
- **More enemies + encounters** (Phase 7): +5 enemies (dungeon/marsh/boss-like),
  repeatable `@ambush` tiles, and visible `@miniboss` markers that show a suggested
  level. New species sit off the sim's critical path.
- **Difficulty** (Phase 11): story / standard / harsh / nightmare; `STANDARD` is the
  identity. Selectable in Settings.
- **Deeper spellcraft** (Phase 10): three new level-gated runes (weight / ruin /
  ward) reusing already-honored fields.
- **Character identity** (Phase 9): the armorer is the character hub - equip gear,
  pick a class (passive via `deriveLoadout`), choose a cosmetic palette.

## Deferred (clean follow-ups, noted in PROGRESS.md)

Grimoire slots 6->8; new forms (chain/glyph); build presets and `sbl2:` loadout
codes; twin rider tier; talent tree + backgrounds; run modifiers and expanded
accessibility settings; roaming visible enemies (Phase 12, optional); a richer
DOM shop/character overlay (the current UI is `openChoice`-driven and functional);
and unique-`BossSpecial` `DungeonBossId` bosses (current dungeon bosses are
beefy enemies on the regular battle path). The `deriveLoadout` / `CastMods` /
difficulty seams are built to absorb these without touching the combat core again.

## The Sundered Reaches (the new world, phases R0-R5)

A second landmass added alongside the original (which is untouched), reached from
Hearth via a Riftgate into the gateway town **Wayhold**. It is a mostly-linear
journey through four element-themed domains, each a region map with an embedded
safe town quarter, themed wilderness encounter zones, a waystone, and two bosses:

- **Cinderwaste** (Ember) - Emberjaw + the Pyrewarden; side dungeon the Emberforge.
- **Hoarfrost Hold** (Rime) - Rimehound + the Hoarwarden.
- **Stormreach** (Volt) - Galecaller + the Tempest Warden.
- **The Mire** (Thorn/Gloom finale) - Bramblemaw + the Gloamwarden.

**Pick a path, then journey:** Wayhold opens two early roads (Cinderwaste,
Hoarfrost) you may take in either order; both Wardens falling opens Stormreach,
whose Warden opens The Mire. Gating uses the existing `SOFT_GATES` table keyed on
the new `world.bosses` flags. The Gloamwarden is the Reaches finale (its own
`afterBattle` branch: feat + gold + relic-tier reward + closing line, no Ending
takeover, so free roam continues).

**8 fresh bosses, zero combat-core risk:** all eight are full `BossDef`s that
REUSE the five existing `BossSpecial` mechanics (enrage/summonAndVeil/submerge/
attune/bars), so only data + the standard add-a-boss touch-list changed - the
reducer is untouched and the original balance-sim checkpoints stay byte-identical
(the Reaches use entirely new zone ids/bosses, off the old floors). Game total is
now 13 bosses (the old 5 + the Reaches 8). New `MapTheme`s ember/frost/storm/mire
with tints; new music reuses existing tracks; the armorer/shop and waystone
network are reused per town.

Deferred (clean follow-ups): per-domain side dungeons beyond the Emberforge;
literal element-grant-on-Warden (elements still unlock by level/starter, and the
domains give power via gold/gear/essence rewards); dedicated balance-sim windows
for the eight Reaches bosses (they reuse proven, tuned mechanics).
