import type { ExpenseId } from '../core/balances';
import { splitExpense } from '../core/split';
import type { Allocation, SplitMode } from '../core/split';
import { err, ok } from '../core/types';
import type { ParticipantId, Result } from '../core/types';
import { toMoney } from '../core/money';
import { migrateToCurrent } from './migrate';
import { CURRENT_VERSION, LIMITS } from './model';
import type { AppState, ExpenseEntry, ParseError, Participant } from './model';

type Parsed<T> = Result<T, ParseError>;

const invalid = (path: string): Parsed<never> => err({ kind: 'invalid', path });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ID_PATTERN = /^[A-Za-z0-9_-]{1,12}$/;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && ID_PATTERN.test(value);

const isText = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' &&
  value.trim() === value &&
  value.length >= 1 &&
  value.length <= maxLength;

const isMoneyValue = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= LIMITS.maxMoney;

const parseAllocations = (
  raw: unknown,
  path: string,
): Parsed<readonly Allocation[]> => {
  if (!Array.isArray(raw) || raw.length > LIMITS.maxParticipants)
    return invalid(path);
  const result: Allocation[] = [];
  for (const [index, item] of raw.entries()) {
    if (
      !isRecord(item) ||
      !isId(item.participant) ||
      !isMoneyValue(item.value)
    ) {
      return invalid(`${path}[${index}]`);
    }
    result.push({
      participant: item.participant as ParticipantId,
      value: item.value,
    });
  }
  return ok(result);
};

const parseSplit = (raw: unknown, path: string): Parsed<SplitMode> => {
  if (!isRecord(raw)) return invalid(path);
  switch (raw.kind) {
    case 'equal': {
      const list = raw.participants;
      if (
        !Array.isArray(list) ||
        list.length > LIMITS.maxParticipants ||
        !list.every(isId)
      ) {
        return invalid(`${path}.participants`);
      }
      return ok({ kind: 'equal', participants: list as ParticipantId[] });
    }
    case 'shares': {
      const weights = parseAllocations(raw.weights, `${path}.weights`);
      return weights.ok
        ? ok({ kind: 'shares', weights: weights.value })
        : weights;
    }
    case 'exact': {
      const amounts = parseAllocations(raw.amounts, `${path}.amounts`);
      return amounts.ok
        ? ok({ kind: 'exact', amounts: amounts.value })
        : amounts;
    }
    case 'percent': {
      const basisPoints = parseAllocations(
        raw.basisPoints,
        `${path}.basisPoints`,
      );
      return basisPoints.ok
        ? ok({ kind: 'percent', basisPoints: basisPoints.value })
        : basisPoints;
    }
    default:
      return invalid(`${path}.kind`);
  }
};

const parseParticipants = (raw: unknown): Parsed<readonly Participant[]> => {
  if (!Array.isArray(raw) || raw.length > LIMITS.maxParticipants) {
    return invalid('participants');
  }
  const seen = new Set<string>();
  const result: Participant[] = [];
  for (const [index, item] of raw.entries()) {
    const path = `participants[${index}]`;
    if (!isRecord(item) || !isId(item.id) || seen.has(item.id))
      return invalid(path);
    if (!isText(item.name, LIMITS.maxNameLength))
      return invalid(`${path}.name`);
    seen.add(item.id);
    result.push({ id: item.id as ParticipantId, name: item.name });
  }
  return ok(result);
};

const parseExpenses = (
  raw: unknown,
  participantIds: ReadonlySet<string>,
): Parsed<readonly ExpenseEntry[]> => {
  if (!Array.isArray(raw) || raw.length > LIMITS.maxExpenses)
    return invalid('expenses');
  const seen = new Set<string>();
  const result: ExpenseEntry[] = [];
  for (const [index, item] of raw.entries()) {
    const path = `expenses[${index}]`;
    if (!isRecord(item) || !isId(item.id) || seen.has(item.id))
      return invalid(path);
    if (!isText(item.description, LIMITS.maxDescriptionLength)) {
      return invalid(`${path}.description`);
    }
    if (!isMoneyValue(item.amount)) return invalid(`${path}.amount`);
    if (!isId(item.payer) || !participantIds.has(item.payer))
      return invalid(`${path}.payer`);
    const split = parseSplit(item.split, `${path}.split`);
    if (!split.ok) return split;

    const amount = toMoney(item.amount);
    const shares = splitExpense(amount, split.value);
    if (
      !shares.ok ||
      shares.value.some((s) => !participantIds.has(s.participant))
    ) {
      return invalid(`${path}.split`);
    }
    seen.add(item.id);
    result.push({
      id: item.id as ExpenseId,
      description: item.description,
      amount,
      payer: item.payer as ParticipantId,
      split: split.value,
    });
  }
  return ok(result);
};

/** Validates untrusted data that already has the current version. */
const validateCurrent = (raw: Record<string, unknown>): Parsed<AppState> => {
  const participants = parseParticipants(raw.participants);
  if (!participants.ok) return participants;
  const expenses = parseExpenses(
    raw.expenses,
    new Set(participants.value.map((p) => p.id)),
  );
  if (!expenses.ok) return expenses;
  return ok({
    version: CURRENT_VERSION,
    participants: participants.value,
    expenses: expenses.value,
  });
};

/**
 * The single entry point for untrusted data: migrates old versions to the current one, then
 * validates every field. After this succeeds the state can be trusted everywhere else.
 */
export const parseState = (raw: unknown): Parsed<AppState> => {
  const migrated = migrateToCurrent(raw);
  return migrated.ok ? validateCurrent(migrated.value) : migrated;
};
