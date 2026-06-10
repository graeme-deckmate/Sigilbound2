/** Spell naming per docs/03-CONTENT-DATA section 4, with doc examples. */
import { describe, expect, it } from 'vitest';
import { makeSpell, spellName } from '../src/systems/spellcraft.ts';
import { ELEMENT_IDS } from '../src/data/elements.ts';
import { FORM_IDS } from '../src/data/forms.ts';
import { RUNE_IDS } from '../src/data/runes.ts';

describe('spellName', () => {
  it('no rune gives a bare name: Emberwisp, Emberbolt', () => {
    expect(spellName(makeSpell('ember', 'wisp', 'none'))).toBe('Emberwisp');
    expect(spellName(makeSpell('ember', 'bolt', 'none'))).toBe('Emberbolt');
  });

  it('matches the doc examples exactly', () => {
    expect(spellName(makeSpell('gloom', 'nova', 'hex'))).toBe('Gloomnova of Hexes');
    expect(spellName(makeSpell('ember', 'veil', 'thirst'))).toBe('Emberveil of Thirst');
    expect(spellName(makeSpell('volt', 'lance', 'keen'))).toBe('Voltlance of Keening');
    expect(spellName(makeSpell('rime', 'lance', 'thirst'))).toBe('Rimelance of Thirst');
  });

  it('every rune suffix reads as written in 03', () => {
    expect(spellName(makeSpell('thorn', 'bolt', 'fury'))).toBe('Thornbolt of Fury');
    expect(spellName(makeSpell('thorn', 'bolt', 'echo'))).toBe('Thornbolt of Echoes');
  });

  it('all 300 combinations are well formed', () => {
    for (const e of ELEMENT_IDS)
      for (const f of FORM_IDS)
        for (const r of RUNE_IDS) {
          const name = spellName(makeSpell(e, f, r));
          expect(name).toMatch(
            /^(Ember|Rime|Volt|Thorn|Gloom)(wisp|bolt|lance|nova|veil)( of (the )?[A-Z][a-z]+)?$/,
          );
        }
  });
});
