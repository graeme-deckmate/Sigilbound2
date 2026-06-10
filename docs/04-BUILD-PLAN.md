# 04 - BUILD PLAN

Ten phases. One phase per Claude Code session (Phase 5-7 may take two). Every phase ends green: tests pass, lint clean, game boots, PROGRESS.md updated. Do not start a phase with a red baseline.

---

## Phase 0: Scaffold
**Goal:** empty but real project.
- Vite + TS strict + Phaser, ESLint + Prettier, Vitest, vite-plugin-pwa
- Folder structure per 01, `npm run` scripts wired (dev/build/test/lint/genmaps stub)
- `core/rng.ts` (mulberry32 + tests), `core/events.ts`, GameState types
- GitHub Actions: lint + test + build on push; Pages deploy job (can be enabled later)
- Boot -> Preload -> Title scene shell renders "SIGILBOUND" and a Start button

**Accept:** `npm run dev` shows title; `test` and `lint` green; CI config present.

## Phase 1: Data + spellcraft core
**Goal:** every number in the game exists and is tested, before any gameplay.
- Transcribe 03 into `src/data/` (elements, forms, runes, unlocks, progression, statuses, enemies, formations, constants)
- `systems/spellcraft.ts`: makeSpell, cost, power, proc, veilShield, naming
- `systems/leveling.ts`: xpNext, level-up, unlock evaluation
- `core/save.ts`: save/load/migrate v1 + tests
- Tests: damage.spec (formula table from 03, exact values), naming.spec, unlocks.spec, save.spec

**Accept:** specs encode at least 12 exact formula assertions from 03 (e.g. Lv1 Emberbolt power 13 cost 6; Lv6 Voltlance of Fury power 93 vs weak). All green.

## Phase 2: Overworld
**Goal:** walkable world from ASCII maps.
- `scripts/genmaps.ts` + map format per 01/03; author `hearth` and `hearthvale` first drafts
- World scene: tile rendering (procedural, port prototype tiles), grid movement with 160ms tween, camera follow, facing interaction, dialog system, toasts, HUD
- Input abstraction: keyboard + touch d-pad/A (port prototype pointer handling)
- Encounters: zone lookup, 14% roll, grace steps, regen; encounter triggers a placeholder Battle scene that instantly returns victory
- mapConnectivity.spec runs on generated JSON

**Accept:** on a phone-sized viewport, walk Hearth and Hearthvale, talk to a sign, get an encounter trigger. Connectivity test green for both maps.

## Phase 3: Battle system
**Goal:** full combat parity with prototype, then formations.
- `systems/battle.ts` pure reducer: turn flow, damage, element mults, enemy statuses, player statuses, Focus (with cleanse), Flee, victory/defeat commits
- Battle scene: backdrop per zone, enemy sprites (white-flash, bob, dissolve), cast particles, floaters, shake, log pacing, command grid
- Multi-enemy: formations of 1-3, target selection UI for single-target forms, Nova hits all, turn order player -> enemies
- Veil: shield bar on player panel, riders, rune interactions per 03
- Defeat/respawn flow, grace steps

**Accept:** reducer has unit tests for: weakness mult, echo double-proc, stun immunity turn, chill on both sides, veil break + thirst heal, focus cleanse order. Playable fight vs [gloop,gloop] from Hearthvale grass.

## Phase 4: Grimoire + unlock flow
**Goal:** the signature feature, complete.
- Grimoire overlay scene: chip rows with lock hints, live sigil preview (port + extend for Nova/Veil/Gloom/Keen), 4 slots, inscribe flow
- Unlock toasts on level and shrine triggers; shrine interaction grants runes
- Help dialogue updated for v1.0 verbs

**Accept:** craft Gloomnova of Hexes at a debug level, see correct preview numbers matching spellcraft tests; locked chips show correct hints; keen+veil shows "no effect" note.

## Phase 5: Act 1 content
**Goal:** Hearthvale complete and winnable.
- Finalize hearth + hearthvale maps (zones, FURY shrine maze, signs, lore, spring, Bogmaw arena)
- NPCs with dialogue from 03; scripted first Gloop fight outside Hearth
- Enemies: pondscale, burrowkin sprites + data wiring; formations live
- Bogmaw boss: submerge state machine, volt counter, telegraphs
- Auto-save points wired (map transition, post-battle, shrine)

**Accept:** fresh save to Bogmaw kill in ~25 min at Lv 4 by a human; balanceSim covers Act 1 formations + Bogmaw within 02 windows.

## Phase 6: Act 2 content (two regions)
**Goal:** Westwood and Ashen Reach complete, either order.
- Both maps, zones, shrines (THIRST, ECHO), signs, lore, spring
- Enemies: gloomwing, thornling, mossback, cindermote, hexbinder, ashling
- Bosses: Thornveil (summons + bramble veil), Ashen Warden (player burn + enrage)
- Player-status UI on the HUD (icons + tooltips), Focus cleanse surfaced

**Accept:** both Wardens beatable at Lv 6-8; elder_progress and gate logic fire; balanceSim extended to Act 2; connectivity tests green for all maps so far.

## Phase 7: Act 3 + finale
**Goal:** the game can be finished.
- North Hollow map, gate opens on 3 sigils, KEEN shrine, summit spring
- Enemies: quartzling, galeharrow, hollowshade
- Vale Wraith: 3 phases, attunement, summons, Doom telegraph + counters
- Ending scene with stats, post-game free roam, elder_postgame

**Accept:** full playthrough possible; Wraith balanceSim within windows (weakness-aware >= 80% at Lv 11, <= 25% at Lv 9); defeat at any boss respawns correctly.

## Phase 8: Audio, settings, accessibility
**Goal:** it sounds and respects players.
- Music/SFX loader with synth fallback per 03 manifest; volume mixing
- Settings scene: master/sfx/music, reducedFlash, textSpeed, d-pad side + scale, manual save
- reducedFlash replaces encounter flash with fade; prefers-reduced-motion respected globally
- PWA manifest + icons, offline play verified

**Accept:** game fully playable muted, with files absent (synth), and with reducedFlash on; Lighthouse PWA installable check passes.

## Phase 9: Balance, polish, ship
**Goal:** v1.0.
- Run balanceSim across all checkpoints; tune ONLY data values (never formulas) to hit 02 windows; record changes in PROGRESS.md
- Performance pass: pools verified, no steady-state allocations, 60fps on mobile viewport throttled profile
- Copy pass on all player text (no em dashes, page lengths)
- Deploy: GitHub Pages live, itch.io zip built; README with play link

**Accept:** all tests green in CI, deployed URL plays start to finish on a phone.

## Phase 10 (stretch, post-v1.0): Capacitor Android
- Wrap dist with Capacitor, handle back button (cancel action), safe areas, audio focus
- Internal APK for Grae's Pixel; Play listing is out of scope

---

## Standing guardrails (every phase)

- Tune data, never formulas, unless a doc change is agreed first
- New player-facing text goes through the tone rules in 02
- If a phase reveals a spec conflict, implement per 03, log the conflict in PROGRESS.md "Questions for Grae", do not improvise a third design
- Keep the reference prototype untouched
