# 04 - BUILD PLAN (v1.1)

Phases 0-9 shipped v1.0. Phases 11-15 are the accepted v1.1 expansion (docs/05). One phase per Claude Code session (11, 13, 14 may take two). Every phase ends green: tests pass, lint clean, game boots, PROGRESS.md updated. Do not start a phase with a red baseline. Phase 10 (Capacitor) moves to post-v1.1 stretch.

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

## Phase 11: Curve, variance, economy foundations
**Goal:** the difficulty cliff is gone and essence exists.
- Starter element choice (Elder dialogue + unlock backfill per 03 section 5); save migration v2 (starter, essence, mastery, charms fields)
- Early smoothing: MP 26 base, XP curve reshape, Lv 1 meadow single-enemy rule (03 section 6)
- Elites + rare rolls (03 section 13); elite tint rule; promoted-enemy battle rows
- Essence: earn/spend/defeat-drop (03 section 16); slots 5-6 purchase at shrines; Grimoire 6-slot UI
- Potency slider with full cost ledger in the Grimoire; rename field (2G)
- Notes page scaffold (empty until 13 fills it)
- Sim: starter-fairness, RNG-cliff, and elite assertions added; all v1.0 windows re-pass

**Accept:** new save asks the starter and plays Act 1 smoothly with each pick; sim asserts Lv 1-2 baseline within 10 points of Lv 3-4 per starter; an elite appears post-Bogmaw and pays +5 essence; slot 5 purchasable at 40 essence; potency 1.5 spell shows correct cost (exact-value tests per 03 section 4).

## Phase 12: The Vale's Wheel
**Goal:** two-turn plans exist.
- Reaction engine in the battle reducer (03 section 14), log lines, reaction SFX + color
- Mastery (03 section 17): per-battle ticks, tiers, Grimoire Mastery page
- Surges (03 section 18) + Wyrd rune wiring (peddler comes in 13; DEV grant for testing)
- Unstable Greedy gating (mastery tier 2)
- Vale Aspects (03 section 25): rotation, HUD glyph, battle snapshot
- Teaching copy: twin gossip line, one new sign
- Sim: reaction-aware policy; "reactions pay" assertion

**Accept:** reducer tests for all 5 reactions (consume + exception via dev-granted stormcoil), echo react-then-reapply, twin gossip teaches it in-game; surge table rolls verified deterministic per seed; reaction-aware beats weakness-aware on Act 2 median turns.

## Phase 13: The discovery layer
**Goal:** the vale rewards going back.
- Element gates + caches (03 section 19), @egate map directive + validator rules (gated caches exempt from initial flood-fill like boss gates)
- Relic runes (4 cache relics; wraithmark in 14)
- Charms (03 section 20): 2 slots, effects, swap UI
- Peddler Murk: location schedule, trades, intro copy
- Scrolls (03 section 24): shrine crafting, battle SCROLL button, cap logic
- Commissions (03 section 21): predicates, rewards, Notes lines
- Waystone rematches (03 section 16)
- Feats + Bestiary pages (03 section 24); spell codes export/import

**Accept:** every gate opens with any matching spell and pays its cache exactly once; all 8 charms function (unit tests); a scroll casts at potency 2.5 for 0 MP; each commission completes on its predicate; rematch entry/reward flows; sb1 codes round-trip and name missing parts; connectivity tests green with gates.

## Phase 14: Act 4, twins, summons
**Goal:** the optional ceiling.
- Sanctum map + formations + palette + music id (03 section 23); North Hollow stair reveal post-Wraith
- Trial stones: sealed guardians keyed to Shatter/Blight/Kindle; trial 1 grants Call, all three unlock twins
- Call form + familiars (03 section 22) with rune interactions
- Twin inscription (03 section 15): Grimoire pair UI, twin cost/matchup/proc rules, 10 riders
- Hollow Warden: 3 shape-keyed bars, Unwriting telegraph, wraithmark drop
- Keeper commission opens post-trials
- Sim: Hollow Warden ceiling assertion (reaction-aware 40-60% at Lv 12, no floor)

**Accept:** full Act 4 playable post-Wraith; each trial demands and verifies its reaction; familiar acts/redirects/fades per spec with rune tests; all 10 twin riders unit-tested; Hollow Warden sim lands in window; wraithmark extends potency to 1.8 stable.

## Phase 15: NG+, polish, re-ship
**Goal:** v1.1 ships.
- NG+ (03 section 25): ending-screen offer, carry/reset rules, scaling, title pip
- Balance pass across ALL checkpoints (old windows + new assertions); tune data only; log in PROGRESS
- Copy pass (no em dashes, page lengths); fold finalized in-phase copy back into 03 section 26
- Perf pass (new overlays pooled, slider at 60fps); save migration tested v1 -> v2
- Deploy: Pages + itch.io zip refresh; README updated

**Accept:** NG+ run reaches Act 2 in browser test with carried grimoire; all tests green in CI; v1.0 saves migrate cleanly; deployed URL plays start to NG+ start on a phone.

## Phase 16 (stretch, post-v1.1): Capacitor Android
- Wrap dist with Capacitor, handle back button (cancel action), safe areas, audio focus
- Internal APK for Grae's Pixel; Play listing is out of scope

---

## Standing guardrails (every phase)

- Tune data, never formulas, unless a doc change is agreed first
- New player-facing text goes through the tone rules in 02
- If a phase reveals a spec conflict, implement per 03, log the conflict in PROGRESS.md "Questions for Grae", do not improvise a third design
- Keep the reference prototype untouched
