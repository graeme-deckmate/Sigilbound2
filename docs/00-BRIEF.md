# 00 - PROJECT BRIEF

## One-liner

Sigilbound is a 2 to 3 hour top-down adventure where the player crafts their own spells from parts (Element x Form x Rune), explores a small interconnected vale, and fights instanced turn-based battles against creatures and four bosses.

## Why this game

The prototype proved the core loop: wander, get jumped in tall grass, win with a spell you designed yourself, unlock a new part, go craft something better. v1.0 keeps that loop sacred and adds just enough world, content, and polish to feel complete.

## Design pillars (test every feature against these)

1. **The spell is the hero.** Player expression lives in the Grimoire. Any feature that does not make crafting choices matter gets cut.
2. **Battles are moments, not grind.** Instanced, fast, readable. A standard fight should take 30 to 90 seconds.
3. **Small world, dense secrets.** Five maps, every screen has a reason to exist.
4. **Respect the session.** Mobile-first controls, auto-save, a run can be 10 minutes or 2 hours.

## Platform decision

**Chosen: Web. TypeScript + Vite + Phaser 3. Installable PWA. Deployed to GitHub Pages and itch.io.**

Reasoning, including rejected options:

| Option | Verdict | Why |
|---|---|---|
| Web (TS + Phaser) | **Chosen** | Claude Code iterates fastest on a text-only, headless-testable stack. Instant play on Grae's phone via URL or PWA install. Zero store friction, zero cost. Phaser's huge documentation corpus means fewer hallucinated APIs. |
| Godot 4 | Rejected | Good engine, but Claude Code cannot see the editor, headless testing is clunkier, and scene files are noisy to diff. Net slower for this workflow. |
| Native Android (Kotlin/Compose) | Rejected | Grae has shipped this stack before, but it is the wrong tool here. Compose is a UI toolkit, not a game loop. A canvas-in-Compose or libGDX build would be slower to develop, harder to test headlessly, and locks out desktop play for no benefit. |
| Unity | Rejected | Heavyweight, licensing noise, Claude Code friction with editor-bound workflows. Overkill for a 2D pixel game. |
| Pico-8 / TIC-80 | Rejected | Charming, but token and cart limits would fight the data-driven spell system. |

**Android later:** if v1.0 lands well, wrap with Capacitor (Phase 10, stretch). The codebase needs no changes to allow this.

## Scope

### In (v1.0)

- 5 maps: Hearth (hub village), Hearthvale, Westwood, Ashen Reach, North Hollow
- Spell system: 5 elements x 5 forms x 6 runes, 4 equip slots, unlocked progressively
- 12 enemy species + 4 bosses (3 Wardens + the Vale Wraith finale)
- Multi-enemy battles (formations of 1 to 3) with target selection
- Enemy-inflicted player statuses, and Focus as cleanse + restore
- Level cap 12, shrine and level based unlocks
- Light story: cleanse 3 Wardens to unseal the North, defeat the Wraith
- ~8 NPCs with short dialogue, signposts, lore stones
- Save system (auto + manual), settings (audio, reduced flash, text speed, d-pad options)
- Chiptune music (CC0 sourced) with synth fallback, full SFX pass
- Procedural code-defined pixel art throughout (the prototype's signature look, upgraded)
- Automated tests: damage math, unlock gating, save migration, map connectivity, balance simulation
- Deploy: GitHub Pages + itch.io, installable PWA

### Out (explicitly cut, do not add)

- Currency, shops, economy of any kind. Healing comes from shrines, springs, levels, and spells.
- Inventory and consumable items
- Party members. Solo mage only.
- Equipment / gear. Stretch: "charms" (passive slots), only after v1.0 ships.
- Procedural map generation, day/night, weather
- Multiplayer, leaderboards, accounts
- Side quests with tracking UI. NPC hints and secrets only.

### Stretch (post-v1.0, in priority order)

1. Capacitor Android build
2. Bestiary with discovered weaknesses
3. New Game+ (carry grimoire, +50% enemy stats)
4. Charms (2 passive slots)
5. Gamepad support

## Success criteria for v1.0

- A new player on a phone finishes the game in 2 to 3 hours without instructions beyond the in-game help
- All automated tests pass in CI
- 60fps on a mid-range phone (2022 era)
- Grae would send the itch.io link to a mate without apologizing for anything

## Honest risks

- **Content is the long pole, not code.** Phases 5 to 7 (maps, enemies, bosses) will take longer than the engine work. Budget accordingly.
- **Balance needs human playtesting.** The simulation tests catch regressions, not fun. Grae should play each act as it lands.
- **Audio sourcing is manual.** Claude Code cannot compose. The asset manifest lists exact CC0 sources; if files are absent the synth fallback keeps the game shippable.
