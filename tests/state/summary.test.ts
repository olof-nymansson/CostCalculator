import { describe, expect, it } from 'vitest';
import { sumMoney } from '../../src/core/money';
import { emptyState } from '../../src/state/model';
import { summarize } from '../../src/state/summary';
import { sampleState } from './fixtures';

describe('summarize', () => {
  it('returns nothing for an empty group', () => {
    expect(summarize(emptyState)).toEqual({ balances: [], transfers: [] });
  });

  it('computes balances that sum to zero and transfers that settle them', () => {
    const { balances, transfers } = summarize(sampleState);
    expect(sumMoney(balances.map((b) => b.amount))).toBe(0);

    const net = new Map(
      balances.map((b) => [b.participant, b.amount as number]),
    );
    for (const t of transfers) {
      net.set(t.from, (net.get(t.from) ?? 0) + t.amount);
      net.set(t.to, (net.get(t.to) ?? 0) - t.amount);
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true);
  });

  it('matches a hand-calculated example', () => {
    // Middag 100,00 paid by p1 split three ways: 33,34 / 33,33 / 33,33
    // Taxi 45,50 paid by p2 split 50/50 between p1 and p3: 22,75 each
    const { balances } = summarize(sampleState);
    expect(balances.map((b) => [b.participant, b.amount])).toEqual([
      ['p1', 10000 - 3334 - 2275],
      ['p2', 4550 - 3333],
      ['p3', -3333 - 2275],
    ]);
  });
});
