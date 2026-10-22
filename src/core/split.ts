import { toMoney, sumMoney } from './money';
import { compareIds, err, ok } from './types';
import type { Money, ParticipantId, Result } from './types';

/** Basis points: 10000 = 100 %. Integers avoid floating point percentages. */
export const BASIS_POINTS_TOTAL = 10000;

export type Allocation = {
  readonly participant: ParticipantId;
  readonly value: number;
};

export type SplitMode =
  | { readonly kind: 'equal'; readonly participants: readonly ParticipantId[] }
  | { readonly kind: 'shares'; readonly weights: readonly Allocation[] }
  | { readonly kind: 'exact'; readonly amounts: readonly Allocation[] }
  | { readonly kind: 'percent'; readonly basisPoints: readonly Allocation[] };

export type Share = {
  readonly participant: ParticipantId;
  readonly amount: Money;
};

export type SplitError =
  | { readonly kind: 'negative-total' }
  | { readonly kind: 'no-participants' }
  | {
      readonly kind: 'duplicate-participant';
      readonly participant: ParticipantId;
    }
  | { readonly kind: 'invalid-value'; readonly participant: ParticipantId }
  | { readonly kind: 'zero-weight-total' }
  | {
      readonly kind: 'exact-sum-mismatch';
      readonly expected: Money;
      readonly actual: Money;
    }
  | { readonly kind: 'percent-sum-mismatch'; readonly actual: number };

/** Checks ids and values, and returns the allocations ordered by participant id. */
const validateAllocations = (
  allocations: readonly Allocation[],
): Result<readonly Allocation[], SplitError> => {
  if (allocations.length === 0) return err({ kind: 'no-participants' });
  const seen = new Set<ParticipantId>();
  for (const { participant, value } of allocations) {
    if (seen.has(participant))
      return err({ kind: 'duplicate-participant', participant });
    seen.add(participant);
    if (!Number.isSafeInteger(value) || value < 0) {
      return err({ kind: 'invalid-value', participant });
    }
  }
  return ok(
    [...allocations].sort((a, b) => compareIds(a.participant, b.participant)),
  );
};

/**
 * Distributes `total` proportionally to the weights using the largest remainder method.
 * Each share is floor(total * weight / weightSum); the öre left over go one each to the
 * participants with the largest fractional remainder, ties broken by ascending participant id.
 * BigInt keeps the intermediate products exact for very large amounts.
 * `sorted` must already be ordered by participant id.
 */
const distributeProportionally = (
  total: Money,
  sorted: readonly Allocation[],
): Result<readonly Share[], SplitError> => {
  const weightSum = sorted.reduce((sum, a) => sum + BigInt(a.value), 0n);
  if (weightSum === 0n) return err({ kind: 'zero-weight-total' });

  const bigTotal = BigInt(total);
  const parts = sorted.map((a, index) => {
    const product = bigTotal * BigInt(a.value);
    return { index, base: product / weightSum, remainder: product % weightSum };
  });
  const leftover = Number(
    bigTotal - parts.reduce((sum, p) => sum + p.base, 0n),
  );

  const bonusIndexes = new Set(
    [...parts]
      .sort((a, b) =>
        a.remainder === b.remainder
          ? a.index - b.index
          : a.remainder > b.remainder
            ? -1
            : 1,
      )
      .slice(0, leftover)
      .map((p) => p.index),
  );

  return ok(
    parts.map((p) => ({
      participant: sorted[p.index]!.participant,
      amount: toMoney(Number(p.base) + (bonusIndexes.has(p.index) ? 1 : 0)),
    })),
  );
};

/**
 * Splits an expense among participants. The returned shares are ordered by participant id and
 * always sum to exactly `total`.
 */
export const splitExpense = (
  total: Money,
  mode: SplitMode,
): Result<readonly Share[], SplitError> => {
  if (total < 0) return err({ kind: 'negative-total' });

  switch (mode.kind) {
    case 'equal': {
      const valid = validateAllocations(
        mode.participants.map((participant) => ({ participant, value: 1 })),
      );
      return valid.ok ? distributeProportionally(total, valid.value) : valid;
    }
    case 'shares': {
      const valid = validateAllocations(mode.weights);
      return valid.ok ? distributeProportionally(total, valid.value) : valid;
    }
    case 'percent': {
      const valid = validateAllocations(mode.basisPoints);
      if (!valid.ok) return valid;
      const actual = valid.value.reduce((sum, a) => sum + a.value, 0);
      if (actual !== BASIS_POINTS_TOTAL)
        return err({ kind: 'percent-sum-mismatch', actual });
      return distributeProportionally(total, valid.value);
    }
    case 'exact': {
      const valid = validateAllocations(mode.amounts);
      if (!valid.ok) return valid;
      const shares = valid.value.map((a) => ({
        participant: a.participant,
        amount: toMoney(a.value),
      }));
      const actual = sumMoney(shares.map((s) => s.amount));
      if (actual !== total)
        return err({ kind: 'exact-sum-mismatch', expected: total, actual });
      return ok(shares);
    }
  }
};
