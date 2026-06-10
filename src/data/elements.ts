/** Elements, transcribed from docs/03-CONTENT-DATA section 1. */
import type { ElementId, EnemyStatusId } from '../core/state.ts';

export interface ElementDef {
  id: ElementId;
  /** Display label; also the spell-name prefix (03 section 4). */
  label: string;
  color: string;
  /** Status this element can inflict on enemies. */
  status: EnemyStatusId;
  /** Base status proc chance. */
  proc: number;
}

export const ELEMENT_IDS: readonly ElementId[] = ['ember', 'rime', 'volt', 'thorn', 'gloom'];

export const ELEMENTS: Record<ElementId, ElementDef> = {
  ember: { id: 'ember', label: 'Ember', color: '#ff6b4a', status: 'burning', proc: 0.35 },
  rime: { id: 'rime', label: 'Rime', color: '#5ad1ff', status: 'chilled', proc: 0.4 },
  volt: { id: 'volt', label: 'Volt', color: '#ffd84a', status: 'stunned', proc: 0.28 },
  thorn: { id: 'thorn', label: 'Thorn', color: '#7dde6a', status: 'envenomed', proc: 0.5 },
  gloom: { id: 'gloom', label: 'Gloom', color: '#b07ce8', status: 'withered', proc: 0.4 },
};
