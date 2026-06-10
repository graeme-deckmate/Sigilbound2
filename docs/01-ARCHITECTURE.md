# 01 - ARCHITECTURE

## Stack

- **TypeScript** (strict), **Vite**, **Phaser 3** (latest 3.x), **Vitest**, **ESLint + Prettier**
- **vite-plugin-pwa** for installability and offline play
- No other runtime dependencies without justification in PROGRESS.md

## Project structure

```
sigilbound/
  CLAUDE.md
  PROGRESS.md
  docs/                      # these specs
  reference/sigilbound.html  # playable prototype, read-only
  content/
    maps/*.map.txt           # ASCII map sources (legend + metadata header)
    dialogue/*.json          # NPC and signpost text
    audio/                   # dropped-in CC0 files (may be absent)
  scripts/
    genmaps.ts               # ASCII -> dist map JSON, run via npm run genmaps
  src/
    main.ts
    core/                    # engine-agnostic utilities
      rng.ts                 # seeded RNG (mulberry32), battle logic must use this
      events.ts              # typed event bus
      save.ts                # versioned save/load + migrations
      input.ts               # action abstraction: move/interact/cancel/menu
    data/                    # ALL game numbers and tables, no logic
      elements.ts forms.ts runes.ts enemies.ts formations.ts
      unlocks.ts progression.ts statuses.ts constants.ts
    systems/                 # pure logic, no Phaser imports
      spellcraft.ts          # makeSpell, spellPower, spellCost, spellProc, naming
      battle.ts              # battle state machine: reducers + turn resolution
      encounters.ts          # zone tables, encounter rolls, grace steps
      leveling.ts            # xp, level-up, unlock evaluation
      worldstate.ts          # flags, shrine/boss state, map transitions
    scenes/                  # thin Phaser scenes, render + input only
      Boot.ts Preload.ts Title.ts World.ts Battle.ts
      Grimoire.ts Settings.ts Ending.ts
    render/
      sprites.ts             # pixel-grid sprite builder + palettes (from prototype)
      tiles.ts               # procedural tile renderers
      fx.ts                  # particle pools, floaters, shake, transitions
    audio/
      synth.ts               # WebAudio fallback SFX/jingles (port from prototype)
      music.ts               # track loader, falls back to synth loops if files absent
  tests/
    damage.spec.ts unlocks.spec.ts save.spec.ts
    mapConnectivity.spec.ts balanceSim.spec.ts naming.spec.ts
```

## Core rules

### Separation
Phaser appears ONLY in `src/scenes/`, `src/render/`, `src/audio/music.ts`, and `main.ts`. Everything in `core/`, `data/`, `systems/` must run under Vitest in Node with zero browser APIs.

### State
One `GameState` object owns truth:

```ts
interface GameState {
  version: 1;
  player: { lv: number; xp: number; hp: number; mp: number;
            maxhp: number; maxmp: number;
            spells: (Spell | null)[];           // length 4
            statuses: StatusMap; };             // battle-only, cleared on save
  world: { mapId: MapId; x: number; y: number; facing: Dir;
           shrines: Record<ShrineId, boolean>;
           bosses: Record<BossId, boolean>;
           graceSteps: number; };
  settings: { master: number; sfx: number; music: number;
              reducedFlash: boolean; textSpeed: 0|1|2;
              dpadSide: 'left'|'right'; dpadScale: number; };
  stats: { battles: number; inscribed: number; steps: number;
           defeats: number; playMs: number; };
}
```

Battle holds its own transient `BattleState` derived from GameState; on victory/defeat it commits results back. Battle resolution is a pure reducer in `systems/battle.ts`: `(state, action, rng) -> { state, events[] }`. Scenes render the emitted events (damage numbers, messages, FX). This is what makes the balance simulation possible.

### Saves
- `localStorage` key `sigilbound.save.v1` (this is a deployed web app, not a Claude artifact, so localStorage is correct here)
- Auto-save: on map transition, after every battle, on shrine use, every 60s while in World
- Manual save from Settings. Single auto slot + single manual slot.
- `save.ts` exports `migrate(raw): GameState`; version bumps require a migration test in `save.spec.ts`
- Never save mid-battle. Loading always lands in World.

### RNG
`mulberry32(seed)`. Each battle derives a seed from a run seed + battle counter. Tests inject fixed seeds. Cosmetic FX may use `Math.random()`.

## Map pipeline (no Tiled, keep the prototype approach)

Maps are ASCII files with a metadata header, committed to `content/maps/`. `npm run genmaps` compiles them to JSON consumed by the game and by tests.

```
# hearthvale.map.txt
@id hearthvale
@size 60x40
@music vale_theme
@zone south  2,24 57,38  gloop_pack_a
@zone west   2,10 28,22  woods_pack_a
@exit 30,0 -> northhollow 25,38
@npc elder 12,8 dialogue:elder_intro
---
<ASCII rows, one char per tile, legend in 03-CONTENT-DATA>
```

`genmaps.ts` validates: row lengths match @size, all referenced dialogue/formation ids exist, exits are bidirectionally sane. `mapConnectivity.spec.ts` flood-fills every map from its entry points and asserts every interactable and exit is reachable (port the prototype validator).

## Scene flow

```
Boot -> Preload -> Title -> World <-> Battle
                              |-> Grimoire (overlay scene)
                              |-> Settings (overlay scene)
                              '-> Ending
```

- World: grid movement (160ms tile tween), camera follow with deadzone, interaction raycast (facing tile)
- Battle: launched with `{ formationId, zoneId, seed }`, returns a result event
- Transitions: encounter flash + iris from prototype; `reducedFlash` setting swaps flash for a 200ms fade

## Input abstraction

`core/input.ts` maps sources to actions: `move(dir) | interact | cancel | menu`. Sources: keyboard (WASD/arrows, E/Enter, Esc), touch d-pad + A button (port prototype pointer handling, multi-touch safe), gamepad later. Scenes consume actions only.

## Rendering

- Internal low-res canvas, integer scaled, `pixelArt: true`, `roundPixels: true`
- All art is code-defined pixel grids (`render/sprites.ts`) and procedural tiles (`render/tiles.ts`), porting and extending the prototype's `spriteFromGrid` + palette approach
- Overworld sprites 12x14 to 16x16; battle sprites 16x16 to 24x24 grids scaled 4x to 6x
- Object pools for particles and floating numbers (no allocation in the frame loop)
- One world palette + one accent palette per region, defined in `data/constants.ts`

## Performance budget

60fps on a 2022 mid-range phone. Frame work: input <1ms, logic <4ms, render <6ms. No per-frame allocations in World or Battle steady state. Visible tile culling as in prototype.

## Accessibility floor

- `prefers-reduced-motion` respected, plus in-game `reducedFlash` toggle (photosensitivity: the encounter flash is the riskiest element, the toggle replaces it)
- Hit targets >= 44px, visible focus styles on all DOM/UI buttons
- Text speed setting affects battle message pacing
- No information conveyed by color alone (status icons carry shape + tooltip text)

## Deploy

- GitHub Actions: on push to main run lint + test + build, publish `dist/` to GitHub Pages
- itch.io: manual zip upload of `dist/` (butler optional later)
- PWA: manifest + service worker via vite-plugin-pwa, cache-first for assets
