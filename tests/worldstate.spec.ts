/** World interaction logic: springs, shrines, exits, facing. */
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/save.ts';
import { MAPS } from '../src/data/maps/index.ts';
import {
  applyExit,
  applyShrineGrant,
  applySpringRestore,
  facingPos,
  interactionFor,
  npcDialogueId,
  rotateAspect,
  sigilCount,
} from '../src/systems/worldstate.ts';
import { mulberry32 } from '../src/core/rng.ts';

describe('facingPos', () => {
  it('offsets one tile in the facing direction', () => {
    expect(facingPos(5, 5, 'up')).toEqual({ x: 5, y: 4 });
    expect(facingPos(5, 5, 'down')).toEqual({ x: 5, y: 6 });
    expect(facingPos(5, 5, 'left')).toEqual({ x: 4, y: 5 });
    expect(facingPos(5, 5, 'right')).toEqual({ x: 6, y: 5 });
  });
});

describe('applySpringRestore', () => {
  it('fully restores without mutating the input', () => {
    const gs = newGame();
    gs.player.hp = 3;
    gs.player.mp = 1;
    const next = applySpringRestore(gs);
    expect(next.player.hp).toBe(gs.player.maxhp);
    expect(next.player.mp).toBe(gs.player.maxmp);
    expect(gs.player.hp).toBe(3);
  });
});

describe('applyShrineGrant', () => {
  it('grants the rune once, restores fully, and moves the respawn point', () => {
    const gs = newGame();
    gs.world.mapId = 'hearthvale';
    gs.world.x = 5;
    gs.world.y = 35;
    gs.player.hp = 9;
    const { state, granted } = applyShrineGrant(gs, 'fury');
    expect(granted).toBe(true);
    expect(state.world.shrines.fury).toBe(true);
    expect(state.player.hp).toBe(state.player.maxhp);
    expect(state.world.respawn).toEqual({ mapId: 'hearthvale', x: 5, y: 35 });
  });

  it('revisits still heal and re-anchor but report granted = false', () => {
    const gs = newGame();
    gs.world.shrines.fury = true;
    gs.player.hp = 12;
    const { state, granted } = applyShrineGrant(gs, 'fury');
    expect(granted).toBe(false);
    expect(state.world.shrines.fury).toBe(true);
    expect(state.player.hp).toBe(state.player.maxhp);
  });

  it('unlocks the rune for the grimoire via the shrine flag', () => {
    const gs = newGame();
    const { state } = applyShrineGrant(gs, 'echo');
    expect(state.world.shrines.echo).toBe(true);
    // leveling.unlockedIds consumes these flags; covered in unlocks.spec.
  });
});

describe('npcDialogueId (elder story beats)', () => {
  it('elder reacts to sigil count and the Wraith', () => {
    const gs = newGame();
    expect(npcDialogueId('elder', 'elder_intro', gs)).toBe('elder_intro');
    gs.world.bosses.bogmaw = true;
    expect(npcDialogueId('elder', 'elder_intro', gs)).toBe('elder_progress');
    gs.world.bosses.thornveil = true;
    expect(npcDialogueId('elder', 'elder_intro', gs)).toBe('elder_progress');
    gs.world.bosses.ashenwarden = true;
    expect(npcDialogueId('elder', 'elder_intro', gs)).toBe('elder_gate');
    expect(sigilCount(gs)).toBe(3);
    gs.world.bosses.valewraith = true;
    expect(npcDialogueId('elder', 'elder_intro', gs)).toBe('elder_postgame');
  });

  it('other npcs keep their map dialogue', () => {
    const gs = newGame();
    gs.world.bosses.bogmaw = true;
    expect(npcDialogueId('keeper', 'keeper_tips', gs)).toBe('keeper_tips');
  });
});

describe('applyExit', () => {
  it('moves the player to the target map and tile', () => {
    const gs = newGame();
    const next = applyExit(gs, { x: 15, y: 19, to: 'hearthvale', tx: 30, ty: 1 });
    expect(next.world.mapId).toBe('hearthvale');
    expect(next.world.x).toBe(30);
    expect(next.world.y).toBe(1);
    expect(gs.world.mapId).toBe('hearth');
  });
});

describe('teleporters (fallen bosses leave a way home)', () => {
  it('a teleporter entity resolves to a teleport interaction', () => {
    const map = MAPS.hearthvale;
    expect(map).toBeDefined();
    if (!map) return;
    const entity = { kind: 'teleporter', x: 5, y: 5, ref: 'bogmaw' } as const;
    expect(interactionFor(map, entity)).toEqual({ kind: 'teleport', bossId: 'bogmaw' });
  });

  it('the synthetic exit lands on the Hearth spawn tile', () => {
    const hearth = MAPS.hearth;
    expect(hearth).toBeDefined();
    if (!hearth) return;
    const gs = newGame();
    gs.world.mapId = 'hearthvale';
    gs.world.x = 12;
    gs.world.y = 30;
    const next = applyExit(gs, {
      x: gs.world.x,
      y: gs.world.y,
      to: hearth.id,
      tx: hearth.spawn.x,
      ty: hearth.spawn.y,
    });
    expect(next.world.mapId).toBe('hearth');
    expect(next.world.x).toBe(hearth.spawn.x);
    expect(next.world.y).toBe(hearth.spawn.y);
  });
});

describe('Vale Aspect rotation (v1.1, 03 section 25)', () => {
  it('rotates on a seeded roll and never repeats the current element', () => {
    let gs = newGame();
    const rng = mulberry32(77);
    const seen = new Set<string>();
    let prev = gs.world.aspect;
    for (let i = 0; i < 200; i++) {
      gs = rotateAspect(gs, rng);
      expect(gs.world.aspect).not.toBeNull();
      expect(gs.world.aspect).not.toBe(prev);
      prev = gs.world.aspect;
      if (gs.world.aspect) seen.add(gs.world.aspect);
    }
    expect(seen.size).toBe(5); // every element ascends eventually
  });

  it('is deterministic for a fixed seed', () => {
    const a = rotateAspect(newGame(), mulberry32(5)).world.aspect;
    const b = rotateAspect(newGame(), mulberry32(5)).world.aspect;
    expect(a).toBe(b);
  });
});

describe('the second twin teaches the Wheel after Act 1 (03 section 26)', () => {
  it('twin_b keeps gossip before Bogmaw, teaches the Wheel after', () => {
    const gs = newGame();
    expect(npcDialogueId('twin_b', 'twins_gossip_b', gs)).toBe('twins_gossip_b');
    gs.world.bosses.bogmaw = true;
    expect(npcDialogueId('twin_b', 'twins_gossip_b', gs)).toBe('twins_gossip_wheel');
    // the first twin is unaffected
    expect(npcDialogueId('twin_a', 'twins_gossip_a', gs)).toBe('twins_gossip_a');
  });
});
