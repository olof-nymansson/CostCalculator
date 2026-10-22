import { ZERO, addMoney, subMoney } from './money';
import { splitExpense } from './split';
import type { SplitError, SplitMode } from './split';
import { compareIds, err, ok } from './types';
import type { Money, ParticipantId, Result } from './types';

export type ExpenseId = string & { readonly __brand: 'ExpenseId' };

export type Expense = {
  readonly id: ExpenseId;
  readonly amount: Money;
  readonly payer: ParticipantId;
  readonly split: SplitMode;
};

/** Positive: the participant is owed money. Negative: the participant owes money. */
export type Balance = {
  readonly participant: ParticipantId;
  readonly amount: Money;
};

export type BalanceError =
  | {
      readonly kind: 'unknown-participant';
      readonly expense: ExpenseId;
      readonly participant: ParticipantId;
    }
  | {
      readonly kind: 'invalid-split';
      readonly expense: ExpenseId;
      readonly cause: SplitError;
    };

/**
 * Computes net balance per participant (paid minus owed), ordered by participant id.
 * Participants without expenses get 0. The balances always sum to exactly 0.
 */
export const computeBalances = (
  participants: readonly ParticipantId[],
  expenses: readonly Expense[],
): Result<readonly Balance[], BalanceError> => {
  const balances = new Map<ParticipantId, Money>(
    participants.map((p) => [p, ZERO]),
  );

  for (const expense of expenses) {
    if (!balances.has(expense.payer)) {
      return err({
        kind: 'unknown-participant',
        expense: expense.id,
        participant: expense.payer,
      });
    }
    const split = splitExpense(expense.amount, expense.split);
    if (!split.ok)
      return err({
        kind: 'invalid-split',
        expense: expense.id,
        cause: split.error,
      });

    for (const share of split.value) {
      if (!balances.has(share.participant)) {
        return err({
          kind: 'unknown-participant',
          expense: expense.id,
          participant: share.participant,
        });
      }
    }

    balances.set(
      expense.payer,
      addMoney(balances.get(expense.payer) ?? ZERO, expense.amount),
    );
    for (const share of split.value) {
      balances.set(
        share.participant,
        subMoney(balances.get(share.participant) ?? ZERO, share.amount),
      );
    }
  }

  return ok(
    [...balances]
      .map(([participant, amount]) => ({ participant, amount }))
      .sort((a, b) => compareIds(a.participant, b.participant)),
  );
};
