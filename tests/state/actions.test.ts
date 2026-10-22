import { describe, expect, it } from 'vitest';
import type { ExpenseId } from '../../src/core/balances';
import type { ParticipantId } from '../../src/core/types';
import { applyAction } from '../../src/state/actions';
import type { Action, NewExpense } from '../../src/state/actions';
import { LIMITS, emptyState } from '../../src/state/model';
import type { AppState } from '../../src/state/model';
import { sampleState } from './fixtures';

const pid = (value: string) => value as ParticipantId;

const run = (state: AppState, action: Action): AppState => {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`rejected: ${result.error}`);
  return result.value;
};

const rejected = (state: AppState, action: Action) => {
  const result = applyAction(state, action);
  return result.ok ? undefined : result.error;
};

const newExpense = (overrides: Partial<NewExpense> = {}): NewExpense => ({
  description: 'Lunch',
  amount: 5000,
  payer: pid('p1'),
  split: { kind: 'equal', participants: [pid('p1'), pid('p2')] },
  ...overrides,
});

describe('participants', () => {
  it('adds participants with sequential ids and trimmed names', () => {
    const one = run(emptyState, { type: 'addParticipant', name: '  Anna ' });
    const two = run(one, { type: 'addParticipant', name: 'Björn' });
    expect(two.participants).toEqual([
      { id: 'p1', name: 'Anna' },
      { id: 'p2', name: 'Björn' },
    ]);
  });

  it('assigns an id one higher than the largest in use', () => {
    const withGap = run(
      {
        ...emptyState,
        participants: [
          { id: pid('p1'), name: 'A' },
          { id: pid('p5'), name: 'B' },
        ],
      },
      { type: 'addParticipant', name: 'C' },
    );
    expect(withGap.participants.map((p) => p.id)).toEqual(['p1', 'p5', 'p6']);
  });

  it('rejects empty and overlong names', () => {
    expect(rejected(emptyState, { type: 'addParticipant', name: '   ' })).toBe(
      'invalid-name',
    );
    expect(
      rejected(emptyState, {
        type: 'addParticipant',
        name: 'x'.repeat(LIMITS.maxNameLength + 1),
      }),
    ).toBe('invalid-name');
  });

  it('rejects duplicate names, ignoring case and surrounding spaces', () => {
    for (const name of ['Anna', 'anna', ' ANNA ']) {
      expect(rejected(sampleState, { type: 'addParticipant', name })).toBe(
        'duplicate-name',
      );
    }
  });

  it("rejects renaming to another participant's name but allows changing own case", () => {
    expect(
      rejected(sampleState, {
        type: 'renameParticipant',
        id: pid('p2'),
        name: 'anna',
      }),
    ).toBe('duplicate-name');
    const renamed = run(sampleState, {
      type: 'renameParticipant',
      id: pid('p1'),
      name: 'ANNA',
    });
    expect(renamed.participants[0]?.name).toBe('ANNA');
  });

  it('enforces the participant limit', () => {
    let state = emptyState;
    for (let i = 0; i < LIMITS.maxParticipants; i++) {
      state = run(state, { type: 'addParticipant', name: `P${i}` });
    }
    expect(
      rejected(state, { type: 'addParticipant', name: 'One too many' }),
    ).toBe('limit-reached');
  });

  it('renames a participant', () => {
    const state = run(sampleState, {
      type: 'renameParticipant',
      id: pid('p2'),
      name: 'Bo',
    });
    expect(state.participants.map((p) => p.name)).toEqual([
      'Anna',
      'Bo',
      'Cecilia',
    ]);
  });

  it('rejects renaming an unknown participant or to an empty name', () => {
    expect(
      rejected(sampleState, {
        type: 'renameParticipant',
        id: pid('p9'),
        name: 'X',
      }),
    ).toBe('unknown-participant');
    expect(
      rejected(sampleState, {
        type: 'renameParticipant',
        id: pid('p1'),
        name: ' ',
      }),
    ).toBe('invalid-name');
  });

  it('removes a participant that is not used', () => {
    const state = run(emptyState, { type: 'addParticipant', name: 'Anna' });
    expect(
      run(state, { type: 'removeParticipant', id: pid('p1') }).participants,
    ).toEqual([]);
  });

  it('refuses to remove a payer or someone who shares an expense', () => {
    expect(
      rejected(sampleState, { type: 'removeParticipant', id: pid('p1') }),
    ).toBe('participant-in-use');
    expect(
      rejected(sampleState, { type: 'removeParticipant', id: pid('p3') }),
    ).toBe('participant-in-use');
  });

  it('refuses to remove an unknown participant', () => {
    expect(
      rejected(sampleState, { type: 'removeParticipant', id: pid('p9') }),
    ).toBe('unknown-participant');
  });
});

