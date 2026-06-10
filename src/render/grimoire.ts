/**
 * Grimoire overlay DOM: chip rows built from the unlock state, live
 * stats, the animated sigil preview, and the inscribe flow. Ported
 * from the prototype forge and extended for the v1.0 parts.
 */
import type { ElementId, FormId, GameState, RuneId, Spell } from '../core/state.ts';
import { ELEMENT_IDS, ELEMENTS } from '../data/elements.ts';
import { FORM_IDS, FORMS } from '../data/forms.ts';
import { RUNE_IDS, RUNES } from '../data/runes.ts';
import { ENEMY_STATUSES } from '../data/statuses.ts';
import { UNLOCKS } from '../data/unlocks.ts';
import { unlockHint, unlockedIds, type ShrineFlags } from '../systems/leveling.ts';
import {
  displayName,
  makeSpell,
  potCost,
  sanitizeGivenName,
  spellCost,
  spellHits,
  spellName,
  spellPower,
  spellProc,
  spellTargeting,
  veilRiderProc,
  veilShield,
} from '../systems/spellcraft.ts';
import { COMBAT } from '../data/constants.ts';
import { ESSENCE } from '../data/essence.ts';
import { toast } from './dom.ts';
import { playSfx } from '../audio/synth.ts';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing grimoire element #${id}`);
  return node as T;
}

interface GrimoireCtx {
  state: GameState;
  onInscribe: (slot: number, spell: Spell) => void;
  onClose: () => void;
}

let ctx: GrimoireCtx | null = null;
const sel: Spell = { element: 'ember', form: 'bolt', rune: 'none', p: 1 };
let givenName = '';
let closeBound = false;
let page: 'spells' | 'notes' = 'spells';

export function isGrimoireOpen(): boolean {
  return ctx !== null;
}

export function openGrimoire(context: GrimoireCtx): void {
  ctx = context;
  const unlockedSpells = unlocked();
  const fallback = context.state.player.starter ?? 'ember';
  if (!unlockedSpells.elements.includes(sel.element)) sel.element = fallback;
  if (!unlockedSpells.forms.includes(sel.form)) sel.form = 'wisp';
  if (!unlockedSpells.runes.includes(sel.rune)) sel.rune = 'none';
  page = 'spells';
  el('forge').style.display = 'block';
  if (!closeBound) {
    closeBound = true;
    el('forgeclose').addEventListener('click', () => {
      playSfx('select');
      closeGrimoire();
    });
    el('tabSpells').addEventListener('click', () => {
      playSfx('select');
      page = 'spells';
      rebuild();
    });
    el('tabNotes').addEventListener('click', () => {
      playSfx('select');
      page = 'notes';
      rebuild();
    });
    const slider = el<HTMLInputElement>('potency');
    slider.addEventListener('input', () => {
      sel.p = Number(slider.value) / 100;
      refreshPreviewInfo();
    });
    const rename = el<HTMLInputElement>('renameField');
    rename.addEventListener('input', () => {
      givenName = rename.value;
      refreshPreviewInfo();
    });
  }
  rebuild();
}

export function closeGrimoire(): void {
  if (!ctx) return;
  el('forge').style.display = 'none';
  const done = ctx.onClose;
  ctx = null;
  done();
}

function unlocked(): { elements: string[]; forms: string[]; runes: string[] } {
  if (!ctx) return { elements: [], forms: [], runes: [] };
  const lv = ctx.state.player.lv;
  const shrines: ShrineFlags = ctx.state.world.shrines;
  const starter = ctx.state.player.starter;
  return {
    elements: unlockedIds('element', lv, shrines, starter),
    forms: unlockedIds('form', lv, shrines, starter),
    runes: unlockedIds('rune', lv, shrines, starter),
  };
}

function hintFor(kind: 'element' | 'form' | 'rune', id: string): string {
  const def = UNLOCKS.find((u) => u.kind === kind && u.id === id);
  return def ? unlockHint(def, ctx?.state.player.starter ?? null) : '';
}

function rebuild(): void {
  if (!ctx) return;
  el('essChip').textContent = `✦ ${String(ctx.state.player.essence)} essence`;
  el('tabSpells').classList.toggle('sel', page === 'spells');
  el('tabNotes').classList.toggle('sel', page === 'notes');
  el('spellsPage').style.display = page === 'spells' ? 'block' : 'none';
  el('notesPage').style.display = page === 'notes' ? 'block' : 'none';
  if (page === 'notes') {
    buildNotes();
    return;
  }
  buildChips();
  refreshPreviewInfo();
  buildSlots();
}

