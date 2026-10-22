import { sumMoney } from './money';
import type { Money } from './types';

type HasAmount = { readonly amount: Money };

/** Total of all expense amounts. */
export const totalExpenses = (expenses: readonly HasAmount[]): Money =>
  sumMoney(expenses.map((e) => e.amount));

/**
 * Each expense's share of the total in basis points (100 % = 10000), rounded down. Uses BigInt
 * so large amounts cannot overflow. Returns zeros when the total is zero. The shares may sum to
 * slightly less than 10000 because of rounding; they are for display only.
 */
export const expenseShares = (expenses: readonly HasAmount[]): number[] => {
  const total = BigInt(totalExpenses(expenses));
  return expenses.map((e) =>
    total === 0n ? 0 : Number((BigInt(e.amount) * 10000n) / total),
  );
};
