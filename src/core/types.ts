/**
 * A monetary amount, always a safe integer counted in öre (1 SEK = 100 öre), so 123.45 SEK is
 * stored as 12345. Integers avoid floating point errors. Create with `toMoney()`.
 */
export type Money = number & { readonly __brand: 'Money' };

export type ParticipantId = string & { readonly __brand: 'ParticipantId' };

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Total order on ids (plain code-unit comparison, so it is locale independent). */
export const compareIds = (a: ParticipantId, b: ParticipantId): number =>
  a < b ? -1 : a > b ? 1 : 0;
