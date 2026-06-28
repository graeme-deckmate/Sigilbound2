# PROGRESS

Claude Code: read this first every session. Update it before you stop. Keep entries short.

## Status

Current phase: **SIGILBOUND II (v2) fork. Phase 0 (fork bring-up) in progress.** v1.1 was COMPLETE (Phases 0-15) in the original Sigilbound repo; this is the standalone v2 fork.
Last session: 2026-06-28 (v2 Phase 0: forked repo, renamed identifiers, fixed deploy URL typo)
Deployed URL: https://graeme-deckmate.github.io/Sigilbound2/ (Pages, deploys on every push to main)

## Sigilbound II (v2) plan

The full v2 implementation plan (fork, re-fight bug fix, less-linear world,
dungeons, more enemies/bosses, gold + gear, character identity, deeper
spellcraft, difficulty) is tracked phase by phase below under "v2 phases".
Design rationale: see `docs/06-V2-SYSTEMS.md` (added in the final v2 phase).

Deferred within Phase 0 (done deliberately when the relevant feature lands, to
keep each version bump tied to a real shape change with a migration test):
- `GameState.version` 2 -> 3: bumped in v2 Phase 2 when `world.dungeon` (the first
  new field) lands.
- Spell-code prefix `sb1:` -> `sb2:`: bumped in v2 Phase 10 when `CodePayload`
  gains new element/form/rune ids (the format is identical until then).

### v2 phases
- [x] Phase 0: Fork bring-up (new save key `sigilbound2.save.v1`, PWA name
  `Sigilbound II`, workbox cache `sb2-audio`, package `sigilbound2`, zip
  `sigilbound2-itch.zip`, wordmark/title, dev launch name, deploy URL typo fixed).
- [x] Phase 1: Re-fight bug fix. Root cause was Phaser re-entrancy: afterBattle
  called scene.restart() from inside the once(WAKE) handler, and on the second
  rematch the restart->sleep->wake cycle could drop the next WAKE (scene left
  asleep). Fix: defer all post-battle rebuilds to a `pendingRebuild` flag handled
  at the top of update(); lifted rematch entry/reward into pure tested functions
  in worldstate.ts (canAffordRematch/applyRematchEntry/applyRematchReward); reset
  transient handoff fields in create(). Regression: tests/rematch.spec.ts.
- [x] Phase 2: Map-type plumbing and theming. Added MapTheme + 9 dungeon entity
  types to mapdefs.ts; CompiledMap gains `theme` + portals/levers/doors/chests/
  objectives/minibosses/waystones/plates/ambushes (parsed + emitted, behavior
  inert until W2). maplib.ts parses @theme/@portal/@lever/@door/@plate/@chest/
  @objective/@miniboss/@waystone/@ambush (with species/zone validation); maps
  regenerated. Added `world.dungeon` slab; bumped GameState.version 2->3 with
  migrate handling (pre-v3 -> dungeon:null; v3 round-trips). Tests: maplib.spec.ts
  + save dungeon migration. NOTE: theme is carried as data now; the visual tile/
  backdrop variation is applied in Phase 3 where the first themed (dungeon) map
  appears.
- [x] Phase 3: Dungeon core. Dungeons are ordinary maps entered via @portal
  (shows suggested level). New src/data/dungeons.ts (registry + objectives) and
  src/systems/dungeon.ts (pure: doorOpen predicate lever/key/plate/seq, plus
  dungeonEnter/Eject/Complete). EntityAt/entities()/interactionFor extended for
  portal/lever/door/chest/objective/miniboss/waystone; doors treated as passable
  in reachability validation. World.ts wires scene-local puzzle state (resets per
  build => fail resets free), in-place door opening, plate step-on, objective
  battle -> dungeonComplete + reward, defeat -> dungeonEject keeping gains, and a
  translucent theme wash for cave/ash/hollow. Built the Sunken Crypt (Lv 6, seq
  sluice puzzle) reachable from Hearthvale marsh; added sunkencrypt.flooded zone +
  backdrop; dialogue.ts now bundles sunkencrypt.json. Tests: tests/dungeons.spec.ts.
  NOTE: miniboss/waystone entity kinds parse + route but their interactions land
  in Phase 7 (miniboss) and Phase 5 (waystone). In-browser dungeon smoke deferred
  to the Phase 13 consolidated pass; build+tests+lint are the per-phase gate.
- [x] Phase 4: Economy foundation. Added gold (town currency, distinct from
  essence) + Equipment + Inventory to GameState (defaults + tolerant migrate;
  malformed gear dropped, equipped-but-unowned slots cleared). New core/items.ts
  (StatMods/GearItem/Equipment/Inventory), data/gear.ts + data/affixes.ts, pure
  systems/gear.ts (sumMods, deterministic rollGear, gearMods, itemValue/Label)
  and systems/shop.ts (buy/sell/equip/unequip/grant). Tests: gear.spec, shop.spec,
  save round-trip. RE-SCOPE: the shop UI + NPC placement moved to Phase 5 (towns),
  where it belongs; gear stat effects flow into combat in Phase 6. Version stays 3
  (tolerant migrate fills new fields), no churny bump.
- [ ] Phase 5: Less-linear overworld + towns + fast travel (lateral exits, waystone network).
- [x] Phase 6: Gear stats into combat. New systems/loadout.ts deriveLoadout
  (aggregates equipped gear -> StatMods, gearless => {}, powerMult capped at
  1.35). Extended CastMods with powerMult/costMult/critChance/critMult/procBonus
  (all default-off) honored in spellPower/spellCost/spellProc/critProfile/
  veilShield. battle.ts snapshots the loadout on BattlePlayer.mods, adds gear
  maxhp/maxmp at init, threads mods via castModsFor through the cast/crit/veil
  path, and applies flat defense to incoming hits. GATE HELD: balanceSim.spec
  passes byte-identical (gearless => no-ops). Tests: loadout.spec (identity, cap,
  initBattle integration). NOTE: Grimoire preview showing gear deferred to Phase 9
  (Character overlay); resist mitigation reserved (enemy moves are untyped).
- [x] Phase 7: Encounter archetypes + new enemies. +3 enemies (cryptcrawler,
  boneshade, marshlurk) placed ONLY in the dungeon zone (off the balance-sim
  critical path, so the sim is untouched); recolored sprites reuse existing grids
  (sprites.spec checks palette coverage only). @ambush (repeatable step-on fixed
  fight, draws from a zone table) and @miniboss (visible, shows suggested level,
  felled-flag removes it) wired in World.ts finishStep/interact/afterBattle/
  create/placeEntities. Sunken Crypt gains a doorway ambush + a hall miniboss.
  data.spec counts bumped 14->17. NOTE: @waystone still lands in Phase 5.