describe('expenses', () => {
  const group = sampleState.participants.length;

  it('adds an expense with a sequential id and trimmed description', () => {
    const state = run(sampleState, {
      type: 'addExpense',
      expense: newExpense({ description: ' Lunch ' }),
    });
    expect(state.expenses).toHaveLength(sampleState.expenses.length + 1);
    expect(state.expenses.at(-1)).toMatchObject({
      id: 'e3',
      description: 'Lunch',
      amount: 5000,
    });
    expect(state.participants).toHaveLength(group);
  });

  it('accepts a zero amount', () => {
    expect(
      rejected(sampleState, {
        type: 'addExpense',
        expense: newExpense({ amount: 0 }),
      }),
    ).toBeUndefined();
  });

  it('rejects bad descriptions', () => {
    for (const description of [
      '',
      '  ',
      'x'.repeat(LIMITS.maxDescriptionLength + 1),
    ]) {
      expect(
        rejected(sampleState, {
          type: 'addExpense',
          expense: newExpense({ description }),
        }),
      ).toBe('invalid-description');
    }
  });

  it('rejects bad amounts', () => {
    for (const amount of [-1, 1.5, NaN, LIMITS.maxMoney + 1]) {
      expect(
        rejected(sampleState, {
          type: 'addExpense',
          expense: newExpense({ amount }),
        }),
      ).toBe('invalid-amount');
    }
  });

  it('rejects an unknown payer or an unknown participant in the split', () => {
    expect(
      rejected(sampleState, {
        type: 'addExpense',
        expense: newExpense({ payer: pid('p9') }),
      }),
    ).toBe('unknown-participant');
    const split = { kind: 'equal', participants: [pid('p9')] } as const;
    expect(
      rejected(sampleState, {
        type: 'addExpense',
        expense: newExpense({ split }),
      }),
    ).toBe('unknown-participant');
  });

  it('rejects an invalid split', () => {
    const split = { kind: 'equal', participants: [] } as const;
    expect(
      rejected(sampleState, {
        type: 'addExpense',
        expense: newExpense({ split }),
      }),
    ).toBe('invalid-split');
  });

  it('enforces the expense limit', () => {
    let state = sampleState;
    while (state.expenses.length < LIMITS.maxExpenses) {
      state = run(state, { type: 'addExpense', expense: newExpense() });
    }
    expect(rejected(state, { type: 'addExpense', expense: newExpense() })).toBe(
      'limit-reached',
    );
  });

  it('removes an expense and frees its participants', () => {
    const afterExpenses = ['e1', 'e2'].reduce(
      (state, id) => run(state, { type: 'removeExpense', id: id as ExpenseId }),
      sampleState,
    );
    expect(afterExpenses.expenses).toEqual([]);
    expect(
      run(afterExpenses, { type: 'removeParticipant', id: pid('p1') })
        .participants,
    ).toHaveLength(2);
  });

  it('rejects removing an unknown expense', () => {
    expect(
      rejected(sampleState, { type: 'removeExpense', id: 'e9' as ExpenseId }),
    ).toBe('unknown-expense');
  });
});

describe('purity', () => {
  it('never mutates the previous state', () => {
    const snapshot = JSON.stringify(sampleState);
    run(sampleState, { type: 'addParticipant', name: 'Dan' });
    run(sampleState, { type: 'addExpense', expense: newExpense() });
    run(sampleState, { type: 'removeExpense', id: 'e1' as ExpenseId });
    expect(JSON.stringify(sampleState)).toBe(snapshot);
  });
});
