# SIGILBOUND

A top-down pixel adventure with player-crafted spells and instanced, turn-based combat (Pokemon / Dragon Quest style). Web game: TypeScript + Vite + Phaser 3, deployed as a PWA.

A playable single-file prototype lives at `reference/sigilbound.html`. Treat it as spec-by-example for feel, palette, and the validated combat math. The production game expands it per the docs below.

## Read these before writing code

1. `docs/00-BRIEF.md` - vision, scope, what is explicitly cut
2. `docs/01-ARCHITECTURE.md` - stack, structure, conventions, save system
3. `docs/02-GAME-DESIGN.md` - mechanics, progression, bosses, balancing targets
4. `docs/03-CONTENT-DATA.md` - all data tables: spells, enemies, maps, dialogue, assets
5. `docs/04-BUILD-PLAN.md` - phased milestones with acceptance criteria
6. `PROGRESS.md` - current state, what to do next

## Commands

```bash
npm run dev        # vite dev server
npm run build      # production build
npm run test       # vitest (all logic + content validation tests)
npm run lint       # eslint + prettier check
npm run genmaps    # regenerate map JSON from ASCII sources in content/maps/
```

## Session protocol

1. Read `PROGRESS.md`. Pick the next unchecked phase from `docs/04-BUILD-PLAN.md`. One phase per session unless trivially small.
2. Run `npm run test` BEFORE changing anything. If red, fix that first.
3. Implement the phase. Meet every acceptance criterion listed for it.
4. Run `npm run test` and `npm run lint`. Both must pass.
5. Update `PROGRESS.md`: check boxes, note decisions, list anything deferred.
6. Stop at the phase boundary. Summarize what changed and what is next.

## Hard rules

- TypeScript strict. No `any`. No new dependencies without writing a justification in PROGRESS.md first.
- All game numbers live in `src/data/`. No magic numbers inside systems or scenes.
- Battle RNG must use the seeded RNG from `src/core/rng.ts` so tests are deterministic. `Math.random()` is allowed only for cosmetic FX.
- Scenes stay thin. Game logic lives in `src/systems/` as pure functions that take and return state. Systems must be testable without Phaser.
- Do not redesign mechanics, rename established terms, or add scope. If a spec seems wrong, flag it in PROGRESS.md under "Questions for Grae" and implement the spec as written.
- Do not delete or rewrite the reference prototype.
- Keep files under ~300 lines where reasonable. Split rather than sprawl.
- No em dashes in any player-facing text. Use commas, periods, or parentheses.

## Definition of done (any phase)

- Acceptance criteria met
- `npm run test` green, `npm run lint` clean
- Game boots and the happy path of the phase is playable in the browser
- PROGRESS.md updated
