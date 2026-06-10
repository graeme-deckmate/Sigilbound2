# PROGRESS

Claude Code: read this first every session. Update it before you stop. Keep entries short.

## Status

Current phase: **Phase 11 complete. Next: Phase 12 (The Vale's Wheel).**
Last session: 2026-06-10 (Phase 11: curve, variance, economy foundations)
Deployed URL: - (awaiting GitHub repo push + Pages enable; see Setup needed)

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
- [ ] Phase 12: The Vale's Wheel (v1.1)
- [ ] Phase 13: The discovery layer (v1.1)
- [ ] Phase 14: Act 4, twins, summons (v1.1)
- [ ] Phase 15: NG+, polish, re-ship (v1.1)
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

## Questions for Grae

- **Q2 interpretation check (v1.1):** your answer "should remove the 2 old statuses" was read as: a Wheel reaction CONSUMES its setup status (and in Snare/Kindle the old status is gone, replaced by the new one). Spec'd that way in 03 section 14. If you meant something else (e.g. removing two of the five v1.0 statuses from the game entirely), flag it before Phase 12 builds the reducer.
- **Essence forfeiture (v1.1):** implemented as spec'd; Grae's playtest verdict 2026-06-10: "Essence drop on death is fun." Keeping one-marker forfeiture as written; revisit only if the second-death forfeit ever stings in a way the fun does not cover.
- **Phase 11 tuning to bless into 03:** gloop lost its thorn resist and Bogmaw gained a thorn weakness (full rationale in the tuning log). Both are starter-fairness fixes the 02 assertions forced; fold them into 03's tables or tell me to find different levers.
- **Summon unlock placement (v1.1):** Call is granted at the FIRST trial cleared, any order, so the rest of the Sanctum gets to use it. If you would rather it be a Hollow Warden reward, say so before Phase 14.

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
