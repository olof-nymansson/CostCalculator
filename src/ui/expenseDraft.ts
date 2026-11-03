import type { SplitMode } from '../core/split';
import type { ParticipantId } from '../core/types';
import type { NewExpense } from '../state/actions';
import type { ExpenseEntry } from '../state/model';
import { formatScaled, parseScaled, parseWhole } from './amount';

export type SplitKind = SplitMode['kind'];

/** The raw text of the expense form, exactly as the user typed it. */
export type ExpenseDraft = {
  readonly description: string;
  readonly amount: string;
  readonly payer: ParticipantId;
  readonly kind: SplitKind;
  /** Participants ticked in "equal" mode. */
  readonly included: readonly ParticipantId[];
  /** Per-participant text for the other modes. An empty text means "does not share". */
  readonly values: Readonly<Record<string, string>>;
};

/** Scaled integer as editable text ("1234,50"): no thousands separators, so it parses back as is. */
const toInputText = (value: number): string =>
  formatScaled(value).replace(/\s/g, '');

/** The inverse of `buildExpense`: the form text that would produce this expense. */
export const draftFromExpense = (expense: ExpenseEntry): ExpenseDraft => {
  const base = {
    description: expense.description,
    amount: toInputText(expense.amount),
    payer: expense.payer,
  };
  const textOf = (
    allocations: readonly { participant: ParticipantId; value: number }[],
    format: (value: number) => string,
  ): Readonly<Record<string, string>> =>
    Object.fromEntries(
      allocations.map(({ participant, value }) => [participant, format(value)]),
    );

  const { split } = expense;
  switch (split.kind) {
    case 'equal':
      return {
        ...base,
        kind: 'equal',
        included: split.participants,
        values: {},
      };
    case 'shares':
      return {
        ...base,
        kind: 'shares',
        included: [],
        values: textOf(split.weights, String),
      };
    case 'exact':
      return {
        ...base,
        kind: 'exact',
        included: [],
        values: textOf(split.amounts, toInputText),
      };
    case 'percent':
      return {
        ...base,
        kind: 'percent',
        included: [],
        values: textOf(split.basisPoints, toInputText),
      };
  }
};

export type DraftError = 'invalid-amount' | 'invalid-value' | 'no-sharers';

type Entry = { readonly participant: ParticipantId; readonly value: number };

const parseEntries = (
  participants: readonly ParticipantId[],
  values: Readonly<Record<string, string>>,
  parse: (text: string) => number | undefined,
): readonly Entry[] | 'invalid-value' => {
  const entries: Entry[] = [];
  for (const participant of participants) {
    const text = (values[participant] ?? '').trim();
    if (text === '') continue;
    const value = parse(text);
    if (value === undefined) return 'invalid-value';
    entries.push({ participant, value });
  }
  return entries;
};

/**
 * Converts form text into an expense for the state layer. Only checks that the text is
 * well-formed; whether the split adds up is decided by the core when the action is applied.
 */
export const buildExpense = (
  draft: ExpenseDraft,
  participants: readonly ParticipantId[],
):
  | { readonly ok: true; readonly value: NewExpense }
  | { readonly ok: false; readonly error: DraftError } => {
  const amount = parseScaled(draft.amount);
  if (amount === undefined) return { ok: false, error: 'invalid-amount' };

  const base = { description: draft.description, amount, payer: draft.payer };

  if (draft.kind === 'equal') {
    const sharers = participants.filter((p) => draft.included.includes(p));
    if (sharers.length === 0) return { ok: false, error: 'no-sharers' };
    return {
      ok: true,
      value: { ...base, split: { kind: 'equal', participants: sharers } },
    };
  }

  const parse = draft.kind === 'shares' ? parseWhole : parseScaled;
  const entries = parseEntries(participants, draft.values, parse);
  if (entries === 'invalid-value') return { ok: false, error: 'invalid-value' };
  if (entries.length === 0) return { ok: false, error: 'no-sharers' };

  const allocations = entries.map(({ participant, value }) => ({
    participant,
    value,
  }));
  const split: SplitMode =
    draft.kind === 'shares'
      ? { kind: 'shares', weights: allocations }
      : draft.kind === 'exact'
        ? { kind: 'exact', amounts: allocations }
        : { kind: 'percent', basisPoints: allocations };
  return { ok: true, value: { ...base, split } };
};
