import type { Expense } from '../core/balances';
import type { ParticipantId } from '../core/types';

/** Version of the serialized format. Bump it, and add a migration, whenever the format changes. */
export const CURRENT_VERSION = 1;

/**
 * Limits enforced when data enters the app (URL, user input). They keep shared links at a
 * practical size and make arithmetic on untrusted amounts safe from overflow.
 */
export const LIMITS = {
  maxParticipants: 30,
  maxExpenses: 200,
  maxNameLength: 40,
  maxDescriptionLength: 60,
  /** Largest single amount: 10 billion SEK, in öre. 200 of them still fit in a safe integer. */
  maxMoney: 1_000_000_000_000,
} as const;

export type Participant = {
  readonly id: ParticipantId;
  readonly name: string;
};

/** An expense as stored in the state: the core expense plus a description. */
export type ExpenseEntry = Expense & {
  readonly description: string;
};

/** `version` is deliberately the first field of the serialized JSON. */
export type AppState = {
  readonly version: typeof CURRENT_VERSION;
  readonly participants: readonly Participant[];
  readonly expenses: readonly ExpenseEntry[];
};

export const emptyState: AppState = {
  version: CURRENT_VERSION,
  participants: [],
  expenses: [],
};

export type ParseError =
  | { readonly kind: 'corrupt' }
  | { readonly kind: 'too-long' }
  | { readonly kind: 'unsupported-version'; readonly version: unknown }
  | { readonly kind: 'invalid'; readonly path: string };
