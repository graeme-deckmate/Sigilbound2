/** Unlock schedule, transcribed from docs/03-CONTENT-DATA section 5. */
import type { ElementId, FormId, RuneId, ShrineId } from '../core/state.ts';

export type UnlockTrigger =
  | { type: 'start' }
  | { type: 'level'; lv: number }
  | { type: 'shrine'; shrine: ShrineId; region: string };

export type UnlockDef =
  | { kind: 'element'; id: ElementId; trigger: UnlockTrigger }
  | { kind: 'form'; id: FormId; trigger: UnlockTrigger }
  | { kind: 'rune'; id: RuneId; trigger: UnlockTrigger };

export const UNLOCKS: readonly UnlockDef[] = [
  { kind: 'element', id: 'ember', trigger: { type: 'start' } },
  { kind: 'form', id: 'wisp', trigger: { type: 'start' } },
  { kind: 'form', id: 'bolt', trigger: { type: 'start' } },
  { kind: 'rune', id: 'none', trigger: { type: 'start' } },
  { kind: 'element', id: 'rime', trigger: { type: 'level', lv: 2 } },
  { kind: 'form', id: 'lance', trigger: { type: 'level', lv: 3 } },
  { kind: 'element', id: 'volt', trigger: { type: 'level', lv: 4 } },
  { kind: 'form', id: 'nova', trigger: { type: 'level', lv: 5 } },
  { kind: 'element', id: 'thorn', trigger: { type: 'level', lv: 6 } },
  { kind: 'form', id: 'veil', trigger: { type: 'level', lv: 7 } },
  { kind: 'element', id: 'gloom', trigger: { type: 'level', lv: 8 } },
  { kind: 'rune', id: 'hex', trigger: { type: 'level', lv: 9 } },
  { kind: 'rune', id: 'fury', trigger: { type: 'shrine', shrine: 'fury', region: 'Hearthvale' } },
  { kind: 'rune', id: 'thirst', trigger: { type: 'shrine', shrine: 'thirst', region: 'Westwood' } },
  { kind: 'rune', id: 'echo', trigger: { type: 'shrine', shrine: 'echo', region: 'Ashen Reach' } },
  { kind: 'rune', id: 'keen', trigger: { type: 'shrine', shrine: 'keen', region: 'North Hollow' } },
];
