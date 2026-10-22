import type { ExpenseId } from '../../src/core/balances';
import { toMoney } from '../../src/core/money';
import type { ParticipantId } from '../../src/core/types';
import type { AppState } from '../../src/state/model';

export const sampleState: AppState = {
  version: 1,
  participants: [
    { id: 'p1' as ParticipantId, name: 'Anna' },
    { id: 'p2' as ParticipantId, name: 'Björn' },
    { id: 'p3' as ParticipantId, name: 'Cecilia' },
  ],
  expenses: [
    {
      id: 'e1' as ExpenseId,
      description: 'Middag',
      amount: toMoney(10000),
      payer: 'p1' as ParticipantId,
      split: {
        kind: 'equal',
        participants: ['p1', 'p2', 'p3'] as ParticipantId[],
      },
    },
    {
      id: 'e2' as ExpenseId,
      description: 'Taxi',
      amount: toMoney(4550),
      payer: 'p2' as ParticipantId,
      split: {
        kind: 'percent',
        basisPoints: [
          { participant: 'p1' as ParticipantId, value: 5000 },
          { participant: 'p3' as ParticipantId, value: 5000 },
        ],
      },
    },
  ],
};

/** A deep copy that tests can mutate freely before feeding it to the parser. */
export const cloneRaw = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(sampleState)) as Record<string, unknown>;
