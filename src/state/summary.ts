import { computeBalances } from '../core/balances';
import type { Balance } from '../core/balances';
import { settle } from '../core/settle';
import type { Transfer } from '../core/settle';
import type { AppState } from './model';

export type Summary = {
  readonly balances: readonly Balance[];
  readonly transfers: readonly Transfer[];
};

/**
 * Balances and suggested transfers for a state. The state has been validated at the boundary, so
 * a failure here is a bug and is thrown rather than shown to the user.
 */
export const summarize = (state: AppState): Summary => {
  const balances = computeBalances(
    state.participants.map((p) => p.id),
    state.expenses,
  );
  if (!balances.ok) throw new Error(`Invalid state: ${balances.error.kind}`);
  const transfers = settle(balances.value);
  if (!transfers.ok)
    throw new Error(`Unbalanced state: ${transfers.error.kind}`);
  return { balances: balances.value, transfers: transfers.value };
};