/** Notes page scaffold (v1.1): Phase 13 fills state.notes. */
function buildNotes(): void {
  if (!ctx) return;
  const wrap = el('notesList');
  wrap.replaceChildren(
    ...ctx.state.notes.map((line) => {
      const div = document.createElement('div');
      div.className = 'noteline';
      div.textContent = line;
      return div;
    }),
  );
  el('notesEmpty').style.display = ctx.state.notes.length === 0 ? 'block' : 'none';
}

function chipRow(
  containerId: string,
  ids: readonly string[],
  labels: Record<string, string>,
  kind: 'element' | 'form' | 'rune',
  unlockedList: string[],
): void {
  const wrap = el(containerId);
  wrap.innerHTML = '';
  for (const id of ids) {
    const isUnlocked = unlockedList.includes(id);
    const selected =
      (kind === 'element' && sel.element === id) ||
      (kind === 'form' && sel.form === id) ||
      (kind === 'rune' && sel.rune === id);
    const chip = document.createElement('button');
    chip.className = `chip${selected ? ' sel' : ''}${isUnlocked ? '' : ' lock'}`;
    chip.textContent = isUnlocked ? (labels[id] ?? id) : `🔒 ${labels[id] ?? id}`;
    if (!isUnlocked) chip.title = hintFor(kind, id);
    chip.onclick = () => {
      if (!isUnlocked) {
        playSfx('deny');
        toast(hintFor(kind, id), true);
        return;
      }
      playSfx('select');
      if (kind === 'element') sel.element = id as ElementId;
      if (kind === 'form') sel.form = id as FormId;
      if (kind === 'rune') sel.rune = id as RuneId;
      rebuild();
    };
    wrap.appendChild(chip);
  }
}

function buildChips(): void {
  const u = unlocked();
  chipRow(
    'chElem',
    ELEMENT_IDS,
    Object.fromEntries(ELEMENT_IDS.map((id) => [id, ELEMENTS[id].label])),
    'element',
    u.elements,
  );
  chipRow(
    'chForm',
    FORM_IDS,
    Object.fromEntries(FORM_IDS.map((id) => [id, FORMS[id].label])),
    'form',
    u.forms,
  );
  chipRow(
    'chRune',
    RUNE_IDS,
    Object.fromEntries(RUNE_IDS.map((id) => [id, RUNES[id].label])),
    'rune',
    u.runes,
  );
}

function refreshPreviewInfo(): void {
  if (!ctx) return;
  const lv = ctx.state.player.lv;
  const spell = makeSpell(sel.element, sel.form, sel.rune, sel.p);
  const element = ELEMENTS[spell.element];
  const rune = RUNES[spell.rune];
  const form = FORMS[spell.form];
  const given = sanitizeGivenName(givenName);
  el('pvname').textContent = given ? `${given} (${spellName(spell)})` : spellName(spell);

  // Potency slider readout + the full cost ledger (02: the cost is a
  // conversation, never a surprise).
  el<HTMLInputElement>('potency').value = String(Math.round(sel.p * 100));
  el('potencyV').textContent = `x${sel.p.toFixed(2)}`;
  el('potLedger').textContent =
    `${String(COMBAT.costBase)} base · form x${String(form.mp)} · rune x${String(rune.mp)}` +
    ` · potency x${potCost(sel.p).toFixed(2)} = ${String(spellCost(spell))} MP`;

  const cost = `Cost <b style="color:var(--mp)">${String(spellCost(spell))} MP</b>`;
  const statusName = ENEMY_STATUSES[element.status].label;
  let main: string;
  const notes: string[] = [];

  if (spellTargeting(spell) === 'self') {
    main = `Shield <b style="color:${element.color}">${String(veilShield(spell, lv))}</b> · ${cost}`;
    notes.push(
      `${String(Math.round(veilRiderProc(spell) * 100))}% to leave a striker ${statusName}`,
    );
    if (rune.healFrac !== undefined)
      notes.push(`heals ${String(Math.round(rune.healFrac * 100))}% of absorbed when it breaks`);
    if (rune.veilReapply) notes.push('re-forms once after breaking');
    if (rune.crit) notes.push('Keen has no effect on a veil');
  } else {
    const hits = spellHits(spell) > 1 ? ' ×2' : '';
    main = `Power <b style="color:${element.color}">${String(spellPower(spell, lv))}${hits}</b> · ${cost}`;
    notes.push(`${String(Math.round(spellProc(spell) * 100))}% to leave the foe ${statusName}`);
    if (spellTargeting(spell) === 'all') notes.push('hits all enemies');
    if (rune.hits !== undefined) notes.push('strikes twice');
    if (rune.healFrac !== undefined)
      notes.push(`heals ${String(Math.round(rune.healFrac * 100))}% of damage`);
    if (rune.crit)
      notes.push(
        `crit ${String(Math.round(rune.crit.chance * 100))}% at x${String(rune.crit.mult)}`,
      );
  }
  el('pvstats').innerHTML = `${main}<br><span class="mut"></span>`;
  const mut = el('pvstats').querySelector('.mut');
  if (mut) mut.textContent = notes.join(' · ');
}

