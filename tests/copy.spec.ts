/**
 * Copy pass (docs/04 Phase 9): no em dashes anywhere in player-facing
 * text, and dialogue pages stay short (docs/02 tone: 1 to 3 lines per
 * page). Scans the dialogue JSON plus the modules that hold inline
 * player strings (log lines, toasts, button labels), ignoring comments.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const EM_DASH = '—';

/** Longest acceptable dialogue page: ~3 lines in the 23px dialog box. */
const MAX_PAGE_CHARS = 130;

const PLAYER_STRING_MODULES = [
  'src/systems/battlelog.ts',
  'src/scenes/World.ts',
  'src/scenes/Battle.ts',
  'src/scenes/Title.ts',
  'src/scenes/Ending.ts',
  'src/render/dom.ts',
  'src/render/battledom.ts',
  'src/render/grimoire.ts',
  'src/render/settingsdom.ts',
  'src/data/elements.ts',
  'src/data/forms.ts',
  'src/data/runes.ts',
  'src/data/enemies.ts',
  'src/data/statuses.ts',
];

function stripComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

describe('player-facing copy', () => {
  it('dialogue files contain no em dashes and keep pages short', () => {
    const dir = join(root, 'content', 'dialogue');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const raw = readFileSync(join(dir, f), 'utf8');
      expect(raw.includes(EM_DASH), `${f} contains an em dash`).toBe(false);
      const parsed = JSON.parse(raw) as Record<string, { speaker: string; pages: string[] }>;
      for (const [id, entry] of Object.entries(parsed)) {
        expect(entry.pages.length, `${f}:${id} page count`).toBeGreaterThan(0);
        for (const page of entry.pages) {
          expect(page.length, `${f}:${id} page too long: "${page}"`).toBeLessThanOrEqual(
            MAX_PAGE_CHARS,
          );
        }
      }
    }
  });

  it('modules with inline player strings contain no em dashes', () => {
    for (const rel of PLAYER_STRING_MODULES) {
      const code = stripComments(readFileSync(join(root, rel), 'utf8'));
      const at = code.indexOf(EM_DASH);
      expect(at, `${rel} has an em dash near: "${code.slice(Math.max(0, at - 40), at + 40)}"`).toBe(
        -1,
      );
    }
  });
});
