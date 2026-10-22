import type { ExpenseId } from '../core/balances';
import { toMoney } from '../core/money';
import { splitExpense } from '../core/split';
import type { SplitMode } from '../core/split';
import { err, ok } from '../core/types';
import type { ParticipantId, Result } from '../core/types';
import { LIMITS } from './model';
import type { AppState } from './model';

export type NewExpense = {
  readonly description: string;
  readonly amount: number;
  readonly payer: ParticipantId;
  readonly split: SplitMode;
};

export type Action =
  | { readonly type: 'addParticipant'; readonly name: string }
  | {
      readonly type: 'renameParticipant';
      readonly id: ParticipantId;
      readonly name: string;
    }
  | { readonly type: 'removeParticipant'; readonly id: ParticipantId }
  | { readonly type: 'addExpense'; readonly expense: NewExpense }
  | { readonly type: 'removeExpense'; readonly id: ExpenseId };

export type ActionError =
  | 'invalid-name'
  | 'duplicate-name'
  | 'invalid-description'
  | 'invalid-amount'
  | 'invalid-split'
  | 'unknown-participant'
  | 'unknown-expense'
  | 'participant-in-use'
  | 'limit-reached';

/** Next id of the form `<prefix><n>`, one higher than the largest number in use. */
const nextId = (prefix: string, existing: readonly string[]): string => {
  const numbers = existing
    .map((id) => Number(id.slice(prefix.length)))
    .filter(Number.isInteger);
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
};

const cleanName = (name: string): string | undefined => {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= LIMITS.maxNameLength
    ? trimmed
    : undefined;
};

/** Names are compared ignoring case, so "anna" and "Anna" count as the same person. */
const isNameTaken = (
  state: AppState,
  name: string,
  ignore?: ParticipantId,
): boolean =>
  state.participants.some(
    (p) => p.id !== ignore && p.name.toLowerCase() === name.toLowerCase(),
  );

const splitParticipants = (split: SplitMode): readonly ParticipantId[] => {
  switch (split.kind) {
    case 'equal':
      return split.participants;
    case 'shares':
      return split.weights.map((a) => a.participant);
    case 'exact':
      return split.amounts.map((a) => a.participant);
    case 'percent':
      return split.basisPoints.map((a) => a.participant);
  }
};

const isUsedInExpenses = (state: AppState, id: ParticipantId): boolean =>
  state.expenses.some(
    (e) => e.payer === id || splitParticipants(e.split).includes(id),
  );

/**
 * Pure state transition. Returns an error instead of a new state when the action is not
 * allowed, so the caller can show a message and keep the old state.
 */
export const applyAction = (
  state: AppState,
  action: Action,
): Result<AppState, ActionError> => {
  switch (action.type) {
    case 'addParticipant': {
      const name = cleanName(action.name);
      if (!name) return err('invalid-name');
      if (isNameTaken(state, name)) return err('duplicate-name');
      if (state.participants.length >= LIMITS.maxParticipants)
        return err('limit-reached');
      const id = nextId(
        'p',
        state.participants.map((p) => p.id),
      ) as ParticipantId;
      return ok({
        ...state,
        participants: [...state.participants, { id, name }],
      });
    }
    case 'renameParticipant': {
      const name = cleanName(action.name);
      if (!name) return err('invalid-name');
      if (!state.participants.some((p) => p.id === action.id))
        return err('unknown-participant');
      if (isNameTaken(state, name, action.id)) return err('duplicate-name');
      return ok({
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, name } : p,
        ),
      });
    }
    case 'removeParticipant': {
      if (!state.participants.some((p) => p.id === action.id))
        return err('unknown-participant');
      if (isUsedInExpenses(state, action.id)) return err('participant-in-use');
      return ok({
        ...state,
        participants: state.participants.filter((p) => p.id !== action.id),
      });
    }
    case 'addExpense': {
      const { expense } = action;
      const description = expense.description.trim();
      if (
        description.length < 1 ||
        description.length > LIMITS.maxDescriptionLength
      ) {
        return err('invalid-description');
      }
      if (
        !Number.isSafeInteger(expense.amount) ||
        expense.amount < 0 ||
        expense.amount > LIMITS.maxMoney
      ) {
        return err('invalid-amount');
      }
      if (state.expenses.length >= LIMITS.maxExpenses)
        return err('limit-reached');

      const known = new Set(state.participants.map((p) => p.id));
      const involved = [expense.payer, ...splitParticipants(expense.split)];
      if (!involved.every((id) => known.has(id)))
        return err('unknown-participant');

      const amount = toMoney(expense.amount);
      if (!splitExpense(amount, expense.split).ok) return err('invalid-split');

      const id = nextId(
        'e',
        state.expenses.map((e) => e.id),
      ) as ExpenseId;
      return ok({
        ...state,
        expenses: [
          ...state.expenses,
          {
            id,
            description,
            amount,
            payer: expense.payer,
            split: expense.split,
          },
        ],
      });
    }
    case 'removeExpense': {
      if (!state.expenses.some((e) => e.id === action.id))
        return err('unknown-expense');
      return ok({
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      });
    }
  }
};