function buildSlots(): void {
  if (!ctx) return;
  const wrap = el('slotlist');
  wrap.innerHTML = '';
  const unlockedSlots = ctx.state.player.slotsUnlocked;
  ctx.state.player.spells.forEach((spell, i) => {
    const b = document.createElement('button');
    b.className = 'slotbtn';
    b.innerHTML = `<span></span><small></small>`;
    const label = b.querySelector('span');
    const meta = b.querySelector('small');
    if (i >= unlockedSlots) {
      // Sealed pages: bought at any shrine (03 section 16).
      const price = i === 4 ? ESSENCE.slot5 : ESSENCE.slot6;
      if (label) label.textContent = `${String(i + 1)}. (sealed page)`;
      if (meta) meta.textContent = `${String(price)} essence, at a shrine`;
      b.disabled = true;
      wrap.appendChild(b);
      return;
    }
    if (spell) {
      const shown = displayName(spell);
      const subtitle = spell.given ? ` (${spellName(spell)})` : '';
      if (label) {
        label.textContent = `${String(i + 1)}. ${shown}`;
        if (subtitle) {
          const sub = document.createElement('span');
          sub.className = 'subtitle';
          sub.textContent = subtitle;
          label.appendChild(sub);
        }
      }
      if (meta) meta.textContent = `${String(spellCost(spell))} MP · x${(spell.p ?? 1).toFixed(2)}`;
    } else {
      if (label) label.textContent = `${String(i + 1)}. empty`;
      if (meta) meta.textContent = 'tap to inscribe';
    }
    b.onclick = () => {
      if (!ctx) return;
      playSfx('confirm');
      const crafted = makeSpell(sel.element, sel.form, sel.rune, sel.p);
      const given = sanitizeGivenName(givenName);
      if (given && given !== spellName(crafted)) crafted.given = given;
      ctx.onInscribe(i, crafted);
      givenName = '';
      el<HTMLInputElement>('renameField').value = '';
      buildSlots();
      refreshPreviewInfo();
      toast(`Inscribed: ${displayName(crafted)}`, true);
    };
    wrap.appendChild(b);
  });
}

/* ---------- animated sigil preview ---------- */

const DOT_COUNT: Record<FormId, number> = { wisp: 3, bolt: 5, lance: 7, nova: 9, veil: 6 };

/** Draw one frame of the sigil. t is seconds; cosmetic animation only. */
export function drawSigilFrame(t: number): void {
  if (!ctx) return;
  const canvas = el<HTMLCanvasElement>('pvcv');
  const g = canvas.getContext('2d');
  if (!g) return;
  const color = ELEMENTS[sel.element].color;
  const rune = RUNES[sel.rune];
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#16112b';
  g.fillRect(0, 0, 52, 52);

  g.strokeStyle = '#3a2f6b';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(26, 26, 18, 0, 7);
  g.stroke();

  g.strokeStyle = color;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.arc(26, 26, 13, t * 0.8, t * 0.8 + 4.4);
  g.stroke();
  g.globalAlpha = 1;

  const n = DOT_COUNT[sel.form];
  const size = rune.pw !== undefined ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const a = t * 1.4 + i * ((Math.PI * 2) / n);
    let r: number;
    if (sel.form === 'veil') {
      r = 15; // a steady shield ring
    } else if (sel.form === 'nova') {
      r = 8 + ((t * 14 + i * 2) % 9); // dots bursting outward
    } else {
      r = 10 + 4 * Math.sin(t * 2 + i);
    }
    if (rune.healFrac !== undefined) r -= 2 + Math.sin(t * 3 + i); // thirst pulls inward
    let jx = 0;
    let jy = 0;
    if (rune.procBonus !== undefined) {
      jx = Math.sin(t * 19 + i * 5) * 1.5; // hex jitter
      jy = Math.cos(t * 23 + i * 3) * 1.5;
    }
    g.fillStyle = color;
    g.fillRect(26 + Math.cos(a) * r - 1 + jx, 26 + Math.sin(a) * r - 1 + jy, size, size);
  }

  g.fillStyle = color;
  g.fillRect(24, 24, 4, 4);
  if (rune.hits !== undefined) {
    g.globalAlpha = 0.5;
    g.fillRect(20, 28, 3, 3);
    g.fillRect(30, 20, 3, 3);
    g.globalAlpha = 1;
  }
  if (rune.crit && Math.sin(t * 6) > 0.2) {
    g.fillStyle = '#ffffff';
    g.fillRect(25, 20, 2, 2);
    g.fillRect(21, 24, 2, 2);
    g.fillRect(29, 24, 2, 2);
    g.fillRect(25, 28, 2, 2);
  }
}
