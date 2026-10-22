import { describe, expect, it } from 'vitest';
import { toMoney } from '../../src/core/money';
import { expenseShares, totalExpenses } from '../../src/core/totals';

const items = (...amounts: number[]) =>
  amounts.map((a) => ({ amount: toMoney(a) }));

describe('totalExpenses', () => {
  it('is zero for an empty group', () => {
    expect(totalExpenses([])).toBe(0);
  });

  it('sums amounts exactly in öre', () => {
    expect(totalExpenses(items(10000, 4550, 1))).toBe(14551);
  });

  it('handles zero and very large amounts', () => {
    expect(totalExpenses(items(0, 0))).toBe(0);
    expect(totalExpenses(items(1_000_000_000_000, 1_000_000_000_000))).toBe(
      2_000_000_000_000,
    );
  });
});

describe('expenseShares', () => {
  it('returns nothing for no expenses', () => {
    expect(expenseShares([])).toEqual([]);
  });

  it('returns zeros when the total is zero', () => {
    expect(expenseShares(items(0, 0))).toEqual([0, 0]);
  });

  it('computes basis points of the total', () => {
    expect(expenseShares(items(7500, 2500))).toEqual([7500, 2500]);
  });

  it('rounds down and never exceeds 10000 in total', () => {
    const shares = expenseShares(items(100, 100, 100));
    expect(shares).toEqual([3333, 3333, 3333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10000);
  });

  it('does not overflow with very large amounts', () => {
    expect(expenseShares(items(1_000_000_000_000, 1_000_000_000_000))).toEqual([
      5000, 5000,
    ]);
  });
});
