import { describe, expect, it } from 'vitest';
import { computeBalances } from '../../src/core/balances';
import type { Expense } from '../../src/core/balances';
import { toMoney, sumMoney } from '../../src/core/money';
import type { SplitMode } from '../../src/core/split';
import { eid, pid } from './helpers';

const equal = (...ids: string[]): SplitMode => ({
  kind: 'equal',
  participants: ids.map(pid),
});

const expense = (
  id: string,
  amount: number,
  payer: string,
  split: SplitMode,
): Expense => ({
  id: eid(id),
  amount: toMoney(amount),
  payer: pid(payer),
  split,
});

const balancesOf = (participants: string[], expenses: Expense[]) => {
  const result = computeBalances(participants.map(pid), expenses);
  if (!result.ok) throw new Error(`balances failed: ${result.error.kind}`);
  return result.value;
};

describe('computeBalances', () => {
  it('returns an empty list for an empty group', () => {
    expect(balancesOf([], [])).toEqual([]);
  });

  it('gives participants without expenses a balance of 0', () => {
    expect(balancesOf(['b', 'a'], [])).toEqual([
      { participant: 'a', amount: 0 },
      { participant: 'b', amount: 0 },
    ]);
  });

  it('credits the payer and debits the sharers', () => {
    const balances = balancesOf(
      ['a', 'b', 'c'],
      [expense('e1', 9000, 'a', equal('a', 'b', 'c'))],
    );
    expect(balances.map((b) => b.amount)).toEqual([6000, -3000, -3000]);
  });

  it('handles a payer who does not share the expense', () => {
    const balances = balancesOf(
      ['a', 'b'],
      [expense('e1', 1000, 'a', equal('b'))],
    );
    expect(balances.map((b) => b.amount)).toEqual([1000, -1000]);
  });

  it('leaves a participant at 0 when they are not part of any split and paid nothing', () => {
    const balances = balancesOf(
      ['a', 'b', 'c'],
      [expense('e1', 1000, 'a', equal('a', 'b'))],
    );
    expect(balances.find((b) => b.participant === 'c')?.amount).toBe(0);
  });

  it('handles zero-amount expenses', () => {
    const balances = balancesOf(
      ['a', 'b'],
      [expense('e1', 0, 'a', equal('a', 'b'))],
    );
    expect(balances.map((b) => b.amount)).toEqual([0, 0]);
  });

  it('accumulates several expenses', () => {
    const balances = balancesOf(
      ['a', 'b'],
      [
        expense('e1', 1000, 'a', equal('a', 'b')),
        expense('e2', 600, 'b', equal('a', 'b')),
      ],
    );
    expect(balances.map((b) => b.amount)).toEqual([200, -200]);
  });

  it('always sums to exactly 0, including with uneven splits', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const expenses = [
      expense('e1', 10000, 'a', equal('a', 'b', 'c')),
      expense('e2', 1001, 'b', equal('a', 'b', 'c', 'd')),
      expense('e3', 7, 'c', {
        kind: 'shares',
        weights: [
          { participant: pid('a'), value: 2 },
          { participant: pid('d'), value: 3 },
        ],
      }),
      expense('e4', 999, 'd', equal('b')),
    ];
    const balances = balancesOf(ids, expenses);
    expect(sumMoney(balances.map((b) => b.amount))).toBe(0);
  });

  it('stays exact for very large amounts', () => {
    const big = 1_000_000_000_000_000;
    const balances = balancesOf(
      ['a', 'b', 'c'],
      [expense('e1', big, 'a', equal('a', 'b', 'c'))],
    );
    expect(sumMoney(balances.map((b) => b.amount))).toBe(0);
  });

  it('reports an unknown payer', () => {
    const result = computeBalances(
      [pid('a')],
      [expense('e1', 100, 'x', equal('a'))],
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown-participant', expense: 'e1', participant: 'x' },
    });
  });

  it('reports an unknown participant in a split', () => {
    const result = computeBalances(
      [pid('a')],
      [expense('e1', 100, 'a', equal('a', 'x'))],
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown-participant', expense: 'e1', participant: 'x' },
    });
  });

  it('reports an invalid split with the expense id', () => {
    const result = computeBalances(
      [pid('a')],
      [expense('e1', 100, 'a', equal())],
    );
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'invalid-split',
        expense: 'e1',
        cause: { kind: 'no-participants' },
      },
    });
  });
});
