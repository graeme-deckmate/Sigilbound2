/**
 * Battle event -> log line. Copy is ported from the prototype where it
 * exists (canon) and follows the docs/02 tone rules where new. Returns
 * null for events that animate without a log line.
 */
import type { BattleEvent } from './battle.ts';
import { ENEMY_STATUSES, PLAYER_STATUSES } from '../data/statuses.ts';
import { REACTIONS, SURGE_TABLE } from '../data/wheel.ts';
import { ELEMENTS } from '../data/elements.ts';
import type { ElementId } from '../core/state.ts';

function elementLabel(element: ElementId): string {
  return ELEMENTS[element].label.toUpperCase();
}

/**
 * names[i] = display name of enemy slot i. isBoss[i] drops the "The"
 * article and switches move lines to the telegraph format.
 */
export function battleLine(
  event: BattleEvent,
  names: readonly string[],
  isBoss: readonly boolean[] = [],
): string | null {
  const name = (i: number): string => names[i] ?? 'creature';
  const the = (i: number): string => (isBoss[i] ? name(i) : `The ${name(i)}`);
  switch (event.kind) {
    case 'intro':
      return event.names.length === 1
        ? `A wild ${event.names[0] ?? ''} lunges out!`
        : `Wild creatures lunge out: ${event.names.join(', ')}!`;
    case 'bossIntro':
      return event.text;
    case 'playerCast':
      return `You cast ${event.name}!`;
    case 'enemyHit': {
      const devastating = event.mult > 1.2;
      const resisted = event.mult < 0.9;
      if (event.crit && devastating) return 'Critical! It is devastating!';
      if (devastating) return 'It is devastating!';
      if (resisted) return '...resisted.';
      if (event.crit) return 'Critical hit!';
      return null;
    }
    case 'miss':
      return 'The spell finds only water.';
    case 'bossSubmerge':
      return `${name(event.index)} dives beneath the mire! The water swells...`;
    case 'bossSurface':
      return event.reason === 'shocked'
        ? `The shock finds it! ${name(event.index)} bursts up, reeling!`
        : null;
    case 'bossSummon':
      return `${event.spawned.map((s) => s.name).join(' and ')} answer the call!`;
    case 'bossEnrage':
      return `${name(event.index)} blazes with fury! Its blows fall harder.`;
    case 'bossAttune':
      return event.first
        ? `${name(event.index)} attunes to ${elementLabel(event.element)}! It fears that element.`
        : `The aura shifts. Now attuned to ${elementLabel(event.element)}! It fears that element.`;
    case 'bossDoom':
      return `${name(event.index)} gathers the dark. ${event.name} comes!`;
    case 'enemyStatus':
      return `${the(event.index)} is ${ENEMY_STATUSES[event.status].label}!`;
    case 'enemyDot':
      return event.status === 'burning'
        ? `${the(event.index)} suffers from burns.`
        : `${the(event.index)} suffers from venom.`;
    case 'enemyDown':
      return isBoss[event.index]
        ? `${name(event.index)} collapses! The corrupted sigil shatters.`
        : `${the(event.index)} dissolves into motes!`;
    case 'enemySkip':
      return `${the(event.index)} is stunned and cannot move!`;
    case 'enemyMove':
      return isBoss[event.index]
        ? `${name(event.index)}: ${event.move}!`
        : `${the(event.index)} ${event.move}!`;
    case 'enemyShield':
      return `A shield of ${String(event.amount)} forms around it.`;
    case 'playerHit': {
      const through = event.amount - event.absorbed;
      const chilled = event.chilled ? ' (chilled: weakened)' : '';
      if (event.absorbed > 0 && through > 0)
        return `The veil absorbs ${String(event.absorbed)}. You take ${String(through)} damage${chilled}.`;
      if (event.absorbed > 0) return `The veil absorbs all ${String(event.absorbed)}${chilled}.`;
      return `You take ${String(through)} damage${chilled}.`;
    }
    case 'playerStatus':
      return `You are ${PLAYER_STATUSES[event.status].label}!`;
    case 'playerDot':
      return event.status === 'burning' ? 'You suffer from burns.' : 'You suffer from venom.';
    case 'playerCleanse':
      return `The ${PLAYER_STATUSES[event.status].label} lifts.`;
    case 'playerHeal':
      return `The rune drinks deep. +${String(event.amount)} HP.`;
    case 'mpDrain':
      return `It siphons ${String(event.amount)} MP from you.`;
    case 'focus':
      return `You steady your breath. +${String(event.mp)} MP, +${String(event.hp)} HP.`;
    case 'veilUp':
      return `A veil of ${String(event.amount)} surrounds you.`;
    case 'veilBreak':
      return 'The veil shatters!';
    case 'veilReapply':
      return `The veil echoes back: ${String(event.amount)}.`;
    case 'ambush':
      return 'You are set upon!';
    case 'reaction': {
      const def = Object.values(REACTIONS).find((r) => r.id === event.reaction);
      return def ? def.line : null;
    }
    case 'surge': {
      const def = SURGE_TABLE.find((d) => d.id === event.id);
      return def ? def.line : null;
    }
    case 'sealedHit':
      if (event.demand) {
        return `The seal holds. Only ${event.demand.toUpperCase()} may break it.`;
      }
      return event.key
        ? `The seal holds. ${elementLabel(event.key)} would crack it.`
        : 'The seal holds fast.';
    case 'familiarSummon':
      return `A ${elementLabel(event.element)} familiar answers the Call!`;
    case 'familiarAct':
      return null;
    case 'familiarHit':
      return `Your familiar takes ${String(event.amount)}.`;
    case 'familiarFade':
      return event.reason === 'replaced' ? 'The old one fades.' : 'Your familiar fades away.';
    case 'bossUnwrite': {
      if (event.phase === 'arm') return 'The Warden lifts its pen. UNWRITING gathers.';
      if (event.reason === 'veil') return 'Your veil holds. The word dies unwritten.';
      if (event.reason === 'chill') return 'Too cold to write. The word dies.';
      return 'The broken bar spoils the page. The word dies.';
    }
    case 'barBreak':
      return 'Its script shifts.';
    case 'sealBreak':
      return 'The seal shatters!';
    case 'frenzy':
      return `${the(event.index)} goes frenzied! Its blows fall harder.`;
    case 'glimmerFlee':
      return 'The Glimmerkin slips away, glittering.';
    case 'fleeFail':
      return names.length === 1
        ? `No escape! The ${names[0] ?? ''} blocks the way.`
        : 'No escape! They block the way.';
    case 'fled':
      return 'You slip away into the grass!';
    case 'victory':
      return null;
    case 'defeat':
      return 'Darkness takes you...';
  }
}
