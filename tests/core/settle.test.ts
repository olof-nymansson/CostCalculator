import { describe, expect, it } from 'vitest';
import type { Balance } from '../../src/core/balances';
import { toMoney } from '../../src/core/money';
import { settle } from '../../src/core/settle';
import type { Transfer } from '../../src/core/settle';
import { pid } from './helpers';

const balances = (entries: Record<string, number>): Balance[] =>
  Object.entries(entries).map(([participant, amount]) => ({
    participant: pid(participant),
    amount: toMoney(amount),
  }));

const transfersOf = (entries: Record<string, number>): readonly Transfer[] => {
  const result = settle(balances(entries));
  if (!result.ok) throw new Error('settle failed');
  return result.value;
};

/** Applies transfers to the balances and returns the resulting balance per participant. */
const applyTransfers = (
  entries: Record<string, number>,
  transfers: readonly Transfer[],
): Record<string, number> => {
  const result = { ...entries };
  for (const t of transfers) {
    result[t.from] = (result[t.from] ?? 0) + t.amount;
    result[t.to] = (result[t.to] ?? 0) - t.amount;
  }
  return result;
};

describe('settle', () => {
  it('returns no transfers for an empty group', () => {
    expect(transfersOf({})).toEqual([]);
  });

  it('returns no transfers when everyone is at 0', () => {
    expect(transfersOf({ a: 0, b: 0 })).toEqual([]);
  });

  it('settles a single debt with one transfer', () => {
    expect(transfersOf({ a: 500, b: -500 })).toEqual([
      { from: 'b', to: 'a', amount: 500 },
    ]);
  });

  it('matches the largest debtor with the largest creditor first', () => {
    const transfers = transfersOf({ a: 700, b: 300, c: -200, d: -800 });
    expect(transfers).toEqual([
      { from: 'd', to: 'a', amount: 700 },
      { from: 'c', to: 'b', amount: 200 },
      { from: 'd', to: 'b', amount: 100 },
    ]);
  });

  it('breaks ties by ascending participant id', () => {
    const transfers = transfersOf({ a: 100, b: 100, c: -100, d: -100 });
    expect(transfers).toEqual([
      { from: 'c', to: 'a', amount: 100 },
      { from: 'd', to: 'b', amount: 100 },
    ]);
  });

  it('brings every balance to 0', () => {
    const entries = { a: 1234, b: -34, c: -1000, d: 500, e: -700 };
    const after = applyTransfers(entries, transfersOf(entries));
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it('uses at most participants - 1 transfers and only positive amounts', () => {
    const entries = { a: 1234, b: -34, c: -1000, d: 500, e: -700 };
    const transfers = transfersOf(entries);
    expect(transfers.length).toBeLessThanOrEqual(
      Object.keys(entries).length - 1,
    );
    expect(transfers.every((t) => t.amount > 0 && t.from !== t.to)).toBe(true);
  });

  it('is deterministic regardless of input order', () => {
    const forward = transfersOf({ a: 300, b: -100, c: -200 });
    const reversed = transfersOf({ c: -200, b: -100, a: 300 });
    expect(reversed).toEqual(forward);
  });

  it('does not mutate its input', () => {
    const input = balances({ a: 300, b: -300 });
    const copy = input.map((b) => ({ ...b }));
    settle(input);
    expect(input).toEqual(copy);
  });

  it('rejects balances that do not sum to 0', () => {
    expect(settle(balances({ a: 100, b: -50 }))).toEqual({
      ok: false,
      error: { kind: 'unbalanced', sum: 50 },
    });
  });
});
