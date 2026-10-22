import { ZERO, toMoney, sumMoney } from './money';
import type { Balance } from './balances';
import { compareIds, err, ok } from './types';
import type { Money, ParticipantId, Result } from './types';

export type Transfer = {
  readonly from: ParticipantId;
  readonly to: ParticipantId;
  readonly amount: Money;
};

export type SettleError = { readonly kind: 'unbalanced'; readonly sum: Money };

type Entry = { readonly participant: ParticipantId; remaining: number };

/** Largest remaining amount first; ties broken by ascending participant id. */
const byLargestThenId = (a: Entry, b: Entry): number =>
  b.remaining - a.remaining || compareIds(a.participant, b.participant);

const pickLargest = (entries: Entry[]): Entry | undefined =>
  [...entries].sort(byLargestThenId)[0];

/**
 * Greedy settlement: repeatedly transfers from the largest debtor to the largest creditor
 * until every balance is zero. Deterministic for the same input.
 *
 * Not guaranteed to produce the absolute minimum number of transfers in every case (that
 * problem is NP-hard); it produces at most (participants - 1) transfers.
 */
export const settle = (
  balances: readonly Balance[],
): Result<readonly Transfer[], SettleError> => {
  const sum = sumMoney(balances.map((b) => b.amount));
  if (sum !== ZERO) return err({ kind: 'unbalanced', sum });

  const debtors: Entry[] = balances
    .filter((b) => b.amount < 0)
    .map((b) => ({ participant: b.participant, remaining: -b.amount }));
  const creditors: Entry[] = balances
    .filter((b) => b.amount > 0)
    .map((b) => ({ participant: b.participant, remaining: b.amount }));

  const transfers: Transfer[] = [];
  for (;;) {
    const debtor = pickLargest(debtors);
    const creditor = pickLargest(creditors);
    if (!debtor || !creditor) break;

    const amount = Math.min(debtor.remaining, creditor.remaining);
    transfers.push({
      from: debtor.participant,
      to: creditor.participant,
      amount: toMoney(amount),
    });
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) debtors.splice(debtors.indexOf(debtor), 1);
    if (creditor.remaining === 0)
      creditors.splice(creditors.indexOf(creditor), 1);
  }
  return ok(transfers);
};
