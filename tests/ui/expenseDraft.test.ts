import { describe, expect, it } from 'vitest';
import type { ParticipantId } from '../../src/core/types';
import { buildExpense } from '../../src/ui/expenseDraft';
import type { ExpenseDraft } from '../../src/ui/expenseDraft';

const ids = ['p1', 'p2', 'p3'] as ParticipantId[];

const draft = (overrides: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  description: 'Middag',
  amount: '100',
  payer: 'p1' as ParticipantId,
  kind: 'equal',
  included: ids,
  values: {},
  ...overrides,
});

describe('buildExpense', () => {
  it('builds an equal split from the included participants, in group order', () => {
    const result = buildExpense(draft({ included: [ids[2]!, ids[0]!] }), ids);
    expect(result).toEqual({
      ok: true,
      value: {
        description: 'Middag',
        amount: 10000,
        payer: 'p1',
        split: { kind: 'equal', participants: ['p1', 'p3'] },
      },
    });
  });

  it('reports no sharers when nobody is included', () => {
    expect(buildExpense(draft({ included: [] }), ids)).toEqual({
      ok: false,
      error: 'no-sharers',
    });
  });

  it('reports an invalid amount', () => {
    for (const amount of ['', 'abc', '-1', '1,234']) {
      expect(buildExpense(draft({ amount }), ids)).toEqual({
        ok: false,
        error: 'invalid-amount',
      });
    }
  });

  it('builds shares from whole numbers and skips blank participants', () => {
    const result = buildExpense(
      draft({ kind: 'shares', values: { p1: '1', p2: '', p3: '2' } }),
      ids,
    );
    expect(result.ok && result.value.split).toEqual({
      kind: 'shares',
      weights: [
        { participant: 'p1', value: 1 },
        { participant: 'p3', value: 2 },
      ],
    });
  });

  it('builds exact amounts in öre', () => {
    const result = buildExpense(
      draft({ kind: 'exact', values: { p1: '60,50', p2: '39,5' } }),
      ids,
    );
    expect(result.ok && result.value.split).toEqual({
      kind: 'exact',
      amounts: [
        { participant: 'p1', value: 6050 },
        { participant: 'p2', value: 3950 },
      ],
    });
  });

  it('builds percentages in basis points', () => {
    const result = buildExpense(
      draft({ kind: 'percent', values: { p1: '33,33', p2: '66,67' } }),
      ids,
    );
    expect(result.ok && result.value.split).toEqual({
      kind: 'percent',
      basisPoints: [
        { participant: 'p1', value: 3333 },
        { participant: 'p2', value: 6667 },
      ],
    });
  });

  it('reports malformed per-person values', () => {
    expect(
      buildExpense(draft({ kind: 'shares', values: { p1: '1,5' } }), ids),
    ).toEqual({
      ok: false,
      error: 'invalid-value',
    });
    expect(
      buildExpense(draft({ kind: 'exact', values: { p1: 'x' } }), ids),
    ).toEqual({
      ok: false,
      error: 'invalid-value',
    });
  });

  it('reports no sharers when every per-person value is blank', () => {
    expect(buildExpense(draft({ kind: 'percent', values: {} }), ids)).toEqual({
      ok: false,
      error: 'no-sharers',
    });
  });
});
