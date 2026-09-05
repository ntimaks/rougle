import { describe, expect, it } from 'vitest';
import { availableModifiers, canStack, lengthFor, modifierCount, rollModifiers } from './modifiers';

/** MECHANICS.md §5. Modifiers are the entire difficulty curve. */

describe('act gating', () => {
  it('Act I offers only the Act I modifiers', () => {
    expect(availableModifiers(0).map((m) => m.id).sort()).toEqual(['LOCKED_KEY', 'SILENT_START']);
  });

  it('Act II adds the long/decay/fog set but not the Act III ones', () => {
    const ids = availableModifiers(1).map((m) => m.id);
    expect(ids).toContain('DECAY');
    expect(ids).toContain('FOG');
    expect(ids).toContain('LONG_WORD');
    expect(ids).not.toContain('LIAR_LETTER');
    expect(ids).not.toContain('LONGER_WORD');
    // R-019 moved Mirror out of Act II along with the Twins.
    expect(ids).not.toContain('MIRROR');
  });

  it('Act III adds Liar Letter, Mirror and the 7-letter words', () => {
    const ids = availableModifiers(2).map((m) => m.id);
    expect(ids).toContain('LIAR_LETTER');
    expect(ids).toContain('LONGER_WORD');
    expect(ids).toContain('MIRROR');
  });
});

describe('stacking exclusions', () => {
  it('Silent Start and Fog cannot co-occur', () => {
    expect(canStack('FOG', 'SILENT_START')).toBe(false);
    expect(canStack('SILENT_START', 'FOG')).toBe(false);
  });

  it('a modifier never stacks with itself', () => {
    expect(canStack('DECAY', 'DECAY')).toBe(false);
  });

  it('the two length modifiers are mutually exclusive', () => {
    expect(canStack('LONG_WORD', 'LONGER_WORD')).toBe(false);
  });

  it('Long + Liar + Decay is legal, brutal and survivable', () => {
    expect(canStack('LONG_WORD', 'LIAR_LETTER')).toBe(true);
    expect(canStack('LIAR_LETTER', 'DECAY')).toBe(true);
    expect(canStack('LONG_WORD', 'DECAY')).toBe(true);
  });
});

describe('rollModifiers', () => {
  it('never produces a conflicting pair, over 10k seeded nodes', () => {
    for (let i = 0; i < 10_000; i++) {
      const act = (i % 3) as 0 | 1 | 2;
      const mods = rollModifiers('MODSEED', `n${i}`, act, i % 7 === 0 ? 'ELITE' : 'WORD');
      for (const a of mods) {
        for (const b of mods) {
          if (a !== b) expect(canStack(a, b), `${a} + ${b}`).toBe(true);
        }
        expect(availableModifiers(act).map((m) => m.id)).toContain(a);
      }
    }
  });

  it('is deterministic for an address', () => {
    expect(rollModifiers('MODSEED', 'n1', 2, 'WORD')).toEqual(rollModifiers('MODSEED', 'n1', 2, 'WORD'));
  });

  it('gives elites two modifiers in Act III (STACKED)', () => {
    expect(modifierCount(2, 'ELITE', 0)).toBe(2);
    expect(modifierCount(0, 'ELITE', 0)).toBe(1);
    expect(modifierCount(0, 'SHOP', 0)).toBe(0);
  });
});

describe('lengthFor', () => {
  it('applies the length modifiers', () => {
    expect(lengthFor(5, [])).toBe(5);
    expect(lengthFor(5, ['LONG_WORD'])).toBe(6);
    expect(lengthFor(5, ['LONGER_WORD'])).toBe(7);
    expect(lengthFor(6, ['LONG_WORD'])).toBe(6);
  });
});
