/**
 * Dialogue table, loaded from content/dialogue/*.json (docs/03 section
 * 10 holds the canonical copy). Map metadata references entries by id;
 * genmaps validates those references at compile time.
 */
import hearth from '../../content/dialogue/hearth.json';
import hearthvale from '../../content/dialogue/hearthvale.json';
import common from '../../content/dialogue/common.json';

export interface DialogueEntry {
  speaker: string;
  pages: string[];
}

export const DIALOGUE: Record<string, DialogueEntry> = {
  ...common,
  ...hearth,
  ...hearthvale,
};
