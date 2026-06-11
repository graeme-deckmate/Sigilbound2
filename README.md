# SIGILBOUND

A 3 to 5 hour top-down pixel adventure where you craft your own spells.
Roam the Vale, bind an element, a form and a rune in the Grimoire, tune
the potency, name the page, and take on instanced turn-based battles
that strike from the tall grass. v1.1 adds the Vale's Wheel (status
reactions), element mastery, surges, elites, essence, gates and relic
runes, charms, scrolls, a wandering peddler, commissions, Vale Aspects,
a fourth act under the mountain (the Call familiar, twin-element
spells, an optional superboss) and NG+.
Built with TypeScript, Vite and Phaser 3; ships as an installable PWA.

**Play:** https://graeme-deckmate.github.io/Sigilnbound/

## Controls

- Move: d-pad (touch) or WASD / arrow keys
- Interact / advance: the gold button or E / Enter
- Spellcraft: the Grimoire button, top right
- Settings (volume, comfort, d-pad, manual save): the gear button

## Develop

```bash
npm install
npm run dev        # vite dev server
npm run test       # vitest: logic, content validation, balance sim
npm run lint       # eslint + prettier
npm run build      # production build (PWA)
npm run genmaps    # recompile ASCII maps from content/maps/
npm run genicons   # regenerate PWA icons
npm run zip        # build + sigilbound-itch.zip for itch.io
```

The design docs live in `docs/` and the playable single-file prototype
in `reference/sigilbound.html`. `PROGRESS.md` tracks build state and
decisions. All art and audio are procedural (pixel grids and a WebAudio
synth); drop CC0 `.ogg` files into `content/audio/music/` to replace
the synth music per track (see `content/audio/CREDITS.md`).

## Deploy

- GitHub Pages: the `Deploy to GitHub Pages` workflow builds and
  publishes `dist/` (run from the Actions tab, or enable the push
  trigger in `.github/workflows/deploy.yml`).
- itch.io: upload `sigilbound-itch.zip` (from `npm run zip`) as an
  HTML game with `index.html` as the entry.