- [x] Phase 8: Dungeon bosses + second dungeon. Shipped dungeon bosses as beefy
  boss-like enemies (bonelord, circuitwarden) used as objectives via the regular
  battle path (avoids a risky merge of the BossId/world.bosses commit path; the
  unique-BossSpecial DungeonBossId route is deferred). Built the Dead Circuit
  Vault (ash theme, Lv 8, plate-gated door + chest) off Ashen Reach, with
  circuitvault.live zone + backdrop. Sunken Crypt objective upgraded to the
  Bonelord. Dungeon completion now grants essence + GOLD + a rolled GEAR reward
  (wires the economy into dungeons). data.spec 17->19 enemies, 10->11 zones.
- [ ] Phase 9: Character identity (classes, backgrounds, talents, appearance).
- [ ] Phase 10: Deeper spellcraft + builds (new runes/forms, slots 7-8, presets, sb2: codes).
- [ ] Phase 11: Difficulty + run modifiers + accessibility.
- [ ] Phase 12: Roaming enemies (optional).
- [ ] Phase 13: Balance, polish, ship (docs rewrite, 06-V2-SYSTEMS.md).

## Phase checklist

- [x] Phase 0: Scaffold
- [x] Phase 1: Data + spellcraft core
- [x] Phase 2: Overworld
- [x] Phase 3: Battle system
- [x] Phase 4: Grimoire + unlock flow
- [x] Phase 5: Act 1 content (Grae playtested Act 1: done, 2026-06-10)
- [x] Phase 6: Act 2 content (Grae playtest of both Wardens pending)
- [x] Phase 7: Act 3 + finale (Grae playtest of North Hollow + Wraith pending)
- [x] Phase 8: Audio, settings, accessibility (Lighthouse on the deployed URL pending)
- [x] Phase 9: Balance, polish, ship prep (push + Pages + phone test pending, needs Grae's GitHub)
- [x] Owner additions (Grae, 2026-06-10): boss teleporters home; title Continue / New Game
- [x] Phase 11: Curve, variance, economy foundations (Grae playtest of starter feel + essence forfeiture pending)
- [x] Phase 12: The Vale's Wheel (reactions live in Grae's running playtest; watch for the violet line)
- [x] Phase 13: The discovery layer (v1.1)
- [x] Phase 14: Act 4, twins, summons (Grae playtest of the Sanctum + Hollow Warden pending)
- [x] Phase 15: NG+, polish, re-ship (DEPLOYED 2026-06-11; Grae's phone test + Lighthouse remain)
- [ ] Phase 16: Capacitor Android (stretch)

## Setup needed from Grae (one-time)

- [x] Copy the prototype into `reference/sigilbound.html`
- [ ] (Optional) Download CC0 music per `docs/03-CONTENT-DATA.md` section 11 into `content/audio/music/<id>.ogg` and record attribution in `content/audio/CREDITS.md`. The game ships fine on the synth without them; files are picked up automatically when present.
- [ ] Create the GitHub repo and push (`git remote add origin <repo-url> && git push -u origin main`), enable Pages (Settings -> Pages -> Source: GitHub Actions), run the Deploy workflow, then paste the live URL into README.md and PROGRESS.md. I can do this for you if you say the word and give a repo name.
- [ ] After deploy: run Lighthouse on the live URL (PWA installable check) and play start to finish on your phone (the Phase 9 acceptance).
- [ ] (Optional) Upload sigilbound-itch.zip to itch.io as an HTML game.

## Decisions log

- 2026-06-10: Specs authored. Platform locked: Web, TS + Vite + Phaser 3, PWA. Scope locked per docs/00-BRIEF.md.
- 2026-06-10 (Phase 0): Toolchain: Phaser 3.90, Vite 8, Vitest 4, TypeScript 6, ESLint 10 (flat config) + Prettier. Phaser pinned to 3.x (registry default is now 4).
- 2026-06-10 (Phase 0): `npm run genmaps` runs via `node --experimental-strip-types` (Node 22), zero extra deps. tsconfig sets `erasableSyntaxOnly` so all TS stays strippable (also bans enums, which suits the data-driven style).
- 2026-06-10 (Phase 0): Dev-only type packages (`@types/node`) are not treated as runtime dependencies needing justification.
- 2026-06-10 (Phase 0): Viewport ported from prototype: integer zoom (min 2) chosen so >= 12 tiles fit the short edge, internal canvas = viewport / zoom. ResizeObserver on #app keeps it fitted.
- 2026-06-10 (Phase 0): PWA plugin wired with manifest; icons + offline verification deferred to Phase 8 as planned.
- 2026-06-10 (Phase 0): GameState lives in `src/core/state.ts` (types only, no numbers). Spell is stored as its {element, form, rune} composition; name and stats derive at runtime.
- 2026-06-10 (Phase 0): Prettier scope is code only (`.prettierignore` excludes docs/, reference/, *.md) so specs are never reformatted.
- 2026-06-10 (Phase 1): All 03 tables live in `src/data/` (elements, forms, runes, statuses, progression, unlocks, enemies incl. bosses, formations; combat formula constants in constants.ts). 7 test files, 90 tests; damage.spec encodes 25+ exact formula assertions including both acceptance examples.
- 2026-06-10 (Phase 1): Rounding order ported from the prototype: spellPower rounds the per-hit base; battle (Phase 3) then applies max(1, round(power * variance * elementMult * crit)). Thirst heals max(1, round(total * 0.35)).
- 2026-06-10 (Phase 1): Starting loadout from the prototype: Emberwisp + Emberbolt inscribed in slots 1-2.
- 2026-06-10 (Phase 1): Level-ups carry surplus XP over (prototype behavior); at cap 12 XP accumulates without leveling; xpNext(12) = Infinity.
- 2026-06-10 (Phase 1): Save slots: documented key `sigilbound.save.v1` is the auto slot; manual uses `sigilbound.save.v1.manual`. Storage is injected (KVStore) so core/ stays Node-testable. migrate() rejects non-v1 payloads, repairs bad leaves with defaults, never restores battle statuses.
- 2026-06-10 (Phase 1): New-game spawn (hearth 15,10) is a provisional constant; Phase 2 map metadata becomes the source of truth.

- 2026-06-10 (Phase 2): genmaps emits generated TS modules (`src/data/maps/*.ts`, `satisfies CompiledMap`) instead of raw JSON: the compiler output is type-checked and needs no JSON import casts. Same pipeline as 01 otherwise. Generated files are prettier-exempt. A drift test asserts generated modules match a fresh in-memory compile of the ASCII sources.
- 2026-06-10 (Phase 2): Map sources use directives @id/@size/@music/@spawn/@zone/@exit/@npc/@sign/@lore/@spring/@shrine/@boss/@gate. Validator enforces: terrain legality, entity placement (non-solid, unstacked, off exits/spawn), dialogue/zone references, exit bidirectionality + landing walkability, flood-fill reachability of every exit/entity, and >= 1 reachable tall-grass tile per zone.
- 2026-06-10 (Phase 2): Overworld UI is a DOM overlay ported from the prototype (HUD, d-pad, A button, dialog, toasts, iris) rather than in-canvas Phaser UI; 44px hit targets and reducedFlash (flash -> fade) honored from settings.
- 2026-06-10 (Phase 2): Tile animation = two prebaked tilemap layers (frame A/B) with visibility toggled every 380ms; no per-frame tile work.
- 2026-06-10 (Phase 2): Encounter/overworld rolls draw from a session-seeded mulberry32 stream (Date.now seed at boot); battle seeds derive from session seed + battle counter. Systems take Rng params so tests stay deterministic.
- 2026-06-10 (Phase 2): Dialogue lives in content/dialogue/*.json keyed by id ({ speaker, pages }); genmaps validates map references against it.

- 2026-06-10 (Phase 3): Battle reducer contract: one reduce(state, action, rng) call resolves the player action, every living enemy's turn (left to right), then player DoT ticks, and emits a flat event stream the scene animates. commitBattle() folds hp/mp/xp/stats/grace/respawn back into GameState.
- 2026-06-10 (Phase 3): Player DoTs tick at the end of the round (equivalent to start of player turn). Enemy withered amplifies all damage including DoTs ("all sources", 02); player withered amplifies enemy move damage only (DoT stays % maxhp). Echo veil re-applies once at the full computed shield value.
- 2026-06-10 (Phase 3): GameState gained world.respawn {mapId,x,y}, set when a spring is used; defeat respawns there (full restore, 6 grace). 01's interface lacked a field for 02's "respawn at last used shrine/spring" rule; see Questions.
- 2026-06-10 (Phase 3): Battle seeds derive from session seed + (battles + defeats + 1) so consecutive battles get fresh streams. Battle log copy ported from the prototype; the prototype's "— empty slot —" became "(empty slot)" per the no-em-dash rule.
- 2026-06-10 (Phase 3): Pondscale and Burrowkin battle grids were pulled forward from Phase 5 because hearthvale formations already roll them.
- 2026-06-10 (Phase 3): Dev tooling: window.__game handle (DEV only) and a manual frame pump were needed to verify in the preview browser; hidden tabs stop requestAnimationFrame so Phaser's loop stalls. Real devices are unaffected.

- 2026-06-10 (Phase 4): Grimoire is a DOM overlay (render/grimoire.ts) with a thin Phaser scene driving the animated sigil; chips rebuild from unlock state, locked chips toast their hint (prototype behavior) and carry it as a tooltip. Stats panel pulls every number from systems/spellcraft, so preview numbers match the formula tests by construction. Sigil extended for nova (bursting dots), veil (steady ring), fury (bigger dots), hex (jitter), thirst (inward pull), keen (sparkle), gloom color.
- 2026-06-10 (Phase 4): Rune shrines grant once, fully restore, and become the respawn anchor (applyShrineGrant, tested). Shrine copy is prototype canon for FURY/THIRST/ECHO plus a new KEEN line; help dialogue rewritten for v1.0 verbs (targets, Veil, lingering statuses, Focus cleanse).
- 2026-06-10 (Phase 4): DEV-only window.__debug ({setLv, allShrines}) supports the debug-level acceptance check. The `#app canvas` CSS rule had to become `#app > canvas` once a second canvas (sigil preview) entered the DOM; clicks in verification also had to target game.canvas explicitly.

- 2026-06-10 (post-Phase 4 polish, Grae feedback): battle HP/MP now change as each effect plays out instead of jumping when the move is selected. Every BattleEvent carries a UiSnapshot (player hp/mp/shield/statuses + per-enemy hp/shield/statuses) captured at emit time; the scene renders bars from the event's snapshot, never from the end-of-round state. MP drops at the cast line, each enemy bar at its hit, player HP per enemy attack. Covered by a snapshot-progression test suite.

- 2026-06-10 (Phase 5): Bogmaw lives: dive every 3rd acted turn (telegraphed in the log), non-volt spells miss while submerged (MP spent, teaching moment), volt hits at x2.0 + cancels the breach + stuns through normal stun rules, uninterrupted dives become Crashing Breach at 1.6. Boss battles share the reducer via a per-enemy kind ('minion'|'boss') and a unified defOf() lookup; victory commits the world boss flag and the sigil toast comes from BOSSES data.
- 2026-06-10 (Phase 5): GameState gained world.flags (Record<string, boolean>) for one-shot story beats; the scripted first Gloop fight is a @trigger map directive validated by genmaps against data/triggers.ts, firing once via the flag. Same 01-gap treatment as respawn.
- 2026-06-10 (Phase 5): Auto-save wired: map transition, after every battle, shrine and spring use, every 60s in World. Verified save/resume across a reload (level, map, boss flags, story flags).
- 2026-06-10 (Phase 5): balanceSim.spec passes ALL 02 windows with the 03 numbers untouched, zero tuning: baseline always-bolt >= 70% aggregate (every hearthvale formation >= 40%), weakness-aware >= 95% everywhere, defensive >= 70%, median standard fight 2-4 player turns under weighted-realistic encounters, Bogmaw weakness-aware >= 80% at Lv 4 and <= 25% at Lv 2 (volt unlocking exactly at Lv 4 is what flips the fight, as designed).
- 2026-06-10 (Phase 5): Boss log conventions: bosses drop the "The" article, moves read as telegraphs ("Bogmaw: Crashing Breach!"), and the boss death line is "collapses! The corrupted sigil shatters." New copy follows 02 tone rules.

- 2026-06-10 (Phase 6): Westwood + Ashen Reach authored and validated; hearth's west/east exits opened. Warden mechanics live: Thornveil summons two Thornlings at 60% hp (they join the next round) and recasts Bramble Veil every 4th turn; Ashen Warden announces enrage below 30% and weights collapsing pillar up. Six new battle grids plus both Warden boss grids; the battle scene spawns summon sprites and rebuilds enemy rows mid-fight. Player statuses now show as shaped glyph chips with tooltips, and the Focus button names what it will cleanse. The elder reacts to sigil count (intro/progress/gate/postgame, pure fn + tests).
- 2026-06-10 (Phase 6) **BALANCE TUNING LOG** (data only, formulas untouched; 03's Act 2 numbers missed the 02 windows badly: optimal play lost 95%+ of Warden fights and ~30% of deep packs):
  - gloomwing al 1.8 -> 1.4, hpl 9 -> 7
  - thornling al 1.9 -> 1.3, hpl 10 -> 9
  - mossback al 1.8 -> 1.4 | hexbinder al 1.8 -> 1.4
  - cindermote a0 7 -> 4.5, al 1.9 -> 1.4, h0 26 -> 28, hpl 9 -> 10
  - ashling a0 7 -> 5, al 2.0 -> 1.2, h0 30 -> 28, hpl 10 -> 9
  - Thornveil hp 230 -> 165, atk 10/2.0 -> 9/1.4, summons Lv 5 -> Lv 3
  - Ashen Warden hp 280 -> 215, atk 11/2.1 -> 8/1.5 (enrage x1.4 kept)
  Root cause: enemy atkRaw growth (a0 + al*lv) outpaces player HP (+8/lv) at Act 2 levels.
- 2026-06-10 (Phase 6) sim interpretations (recorded so the assertions are reproducible):
  - Checkpoints per 02's "Lv 7-8": westwood zones test at Lv 7, ashenreach at Lv 8.
  - Weakness-aware kits are checkpoint-realistic: Act 2 assumes Act 1's Fury shrine + nova (Lv 5) + veil (Lv 7); nova is cast only when its element's average multiplier across the pack is favorable; bosses are fought with the counter-element kit; healing below 35% in boss fights only.
  - Baseline = plain bolts of unlocked elements cast in blind rotation.
  - 3-enemy spike formations: exempt from the baseline 40% floor (they are what nova exists for) and floored at 65% for weakness play; zone aggregates are encounter-weight-aware and floored at 92%.

- 2026-06-10 (Phase 7): The game can be finished. North Hollow authored (two-row corridor switchbacks, KEEN shrine on the way in, summit spring, two lore stones); hearth's north gate is real: sealed dialogue + solid until 3 Grand Sigils, then it lifts off the map. Vale Wraith fight: attunes to an element on its first turn (x1.8 from it, x0.85 otherwise; element-colored pulsing aura in the scene), shifts every 2 turns, phase 2 at 50% summons two Hollowshades and shifts every turn, phase 3 at 20% telegraphs Doom of the Vale (x2.6) every other turn; chill blunts it and a veil eats most of it, per 02's counter list. Victory routes to the Ending scene (prototype cover: THE VALE RESTS, run stats, KEEP WANDERING -> "The Vale is yours to wander." toast + post-game free roam); the Wraith marker leaves the world and the elder gives the postgame line. Defeat at the Wraith respawns at the last spring/shrine like any defeat.
- 2026-06-10 (Phase 7): Ending stats show level, battles, spells inscribed, steps, and defeats per 02 (the prototype showed only the first four; 02 wins).
- 2026-06-10 (Phase 7): Gates may sit on exit tiles (the validator allows the pair and skips flood-fill for gated exits, asserting gate adjacency instead). Quartzling + Vale Wraith grids ported verbatim from the prototype; Galeharrow + Hollowshade authored new in style.
- 2026-06-10 (Phase 7) **BALANCE TUNING LOG** (data only, formulas untouched; 03's Act 3 numbers repeated the Act 2 pattern, worse: 0-0.5% pack win rates and 0% Wraith at target level):
  - quartzling hpl 11 -> 8, a0 8 -> 5, al 2.1 -> 1.25
  - galeharrow hpl 10 -> 5, a0 8 -> 3.75, al 2.2 -> 1.05, chill rider 0.3 -> 0.15
  - hollowshade hpl 10 -> 6, a0 9 -> 4, al 2.2 -> 1.1, wither rider 0.3 -> 0.15
  - northhollow zone bands 8-12 -> cliffs 8-10, hollow 8-10 (Act 2 precedent: packs sit at or under the checkpoint level)
  - Vale Wraith hp 520 -> 300, atk 13/2.2 -> 13/0.85, siphon drain 9 -> 5, summons Lv 9 -> Lv 8 (attune 1.8/0.85, shift cadence, 2 summons, Doom x2.6 all per 02, untouched)
  Root cause as Act 2: atkRaw growth vs +8 hp/level, compounded by duration-less player statuses (wither/chill stack forever against 3 appliers) and the Lv-11 MP pool only funding ~6 casts between Focuses.
  Summon hp 80 is deliberate: a Lv 11 plain lance one-shots a shade even on a low roll, a Lv 9 one does not, which is most of what separates the >= 80%-at-11 and <= 25%-at-9 windows.
- 2026-06-10 (Phase 7) sim results: Wraith weakness-aware 84% at Lv 11, 17% at Lv 9, median fight 9 player turns (02 window 8-14). Act 3 zones: weakness-aware weighted >= 92% per zone (spike floor 65%), baseline >= 70% aggregate with all 1-2 packs over 40%.
- 2026-06-10 (Phase 7) sim interpretations and policy upgrades (recorded so the assertions are reproducible):
  - The weakness-aware policy gained: kill-shots (finish any target a strike can kill on a low roll, before healing or shielding; without this the old policy focus-looped to death beside 10 hp bosses), a veil-gated sustain Focus, lance/wisp use (best mult x form power), attunement chasing via the live boss aura, and Doom prep (chill the Wraith with rime, brace under 60% hp). All policies still share one reducer path.
  - Act 3 kits are checkpoint-realistic: zone kits carry plain lances for the local weaknesses + a Thirst nova + a veil (Westwood's Thirst shrine assumed); the Wraith kit is rime/volt/gloom Keen lances + veil (North Hollow's own shrine, found on the way in).
  - Act 3 checkpoints: cliffs at Lv 10, hollow at Lv 11; Wraith windows at 11 and 9 per the Phase 7 acceptance.
  - The kill-shot upgrade lifted every boss rate, which broke my own Phase 6 "0.2-0.6 clearly underleveled" band for Ashen at Lv 6 (optimal play now wins ~95% by bursting through the enrage). The test now asserts only ">= 0.2 beatable" per the phase acceptance; see Questions.

- 2026-06-10 (Phase 8): Audio lives in `src/audio/`: synth.ts ports the prototype tone()/SFX table verbatim and extends it to all 18 manifest ids (recipes are plain data, coverage-tested in Node; step_grass is deliberately silent like the prototype). music.ts probes `audio/music/<id>.ogg` per track (HEAD + content-type guard) and falls back to a 16-step generative chiptune loop per track (lookahead scheduler through the music gain). Mix bus: master -> {sfx, music} gains; file-based tracks follow the same volumes via element volume. Audio resumes on the first pointer or key gesture.
- 2026-06-10 (Phase 8): SFX wiring: dialog lines select, casts/hits/crits/hurt/heal/veils/statuses in the battle event player, boss telegraphs (submerge, enrage, attune, Doom) share boss_telegraph, encounter sting on battle start, victory/defeat jingles, levelup/unlock on their toasts, shrine grants play unlock, springs heal, Grimoire chips select/deny and inscribe confirms. Music: title/ending tracks, map music from the @music directive (coverage-tested against the manifest), battle vs boss in Battle.
- 2026-06-10 (Phase 8): Settings is a DOM overlay (render/settingsdom.ts) + thin scene, mirroring the Grimoire pattern, opened from a new gear button. Sliders master/music/effects (live), reduced flash toggle, text speed, d-pad side + size (live), manual save and manual load (single manual slot; loading restarts World per 01). Setting changes mutate the live GameState so the next auto-save persists them.
- 2026-06-10 (Phase 8): PWA: `npm run genicons` writes 192/512 PNGs (zero-dep encoder in scripts/genicons.ts, gold sigil on the night palette) into content/icons/. Vite publicDir now points at content/ so committed audio and icons serve from the app root (03's "loader checks content/audio" convention). Manifest carries the icons (any + maskable); workbox precaches the app shell + icons only, with CacheFirst runtime caching for any audio files. Offline play works by construction with no audio files (synth). registerSW.js is injected by the plugin.
- 2026-06-10 (Phase 8): Reduced motion: the existing reducedFlash setting still swaps the encounter flash for a fade; prefers-reduced-motion now also gates Battle camera shakes and the Doom camera flash (sprite white-flash and the red panel pulse stay, they are static color swaps). CSS overlays already respected the media query.

- 2026-06-10 (Phase 9 + owner additions): Teleporters: a defeated boss leaves a WAYSTONE on its tile (derived from world.bosses at scene build, so old saves get them with no migration). Interacting plays a two-page dialogue then warps to the Hearth spawn via the normal exit pipeline and auto-saves. New EntityAt kind 'teleporter', interaction kind 'teleport', ent_teleporter texture, dialogue id 'teleporter'; covered in worldstate.spec. Title: with any save present (auto or manual) the cover shows CONTINUE plus NEW GAME; NEW GAME arms to "ERASE + BEGIN?" for 3s and a second tap writes a fresh auto save and starts over (manual slot kept as a recovery path). Verified in browser end to end.
- 2026-06-10 (Phase 9): Copy pass is now a test (tests/copy.spec.ts): no em dashes in dialogue JSON or the player-string modules, dialogue pages <= 130 chars. Perf review: floaters pooled (14), World.update allocation-free, sigil preview only draws while the Grimoire is open, music voices are one-shot WebAudio nodes by design. README written; `npm run zip` builds sigilbound-itch.zip (index.html at root); git repo initialized with the v1.0 commit on main.

- 2026-06-10 (v1.1 design session): Depth proposal (docs/05) written, reassessed with the v1.0 brief lifted, and ACCEPTED with Grae's 10 answers (decision log in docs/05). Docs revised: 00-BRIEF rewritten for v1.1 (v1.0 brief recoverable from git history), 02 + 03 + 04 extended. Headline systems: starter element choice, Vale's Wheel reactions, potency slider, element mastery, surges/Wyrd, essence economy (free inscription preserved), elites, gates + caches + relic runes, charms, scrolls, peddler, commissions, Vale Aspects, Act 4 Sunken Sanctum (Call form, twin elements, Hollow Warden superboss), NG+, bestiary/feats/notes/spell codes. Rejected on identity grounds: cast-failure chance, gear, party system, gold, procedural maps, servers.
- 2026-06-10 (v1.1 design session): Claude rulings accepted: no 6th element (Wheel is a load-bearing 5-cycle; twins expand identity to 15), level cap stays 12, scrolls cap 3, Summon ships with Act 4.
- 2026-06-10 (v1.1 design session): XP curve reshaped (03 section 6: 14 + (lv-1)^1.35 * 14) and base MP 22 -> 26. Both are first-pass numbers for the Phase 11 sim to validate; tune data freely within the 02 assertions.

- 2026-06-10 (Phase 11): Save v2: Spell gained potency `p` (clamped to the slider range on load) and optional `given` rename; player gained starter/essence/mastery/charms/slotsUnlocked and spells went to 6 fixed slots; world gained aspect + essenceMarker; top-level notes[] scaffolds the Notes page. v1 saves upgrade in place (spells p=1, starter backfilled as 'ember' since every v1 run started there, everything else defaulted); v2 with starter null still asks the Elder. Migration round-trip + clamp tests in save.spec. Phase 12 needs no new fields (aspect and mastery are already in the shape).
- 2026-06-10 (Phase 11): Potency per 03 section 4: potCost piecewise through (0.7,0.6)/(1.0,1.0)/(1.5,2.0) in COMBAT.potCostAnchors; cost/power/veilShield all take p; exact-value tests at the detents (bolt 4/6/12 MP, fury bolt 20 at 1.5, wisp floors at 2). Grimoire: slider (step 0.05, detents are natural stops at 70/100/150 with datalist ticks), full cost ledger line ("6 base · form x1.45 · rune x1.65 · potency x2.00 = N MP"), rename field (sanitizeGivenName 1-18 chars; given name shows everywhere, generated name becomes the subtitle, log lines use the player's name), 6-slot list with sealed pages priced 40/80, essence chip, Spells/Notes tabs (notes empty-state copy authored per tone rules).
- 2026-06-10 (Phase 11): Early smoothing: BASE_MP 26; xpNext = round(14 + (lv-1)^1.35 * 14) (14/28/50/76/105/137/171/208/246/286/327); Lv 1 hearthvale.meadow re-weights to single-enemy formations (eligibleFormations; marsh untouched). Starter choice: Elder sequence on any save with starter null, final 03 section 26 copy, choice page is a new dom.openChoice component (A cannot skip it); grants the starter's Wisp + Bolt; unlock backfill via starter-relative levels (UNLOCKS 'starter' trigger + starterElementLevel; volt/gloom stay level-gated; toasts and chip hints starter-aware).
- 2026-06-10 (Phase 11): Elites + rares per 03 section 13: 10% promotion post-Bogmaw (first member; members share a level so "highest" is a tie), elite pack/ambush/glimmer rares at 4% weighted 2:1:1 rolled before the formation pick. Reducer: veiled shield 10+2lv, frenzied announce + x1.4 below half, mirrorhide 35% reflect (volt drains 4 MP instead), fleet double act at x0.6, sealed takes 0 until a weakness element cracks it (log names the key; Wheel reactions join in Phase 12). Glimmerkin roster entry (never attacks, flees end of round 2, escaped enemies pay nothing). Elite battle rows carry the prefix, sprites a gold tint (0xffd9a0), new log lines + SFX mapped.
- 2026-06-10 (Phase 11): Essence per 03 section 16: +1 victory, +5 per elite, +1 sealed bonus, +6 glimmer caught; xp x2 for promoted kills; commitBattle returns essenceGained/essenceLost; defeat drops ceil(essence/2) as the single world marker at the defeat tile (second death forfeits the old drop, AS SPEC'D, flagged below), walk-on recovery with toast, marker rendered with a pulse on its map. Boss-arena marker placement reads "the tile you stood on when the fight started", which for bosses is the interaction tile (arena entrance adjacent). Slots 5/6 sell at any shrine through the choice dialog, offered only when affordable (applySlotPurchase, tested).
- 2026-06-10 (Phase 11) **BALANCE TUNING LOG** (data only; first-pass v1.1 numbers missed two 02 assertions):
  - gloop resist ['thorn'] -> []: the thorn starter's meadow cliff (gloop dominates early rolls; resisted starts sat 11.5 points under the Lv 3-4 rate vs the 10-point window). Gloop keeps weak ember+volt.
  - bogmaw weak ['ember'] -> ['ember','thorn']: starter fairness (rime starters are the only path without ember by Lv 4; spread was 10.5 points vs the 8-point window). With thorn added, every starter path holds a Bogmaw weakness by Lv 4 (rime gets thorn at Lv 2). Spread now within window, all starters >= 80%.
  - MP 26 + the XP reshape re-passed every v1.0 window unchanged (Wraith 84%/17%, Wardens, zone floors all green).
- 2026-06-10 (Phase 11, Grae playtest fix): the level-up unlock toast read the wrong element on non-ember runs; World.afterBattle was the one call site still calling unlocksAtLevel without the starter (the Grimoire was always right). Fixed, and unlockToastText moved from the scene into systems/leveling so the full toast path is unit-tested per starter (a rime run toasts THORN at 2, EMBER at 6).
- 2026-06-10 (Phase 11) sim notes: RNG-cliff asserted on hearthvale.meadow (the smoothing lever per 03 section 6; marsh is designed to sting early so it sits outside the flatness window); early kits are the literal Elder gift (starter wisp+bolt) plus backfill bolts; Bogmaw fairness uses Lv 4 weakness-aware play per starter. New elite/ambush/glimmer draw orders documented in elites.spec headers.

- 2026-06-10 (Phase 12): The Wheel lives in the reducer: per-hit deterministic check (element E vs the status before E), consumes the setup unless the Stormcoil holds it, one reaction per hit, Echo hit 1 reacts and hit 2 re-applies, and a reaction cracks Sealed elites. Exact effects per 03 section 14 with the withered amp captured BEFORE consumption so Kindle still benefits from the Withered it spends (the "reaction portions are amped like any damage" clause). Final log copy; reaction events carry their own SFX, violet log tone, and burst FX. 14 reducer tests cover all five plus the exceptions.
- 2026-06-10 (Phase 12): Surges: one d10 per qualifying cast (wyrd always; potency >= 1.30 below mastery tier 2; wraithmark always stable), rolled on the battle stream after the spell fully resolves, never into a won battle. Table is data; echo-of-the-echo recasts as contained typed hits (no procs, no reactions, no second surge: interpretation noted), the dark collects emits a visible playerHit and floors at 1 HP. Deterministic-per-seed test included.
- 2026-06-10 (Phase 12): Mastery: battle tracks elements that landed hits; victory commits +1 each (cap 50) and reports tier-ups for toasts + mastery_tier SFX. Tier 1 +5% power, tier 2 +10% proc + greedy stability, tier 3 -1 MP (floor 2) all live in spellcraft as optional CastMods so every v1.0 call site stays exact. Grimoire gained a MASTERY tab (five element bars, tier pips); previews and the cost ledger are mastery-aware (ledger shows "mastery -1" at tier 3).
- 2026-06-10 (Phase 12): Vale Aspects: rotateAspect (pure, seeded, never repeats) fires on shrine and spring rests; battles snapshot the aspect at init. Ascendant element: player spells x1.10 power / +0.10 proc, enemy riders of its status +0.10, and that element's DoTs tick +10% on BOTH sides (the 03 sentence scopes DoTs under the enemy clause; implemented symmetric and flagged here). HUD shows a rotated-square glyph in the element color; toast "The Vale leans toward X."
- 2026-06-10 (Phase 12): Data: wyrd + all five relic runes shipped as data with flag-trigger unlocks and the 03 section 5 hint strings ("Murk trades in such things." / "Sealed behind an old gate." / "The Sanctum remembers."); only stormcoil's rule-bend is ACTIVE (Phase 12 acceptance); emberglass/stillwater/hollowlight/wraithmark effects land with their caches in Phase 13/14 (wraithmark's alwaysStable flag participates in the surge gate already). Audio manifest extended to the full v1.1 set (8 new SFX recipes, sanctum + hollowwarden synth loops). Teaching copy: twin_b rotates to the Wheel line post-Bogmaw; one new hearthvale signpost authored per tone rules.
- 2026-06-10 (Phase 12): Sim: reaction-aware policy (detonate waiting setups, open wheel pairs against the healthiest target, potency 1.25 kit below the greedy line, weakness-aware fallback brain) beats weakness-aware on summed Act 2 pack median turns, per 02's "reactions pay". All prior windows re-pass untouched (261 tests).

- 2026-06-10 (Phase 13): Discovery layer shipped: 9 element gates (@egate directive; validator treats them as passable for flood-fill per 04, since any matching spell opens them; placements auto-fitted to open tiles), caches granted on opening (relics set rune flags, charms auto-equip into a free slot, essence + lore/sign dialogues), all 8 charms functional (battle + overworld effects, unit-tested), the three remaining relic rule-bends active (emberglass resist-as-neutral, stillwater variance floor, hollowlight kill refund), scrolls (shrine scribing of any INSCRIBED page at 8 essence; battle SCROLL button; cap 3/sash 4; spent scrolls stay spent in every outcome), Murk with progress-based locations + intro + wyrd/hint/rotating-charm trades, 4 commissions with predicates + heard-notes + rewards (keeper's gated behind the trials), waystone rematches (+2 levels, elite adds per boss, first-clear +25), feats engine (battle-evaluated + world-granted) and bestiary fill, sb1 spell codes (export via slot ⎘ into the name field; import via Settings names missing parts and never grants). Grimoire grew CHARMS/FEATS/BESTIARY tabs.
- 2026-06-10 (Phase 13) interpretations: caches pay out at the gate (no rooms carved behind them; the 04 flood-fill exemption applies to the gate tiles themselves); scroll scribing offers inscribed pages (the docs' "currently-craftable composition" without building a second composer UI); scrolls at potency 2.5 surge below mastery tier 2 like any greedy cast (the 18-section letter); rematch repeats still pay normal XP (the "nothing but pride" line read as no special rewards; flag if XP should zero out); 03 section 16 promises a rematch feat but section 24's feat table has none, so no feat is granted (logged as a docs conflict).

- 2026-06-11 (Phase 14): Act 4 shipped. Sanctum map (40x28 drowned halls, sanctum.halls zone Lv 11-12 with a 15% elite rate carried in the zone table, 1 spring, lore trio, 3 trial stones, Hollow Warden chamber), entered by a stair in North Hollow's summit basin that stays sealed until the Wraith falls (exitLocked + sealed/open dialogue). Trial stones state their demand in plain text and offer the fight; trialguardian (120 flat hp, Lv 11, xp 80) is permanently Sealed except to its named reaction. First trial grants the CALL form (flag form_call), all three set trials_complete, unlock twin inscription vale-wide, and open the Keeper's commission.
- 2026-06-11 (Phase 14): The Call familiar (03 s22): summon at round((20+6lv)*p) hp (FAMILIAR data block), acts after the player every round (one typed hit at Call power, proc at element/2, echo strikes twice, thirst feeds the caster 35%, hex restores the full proc, keen crits, fury rides pw), draws 40% of enemy attacks (immune to statuses; the redirect eats the rider), fades at 0 or on recast. Twin Calls alternate nature by round parity. Rendered as a bobbing element-colored orb in Battle.
- 2026-06-11 (Phase 14): Twins (03 s15): e2 on Spell; cost x1.6 (ledger shows "twin x1.6"), matchup min(1.3, max(a,b)), both natures proc at half fraction, reactions check the left element first, names take the pair prefix (Steambolt). All ten riders in the reducer and unit-tested: steam (next move x0.7), storm (arc 50% to one other, bars-aware), wildfire (kill ignites the rest), hollowflame (ignores shields), static (Shatter +120%), mire (acts last next round), depth (no shields 2 turns), surge (+3 MP per hit), night (Withered taken x1.4), rot (DoTs tick both ends of the enemy turn). Twin surge gating reads the LOWER mastery tier. Grimoire grew a TWIN ELEMENT chip row (visible once trials_complete; primary pick clears it) and the potency slider cap follows the rune (wraithmark 1.8).
- 2026-06-11 (Phase 14): Hollow Warden (03 s23): three 140-hp bars keyed choir/wheel/author; off-key hits glance x0.25 and the SHOWN number is the adjusted one (a hidden glance would be unreadable); damage clamps at each bar floor so every bar falls to its own key; transitions log "Its script shifts." and summon one Lv 11 Hollowshade. Reaction portions route through the bar gate as wheel-keyed hits; familiar hits route through as their own shape; DoT ticks glance x0.25 and can never finish a bar (the last point falls to a keyed hit so the break announces). Unwriting arms every 4th turn (the gather consumes that turn, like Bogmaw's dive), lands x2.2 unanswered; Veil, a Chill on the Warden, or a bar break since arming spoils the WORD but not the turn (a plain move follows; reading of "cancels it"). Victory grants WRAITHMARK + the fourth_warden feat; no flee, no xp.
- 2026-06-11 (Phase 14): Seal semantics tightened for trials: a trial seal nulls ALL damage (hits and DoTs both) but marks still land through it; otherwise the demanded reaction could never be set up. Sealed ELITES keep Phase 11 behavior exactly (procs do not land; a weakness or any reaction cracks them). The non-demanded reaction on a trial stone neither cracks nor consumes through the seal.
- 2026-06-11 (Phase 14) **SIM + TUNING LOG**: target "reaction-aware optimal play at Lv 12 wins 40-60%". First pass (turn-wasting cancel + full DoT ticks + no familiar in kit) measured 0% (the player bled out), then 72.5% once the optimal kit used thirst sustain + the Call familiar, then 67% with DoT ticks glancing, and 58.0% (median 29 turns) after the Unwriting cancel was read as costing the word, not the turn. Final policy: veil the telegraph, keep a familiar up, weave defensive veils below 70% hp, kill shades with the shatter bolt, chill-shatter the wheel bar only with the detonator banked, p1.5 thirst lance for the author. No enemy data was touched; the two rule readings above were the levers, both flagged under Questions.
- 2026-06-11 (Phase 14): events added bossUnwrite{arm/cancel+reason}, barBreak, familiarSummon/Act/Hit/Fade, sealedHit.demand; battlelog lines authored per 02 tone. Sprites: Trial Guardian (graven stone, gold demand-glyph) and Hollow Warden (drowned violet, raised pen) battle grids; ent_trial world texture (satisfied stones dim). ZONE_BACKDROPS sanctum.halls drowned violet. 41 new tests (twins 18, act4 22, sim 1); 320 total, lint clean.

- 2026-06-11 (Phase 15): NG+ per 03 s25: beginNgPlus (pure, systems/ngplus.ts) carries grimoire (renames included), starter (the Elder does not re-ask), mastery, charms, slots, the five relic rune flags, feats, bestiary, lifetime stats and settings; resets level/xp/essence/scrolls/notes/sigils/shrines/world flags/gates/caches. player.ngPlus counts cycles (save-repaired to 0, so v1 and pre-15 v2 saves load clean). Interpretations: essence, scrolls, notes and shrine runes reset because 03 lists them in neither column (essence is economy, scrolls are consumables, notes would mislead a re-sealed world, shrines re-grant free); wyrd is not a relic so Murk resells it; lifetime stats persist.
- 2026-06-11 (Phase 15): Scaling: flat per cycle, never compounding. Enemies (minions, bosses, summons, rematch adds) hp x1.5 and atk x1.5; battle essence x2; elites 25% (ELITE.chanceNgPlus) with eligibility from step one; glimmerkin get an independent 6% pre-roll (StepArgs.glimmerChance, draw order unchanged when absent); aspects also rotate on map transitions; Hollow Warden +2 levels AND x1.5 hp with bars stretched to 3x210 (barsAdjust and the DoT clamp read the scaled bar). Re-opened relic caches pay 15 essence ("the relic remembers you").
- 2026-06-11 (Phase 15): Ending screen gained BEGIN AGAIN (NG+) below KEEP WANDERING: violet, arm-to-confirm ("THE VALE FORGETS?", 3s window), saves the fresh cycle before the fade. Entering the Ending with ngPlus > 0 grants the twice_written feat. Title wordmark shows one gold pip per completed cycle (cap 7) in arcane violet.
- 2026-06-11 (Phase 15): Fixed in passing: World never passed the zone eliteChance (sanctum's 15% from Phase 14 now actually applies outside NG+).
- 2026-06-11 (Phase 15): Balance re-pass: all 328 tests green including every v1.0 window, the v1.1 assertions, and the Hollow Warden 40-60% gate (58.0%). No data tuned this phase. Copy pass: zero em dashes repo-wide; final Act 4 + NG+ copy folded into 03 section 26 per the build plan. Perf: the twin chip row and ending buttons are build-once DOM/graphics, no per-frame work. Build + sigilbound-itch.zip refreshed (precache 1.38 MB).
- 2026-06-11 (Phase 15) browser acceptance: in the dev preview, a veteran Lv 12 save at the Ending began NG+ via the armed button; the World restarted at Hearth Lv 1 with the carried grimoire (renamed "Sparkpen" intact), slots 6, mastery 50, wraithmark flag held, bosses and essence reset; walking the real west door reached Westwood (Act 2) and the aspect rotated on the transition (volt); a live westwood battle spawned a Lv 7 Mossback at exactly 170 hp ((36+11*7) x 1.5) with the ng flag set; reloading showed SIGILBOUND ✦ on the title. Save migration v1 -> v2 re-verified in tests with the ngPlus default.

- 2026-06-11 (owner request, post-v1.1): rune tooltips in the Grimoire. Every rune carries a one-line player-facing `blurb` in data (02 tone); unlocked rune chips show it on hover (title attribute), and rule-bending runes (wyrd, the five relics) lead the preview notes with it when selected, so touch players see it the moment they tap the chip. Numbers-derivable runes (echo/thirst/keen/hex) keep their existing derived notes only, no duplication. Blurbs are pinned by a data test and ride the copy.spec em-dash scan. Browser-verified on all 12 chips.

- 2026-06-11 (owner request, post-v1.1): combat legibility pass. (1) The battle log now rolls: the newest beat lands bright at the bottom and the last two stay readable above it, dimming and shrinking with age (tone colors persist per line; repeated prompts replace rather than stack; history clears per battle). (2) Marks announce themselves where they land: a landed enemy status spawns an element-colored floater (BURNING, CHILLED, ...) over the sprite, beside the damage numbers. (3) Marquee beats get a center-screen stamp in display type: reactions stamp their name in arcane violet (SHATTER!), every surge stamps SURGE! in gold; reduced motion keeps the text and drops the bounce. Pacing untouched (text speed still in Settings). Browser-verified mid-fight.

## Questions for Grae

- **Q2 interpretation check (v1.1):** your answer "should remove the 2 old statuses" was read as: a Wheel reaction CONSUMES its setup status (and in Snare/Kindle the old status is gone, replaced by the new one). Spec'd that way in 03 section 14. If you meant something else (e.g. removing two of the five v1.0 statuses from the game entirely), flag it before Phase 12 builds the reducer.
- **Essence forfeiture (v1.1):** implemented as spec'd; Grae's playtest verdict 2026-06-10: "Essence drop on death is fun." Keeping one-marker forfeiture as written; revisit only if the second-death forfeit ever stings in a way the fun does not cover.
- **Phase 11 tuning to bless into 03:** gloop lost its thorn resist and Bogmaw gained a thorn weakness (full rationale in the tuning log). Both are starter-fairness fixes the 02 assertions forced; fold them into 03's tables or tell me to find different levers.
- **Summon unlock placement (v1.1):** Call is granted at the FIRST trial cleared, any order, so the rest of the Sanctum gets to use it. Built that way in Phase 14.
- **Choir bar reading (Phase 14):** 03 says full damage from "hits that struck 2+ targets this cast (nova, ...)", but the Warden opens alone, so a nova then strikes 1 target and bar 1 could never take full damage. Implemented: an all-targets cast (nova) always sings true; single hits need a real second target (storm arcs count). Bless or correct.
- **Unwriting cancel (Phase 14):** "Veil, Chill, or a bar break cancels it" was read as canceling the x2.2 word only; the Warden still takes a plain move that turn. The turn-wasting reading measured 67-72% optimal win rate (above the 40-60% gate); this reading lands 58%. Bless or pick another lever.
- **DoTs vs bars (Phase 14):** burn/venom ticks on the Warden glance at x0.25 like off-key hits and can never finish a bar. Strictly 03 only scopes "other hits"; full ticks let an ember familiar melt bars unkeyed (72.5% win rate). Bless or correct.
- **Familiar power mods (Phase 14):** the familiar's hit uses raw Call power (no mastery/aspect bonuses). Flag if it should inherit the caster's modifiers.
- **NG+ reset scope (Phase 15):** essence, scrolls, notes and the four shrine runes reset with the world (03 s25 lists them in neither the keep nor reset column; reasoning in the decisions log). Bless or move any of them to the carry side.

- Act 2 balance: 03's authored numbers missed 02's windows so hard that optimal play lost almost every Warden fight; I tuned data per the guardrails (full log above). The docs should be reconciled: either bless the tuned numbers into 03 or revisit 02's windows. Playtest both Wardens and the deep zones to confirm the feel.
- 02's boss rule "<= 25% two levels under" conflicts with Phase 6's acceptance "both Wardens beatable at Lv 6-8" for the Lv-8-target Ashen Warden: at Lv 6 it now sits ~35% with optimal play (beatable, hard). The sim asserts a 20-60% band there; pick a side if you want it tighter.
- The blanket "weakness-aware >= 95% / no formation under 40% baseline" rules meet designed 3-enemy spike packs; I floored spikes separately (see interpretations). Confirm or simplify the rules in 02.
- Player statuses (02) list no durations. Implemented as written: they persist until Focus cleanses them or the battle ends. Confirm, or give per-status durations.
- Ashen Warden's collapsing pillar is "weighted up while enraged" (03 section 7) with no magnitude given. Data uses enragedWeightMult 2 (pillar twice as likely). Confirm or supply a value before Phase 6.
- 02 says defeat respawns "at last used shrine/spring" but 01's GameState has no field for it. Added world.respawn (migrated, defaulting to the hearth spawn). If you would rather respawn at a fixed home point, say so and the field goes away.
- Act 3 balance: same story as Act 2 but stronger; full tuning log above. 03's authored Act 3 numbers and the Wraith's 520 hp produced literal 0% win rates for optimal play. The tuned Wraith hits softer per swing than 03 wrote (atk ~22 at its level) but the fight's danger now lives in its mechanics (attunement whiffs, summon pressure, Doom). Bless the tuned numbers into 03 or revisit; playtest the climb and the finale for feel.
- With kill-shot play in the sim, an optimal Lv 6 player beats the Ashen Warden ~95% of the time (it can burst through the enrage band). The "clearly underleveled" experience now only shows in baseline play. If you want underleveled boss attempts to stay scary for good players, the lever is boss hp at the low band or enrage earlier; say the word and I will retune, otherwise the sim just asserts "beatable".
- Hollowshade summons at Lv 8 with 80 hp are tuned so the one-shot threshold falls between a Lv 9 and Lv 11 lance (see tuning log). If you later change lance power or the level curve, re-check the Wraith windows first.

## Deferred / known debts

- Phaser ships as one ~1.2 MB chunk (321 kB gzip). Acceptable for a game; revisit only if load time becomes a complaint.
- Synth music loops are single-bar motifs; if they wear thin, drop CC0 .ogg files into content/audio/music and they take over per track. The synth SFX layer stays regardless.
- The Lighthouse PWA installable check needs a deployed HTTPS origin to run; build artifacts (manifest, icons, SW, registration) are verified in dist. Run it after the Pages deploy in Phase 9.
- Vite dev serves missing publicDir files oddly (200 + abort instead of 404); the music probe treats any non-audio response as missing, so the synth fallback engages either way. Static hosts return real 404s.
- North Hollow's cliff bands render with the generic wall/cliff tile; a dedicated cliff texture can join the Phase 9 polish pass.
- Battle commands are pointer/tap only (like the prototype); keyboard navigation of the command grid can ride along with gamepad support (stretch).
- Battle backdrop is drawn once at create and does not re-layout on mid-battle window resize (battles are short; revisit in Phase 9 if it bothers anyone).
- Toast visibility during throttled background tabs is unverified (cosmetic only).
- Tall grass/water animate via layer toggle; spring sparkle and water shimmer detail from the prototype can come back in the Phase 9 polish pass if missed.
