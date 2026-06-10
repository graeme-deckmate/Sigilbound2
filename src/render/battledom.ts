/**
 * Battle DOM overlay: enemy rows, log, command grid, target picking,
 * and the HUD veil-shield row. Pure DOM control; logic stays in
 * systems/battle.ts.
 */
import type { BattleState, UiSnapshot } from '../systems/battle.ts';
import { canCast } from '../systems/battle.ts';
import {
  spellCost,
  displayName,
  spellPower,
  spellHits,
  spellTargeting,
} from '../systems/spellcraft.ts';
import { ELEMENTS } from '../data/elements.ts';
import { ENEMIES, type EnemySpeciesId } from '../data/enemies.ts';
import type { EnemyStatusId, PlayerStatusId } from '../core/state.ts';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing battle element #${id}`);
  return node as T;
}

const STATUS_COLORS: Record<EnemyStatusId | PlayerStatusId, string> = {
  burning: ELEMENTS.ember.color,
  chilled: ELEMENTS.rime.color,
  stunned: ELEMENTS.volt.color,
  envenomed: ELEMENTS.thorn.color,
  withered: ELEMENTS.gloom.color,
};

/** Distinct shapes so no status is conveyed by color alone (docs/01). */
const STATUS_GLYPHS: Record<EnemyStatusId | PlayerStatusId, string> = {
  burning: '▲',
  chilled: '◆',
  stunned: '✶',
  envenomed: '✚',
  withered: '▼',
};

const STATUS_TIPS: Record<EnemyStatusId | PlayerStatusId, string> = {
  burning: 'Burning: loses HP each turn',
  chilled: 'Chilled: deals and casts weaker',
  stunned: 'Stunned: skips the next turn',
  envenomed: 'Envenomed: loses HP each turn',
  withered: 'Withered: takes 25% more damage',
};

function statusChip(status: EnemyStatusId | PlayerStatusId): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'schip';
  chip.textContent = STATUS_GLYPHS[status];
  chip.style.color = STATUS_COLORS[status];
  chip.title = STATUS_TIPS[status];
  chip.setAttribute('aria-label', STATUS_TIPS[status]);
  return chip;
}

export function showBattle(visible: boolean): void {
  el('battle').style.display = visible ? 'flex' : 'none';
  if (!visible) {
    exitTargetMode();
    updateHudShield(0);
    updateHudStatuses([]);
  }
}

export function setLog(text: string, tone?: 'reaction' | 'surge'): void {
  const log = el('blog');
  log.textContent = text;
  log.classList.toggle('tone-reaction', tone === 'reaction');
  log.classList.toggle('tone-surge', tone === 'surge');
}

/* ---------- enemy rows ---------- */

export function buildEnemyRows(state: BattleState): void {
  const bar = el('ebar');
  bar.innerHTML = '';
  for (const enemy of state.enemies) {
    const row = document.createElement('div');
    row.className = 'erow';
    row.dataset['i'] = String(enemy.index);
    // Sigilglass charm: weaknesses shown in plain sight (03 s20).
    const glass = state.player.charms.includes('sigilglass') && enemy.kind === 'minion';
    const weakNote = glass
      ? `<span class="eweak">${ENEMIES[enemy.species as EnemySpeciesId].weak
          .map((w) => `<i style="color:${ELEMENTS[w].color}">${ELEMENTS[w].label[0] ?? ''}</i>`)
          .join('')}</span>`
      : '';
    row.innerHTML =
      `<div class="etop"><span class="ename"></span>${weakNote}<span class="elv"></span></div>` +
      `<div class="ebars"><span class="bar ehp"><i></i></span><span class="eshield"></span></div>` +
      `<div class="statusrow"></div>`;
    row.querySelector('.ename')!.textContent = enemy.displayName;
    row.querySelector('.elv')!.textContent = `Lv ${String(enemy.lv)}`;
    bar.appendChild(row);
  }
  updateEnemyRows(state.enemies);
}

/** Accepts live enemies or a per-event UiSnapshot, so bars track playback. */
export function updateEnemyRows(enemies: UiSnapshot['enemies']): void {
  for (const enemy of enemies) {
    const row = el('ebar').querySelector<HTMLElement>(`.erow[data-i="${String(enemy.index)}"]`);
    if (!row) continue;
    const hpBar = row.querySelector<HTMLElement>('.bar.ehp > i');
    if (hpBar) hpBar.style.width = `${String((100 * enemy.hp) / enemy.maxhp)}%`;
    const shield = row.querySelector<HTMLElement>('.eshield');
    if (shield) {
      shield.textContent = enemy.shield > 0 ? `+${String(enemy.shield)}` : '';
      shield.title = 'Shield';
    }
    const sr = row.querySelector<HTMLElement>('.statusrow');
    if (sr) {
      sr.innerHTML = '';
      for (const [status, turns] of Object.entries(enemy.statuses)) {
        if ((turns ?? 0) <= 0) continue;
        sr.appendChild(statusChip(status as EnemyStatusId));
      }
    }
    row.classList.toggle('dead', enemy.hp <= 0);
  }
}

