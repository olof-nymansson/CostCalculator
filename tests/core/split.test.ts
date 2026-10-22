import { describe, expect, it } from 'vitest';
import { toMoney, sumMoney } from '../../src/core/money';
import { splitExpense } from '../../src/core/split';
import type { SplitMode } from '../../src/core/split';
import { alloc, pid } from './helpers';

const amounts = (total: number, mode: SplitMode): number[] => {
  const result = splitExpense(toMoney(total), mode);
  if (!result.ok) throw new Error(`split failed: ${result.error.kind}`);
  return result.value.map((s) => s.amount);
};

const equal = (...ids: string[]): SplitMode => ({
  kind: 'equal',
  participants: ids.map(pid),
});

describe('equal split', () => {
  it('splits evenly when divisible', () => {
    expect(amounts(9000, equal('a', 'b', 'c'))).toEqual([3000, 3000, 3000]);
  });

  it('gives the extra öre to the lowest ids when 100 SEK is split among 3', () => {
    expect(amounts(10000, equal('a', 'b', 'c'))).toEqual([3334, 3333, 3333]);
  });

  it('is independent of the order participants are listed in', () => {
    expect(amounts(10000, equal('c', 'a', 'b'))).toEqual([3334, 3333, 3333]);
  });

  it('returns shares ordered by participant id', () => {
    const result = splitExpense(toMoney(100), equal('c', 'a', 'b'));
    expect(result.ok && result.value.map((s) => s.participant)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('handles a single participant', () => {
    expect(amounts(12345, equal('a'))).toEqual([12345]);
  });

  it('handles a zero amount', () => {
    expect(amounts(0, equal('a', 'b'))).toEqual([0, 0]);
  });

  it('handles a total smaller than the number of participants', () => {
    expect(amounts(2, equal('a', 'b', 'c'))).toEqual([1, 1, 0]);
  });

  it('stays exact for very large amounts', () => {
    const total = Number.MAX_SAFE_INTEGER;
    const result = splitExpense(toMoney(total), equal('a', 'b', 'c'));
    expect(result.ok && sumMoney(result.value.map((s) => s.amount))).toBe(
      total,
    );
  });
});

describe('shares split', () => {
  it('splits proportionally to the weights', () => {
    const mode: SplitMode = {
      kind: 'shares',
      weights: [alloc('a', 1), alloc('b', 3)],
    };
    expect(amounts(10000, mode)).toEqual([2500, 7500]);
  });

  it('distributes remainders by largest fractional part', () => {
    // 100 öre in 1:1:2 => exact 25, 25, 50
    // 101 öre in 1:1:2 => 25.25, 25.25, 50.5 => the extra öre goes to c
    const mode: SplitMode = {
      kind: 'shares',
      weights: [alloc('a', 1), alloc('b', 1), alloc('c', 2)],
    };
    expect(amounts(101, mode)).toEqual([25, 25, 51]);
  });

  it('gives a participant with weight 0 nothing', () => {
    const mode: SplitMode = {
      kind: 'shares',
      weights: [alloc('a', 0), alloc('b', 2)],
    };
    expect(amounts(999, mode)).toEqual([0, 999]);
  });

  it('rejects all-zero weights', () => {
    const mode: SplitMode = {
      kind: 'shares',
      weights: [alloc('a', 0), alloc('b', 0)],
    };
    const result = splitExpense(toMoney(100), mode);
    expect(result).toEqual({ ok: false, error: { kind: 'zero-weight-total' } });
  });

  it('rejects negative and fractional weights', () => {
    for (const value of [-1, 1.5, NaN]) {
      const mode: SplitMode = {
        kind: 'shares',
        weights: [alloc('a', value), alloc('b', 1)],
      };
      const result = splitExpense(toMoney(100), mode);
      expect(result).toEqual({
        ok: false,
        error: { kind: 'invalid-value', participant: 'a' },
      });
    }
  });
});

describe('exact split', () => {
  it('returns the given amounts when they sum to the total', () => {
    const mode: SplitMode = {
      kind: 'exact',
      amounts: [alloc('b', 700), alloc('a', 300)],
    };
    expect(amounts(1000, mode)).toEqual([300, 700]);
  });

  it('rejects amounts that do not sum to the total', () => {
    const mode: SplitMode = {
      kind: 'exact',
      amounts: [alloc('a', 300), alloc('b', 600)],
    };
    expect(splitExpense(toMoney(1000), mode)).toEqual({
      ok: false,
      error: { kind: 'exact-sum-mismatch', expected: 1000, actual: 900 },
    });
  });

  it('accepts a zero total with zero amounts', () => {
    const mode: SplitMode = { kind: 'exact', amounts: [alloc('a', 0)] };
    expect(amounts(0, mode)).toEqual([0]);
  });
});

describe('percent split', () => {
  it('splits by basis points', () => {
    const mode: SplitMode = {
      kind: 'percent',
      basisPoints: [alloc('a', 2550), alloc('b', 7450)],
    };
    expect(amounts(10000, mode)).toEqual([2550, 7450]);
  });

  it('rounds so the shares still sum to the total', () => {
    const mode: SplitMode = {
      kind: 'percent',
      basisPoints: [alloc('a', 3333), alloc('b', 3333), alloc('c', 3334)],
    };
    const result = amounts(1001, mode);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1001);
  });

  it('rejects percentages that do not total 100 %', () => {
    const mode: SplitMode = {
      kind: 'percent',
      basisPoints: [alloc('a', 5000), alloc('b', 4000)],
    };
    expect(splitExpense(toMoney(100), mode)).toEqual({
      ok: false,
      error: { kind: 'percent-sum-mismatch', actual: 9000 },
    });
  });
});

describe('validation', () => {
  it('rejects a negative total', () => {
    expect(splitExpense(toMoney(-1), equal('a'))).toEqual({
      ok: false,
      error: { kind: 'negative-total' },
    });
  });

  it('rejects an empty participant list in every mode', () => {
    const modes: SplitMode[] = [
      equal(),
      { kind: 'shares', weights: [] },
      { kind: 'exact', amounts: [] },
      { kind: 'percent', basisPoints: [] },
    ];
    for (const mode of modes) {
      expect(splitExpense(toMoney(0), mode)).toEqual({
        ok: false,
        error: { kind: 'no-participants' },
      });
    }
  });

  it('rejects duplicate participants', () => {
    expect(splitExpense(toMoney(100), equal('a', 'a'))).toEqual({
      ok: false,
      error: { kind: 'duplicate-participant', participant: 'a' },
    });
  });
});

describe('invariants', () => {
  it('shares always sum to the total, for many totals and weightings', () => {
    const weightings = [
      [1, 1, 1],
      [1, 2, 3],
      [7, 11, 13, 17],
      [1, 0, 5],
      [3333, 3333, 3334],
    ];
    for (const weights of weightings) {
      const mode: SplitMode = {
        kind: 'shares',
        weights: weights.map((w, i) => alloc(`p${i}`, w)),
      };
      for (let total = 0; total <= 500; total++) {
        const result = splitExpense(toMoney(total), mode);
        expect(result.ok && sumMoney(result.value.map((s) => s.amount))).toBe(
          total,
        );
      }
    }
  });

  it('is deterministic', () => {
    const mode = equal('x', 'y', 'z');
    expect(splitExpense(toMoney(1001), mode)).toEqual(
      splitExpense(toMoney(1001), mode),
    );
  });
});
