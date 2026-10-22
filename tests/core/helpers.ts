import type { Allocation } from '../../src/core/split';
import type { ExpenseId } from '../../src/core/balances';
import type { ParticipantId } from '../../src/core/types';

export const pid = (value: string): ParticipantId => value as ParticipantId;

export const eid = (value: string): ExpenseId => value as ExpenseId;

export const alloc = (participant: string, value: number): Allocation => ({
  participant: pid(participant),
  value,
});