/* ---------- player HUD extras ---------- */

export function updateHudShield(shield: number): void {
  const row = el('hshieldrow');
  row.style.display = shield > 0 ? 'flex' : 'none';
  el('hshieldn').textContent = String(shield);
}

export function updateHudStatuses(statuses: readonly PlayerStatusId[]): void {
  const sr = el('hstatus');
  sr.innerHTML = '';
  for (const status of statuses) {
    sr.appendChild(statusChip(status));
  }
}

/* ---------- commands ---------- */

export interface CommandHandlers {
  onCast: (slot: number) => void;
  onFocus: () => void;
  onFlee: () => void;
  onScroll?: (index: number) => void;
}

export function buildCommands(state: BattleState, handlers: CommandHandlers): void {
  const c = el('cmds');
  c.innerHTML = '';
  state.player.spells.forEach((spell, slot) => {
    const b = document.createElement('button');
    b.className = 'spbtn';
    if (!spell) {
      b.disabled = true;
      b.innerHTML =
        `<span class="nm" style="color:var(--dim)">(empty slot)</span>` +
        `<span class="meta">craft in grimoire</span>`;
    } else {
      const dot = `<span class="edot" style="background:${ELEMENTS[spell.element].color}"></span>`;
      const hits = spellHits(spell) > 1 ? ' x2' : '';
      const meta =
        spellTargeting(spell) === 'self'
          ? `${String(spellCost(spell))} MP · shield`
          : `${String(spellCost(spell))} MP · pow ${String(spellPower(spell, state.player.lv))}${hits}`;
      b.innerHTML = `${dot}<span class="nm"></span><span class="meta">${meta}</span>`;
      b.querySelector('.nm')!.textContent = displayName(spell);
      b.disabled = !canCast(state, slot);
      b.onclick = () => {
        handlers.onCast(slot);
      };
    }
    c.appendChild(b);
  });
  const focus = document.createElement('button');
  focus.className = 'spbtn util';
  const oldest = state.player.statuses[0];
  focus.textContent = oldest
    ? `Focus (cleanse ${STATUS_TIPS[oldest].split(':')[0] ?? oldest})`
    : 'Focus (restore)';
  focus.onclick = handlers.onFocus;
  c.appendChild(focus);
  // SCROLL: appears only when scrolls are held (03 section 24).
  if (state.player.scrolls.length > 0 && handlers.onScroll) {
    const scroll = document.createElement('button');
    scroll.className = 'spbtn util';
    const first = state.player.scrolls[0];
    scroll.textContent = `Scroll: ${first ? displayName(first) : ''} (${String(
      state.player.scrolls.length,
    )})`;
    scroll.onclick = () => handlers.onScroll?.(0);
    c.appendChild(scroll);
  }
  const flee = document.createElement('button');
  flee.className = 'spbtn util';
  flee.textContent = 'Flee';
  flee.disabled = state.boss;
  flee.onclick = handlers.onFlee;
  c.appendChild(flee);
}

export function lockCommands(locked: boolean): void {
  el('cmds').classList.toggle('lock', locked);
}

/* ---------- target selection ---------- */

let targetCleanup: (() => void) | null = null;

export function enterTargetMode(
  state: BattleState,
  onPick: (index: number) => void,
  onCancel: () => void,
): void {
  exitTargetMode();
  setLog('Choose a target.');
  lockCommands(true);
  const handlers: [HTMLElement, () => void][] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const row = el('ebar').querySelector<HTMLElement>(`.erow[data-i="${String(enemy.index)}"]`);
    if (!row) continue;
    const handler = (): void => {
      exitTargetMode();
      onPick(enemy.index);
    };
    row.classList.add('targetable');
    row.addEventListener('pointerdown', handler);
    handlers.push([row, handler]);
  }
  const cancel = document.createElement('button');
  cancel.className = 'spbtn util cancel';
  cancel.id = 'targetcancel';
  cancel.textContent = 'Back';
  cancel.onclick = () => {
    exitTargetMode();
    onCancel();
  };
  el('bpanel').appendChild(cancel);
  targetCleanup = () => {
    for (const [row, handler] of handlers) {
      row.classList.remove('targetable');
      row.removeEventListener('pointerdown', handler);
    }
    cancel.remove();
    lockCommands(false);
  };
}

export function exitTargetMode(): void {
  targetCleanup?.();
  targetCleanup = null;
}
