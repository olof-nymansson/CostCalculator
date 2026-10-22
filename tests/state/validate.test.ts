import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../src/state/model';
import { parseState } from '../../src/state/validate';
import { cloneRaw, sampleState } from './fixtures';

/** Applies a mutation to a fresh raw copy of the sample state and parses it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests poke at untrusted JSON
type Raw = any;

const parseMutated = (mutate: (raw: Raw) => void) => {
  const raw: Raw = cloneRaw();
  mutate(raw);
  return parseState(raw);
};

const expectInvalid = (result: ReturnType<typeof parseState>, path: string) => {
  expect(result).toEqual({ ok: false, error: { kind: 'invalid', path } });
};

describe('parseState', () => {
  it('accepts a valid state unchanged', () => {
    expect(parseState(cloneRaw())).toEqual({ ok: true, value: sampleState });
  });

  it('accepts an empty group', () => {
    const result = parseState({ version: 1, participants: [], expenses: [] });
    expect(result.ok).toBe(true);
  });

  it('rejects things that are not objects', () => {
    for (const raw of [null, undefined, 42, 'text', [], true]) {
      expect(parseState(raw).ok).toBe(false);
    }
  });

  it('rejects an unknown or missing version', () => {
    for (const version of [undefined, 0, 2, '1', 1.5, null]) {
      const result = parseState({ ...cloneRaw(), version });
      expect(result).toEqual({
        ok: false,
        error: { kind: 'unsupported-version', version },
      });
    }
  });

  it('rejects missing or malformed top-level lists', () => {
    expectInvalid(
      parseMutated((r) => delete r.participants),
      'participants',
    );
    expectInvalid(
      parseMutated((r) => (r.expenses = {})),
      'expenses',
    );
  });

  describe('participants', () => {
    it('rejects duplicate ids', () => {
      expectInvalid(
        parseMutated((r) => (r.participants[1].id = 'p1')),
        'participants[1]',
      );
    });

    it('rejects ids with unsafe characters', () => {
      expectInvalid(
        parseMutated((r) => (r.participants[0].id = '<script>')),
        'participants[0]',
      );
    });

    it('rejects empty, padded and overlong names', () => {
      for (const name of [
        '',
        ' Anna',
        'x'.repeat(LIMITS.maxNameLength + 1),
        5,
      ]) {
        expectInvalid(
          parseMutated((r) => (r.participants[0].name = name)),
          'participants[0].name',
        );
      }
    });

    it('rejects too many participants', () => {
      const result = parseMutated((r) => {
        r.participants = Array.from(
          { length: LIMITS.maxParticipants + 1 },
          (_, i) => ({
            id: `q${i}`,
            name: `N${i}`,
          }),
        );
        r.expenses = [];
      });
      expectInvalid(result, 'participants');
    });
  });

  describe('expenses', () => {
    it('rejects duplicate expense ids', () => {
      expectInvalid(
        parseMutated((r) => (r.expenses[1].id = 'e1')),
        'expenses[1]',
      );
    });

    it('rejects a bad description', () => {
      for (const description of [
        '',
        'x'.repeat(LIMITS.maxDescriptionLength + 1),
        null,
      ]) {
        expectInvalid(
          parseMutated((r) => (r.expenses[0].description = description)),
          'expenses[0].description',
        );
      }
    });

    it('rejects fractional, negative, huge and non-numeric amounts', () => {
      for (const amount of [
        1.5,
        -1,
        LIMITS.maxMoney + 1,
        Number.MAX_SAFE_INTEGER,
        '100',
        null,
      ]) {
        expectInvalid(
          parseMutated((r) => (r.expenses[0].amount = amount)),
          'expenses[0].amount',
        );
      }
    });

    it('accepts a zero amount and the maximum amount', () => {
      expect(parseMutated((r) => (r.expenses[0].amount = 0)).ok).toBe(true);
      expect(
        parseMutated((r) => (r.expenses[0].amount = LIMITS.maxMoney)).ok,
      ).toBe(true);
    });

    it('rejects an unknown payer', () => {
      expectInvalid(
        parseMutated((r) => (r.expenses[0].payer = 'p9')),
        'expenses[0].payer',
      );
    });

    it('rejects too many expenses', () => {
      const result = parseMutated((r) => {
        r.expenses = Array.from(
          { length: LIMITS.maxExpenses + 1 },
          () => r.expenses[0],
        );
      });
      expectInvalid(result, 'expenses');
    });
  });

  describe('splits', () => {
    it('rejects an unknown split kind', () => {
      expectInvalid(
        parseMutated((r) => (r.expenses[0].split = { kind: 'magic' })),
        'expenses[0].split.kind',
      );
    });

    it('rejects participants that do not exist', () => {
      expectInvalid(
        parseMutated((r) => (r.expenses[0].split.participants = ['p1', 'p9'])),
        'expenses[0].split',
      );
    });

    it('rejects duplicate participants in a split', () => {
      expectInvalid(
        parseMutated((r) => (r.expenses[0].split.participants = ['p1', 'p1'])),
        'expenses[0].split',
      );
    });

    it('rejects percentages that do not add up to 100 %', () => {
      expectInvalid(
        parseMutated((r) => (r.expenses[1].split.basisPoints[0].value = 1)),
        'expenses[1].split',
      );
    });

    it('rejects exact amounts that do not add up to the expense', () => {
      const result = parseMutated((r) => {
        r.expenses[0].split = {
          kind: 'exact',
          amounts: [
            { participant: 'p1', value: 1 },
            { participant: 'p2', value: 1 },
          ],
        };
      });
      expectInvalid(result, 'expenses[0].split');
    });

    it('rejects all-zero shares', () => {
      const result = parseMutated((r) => {
        r.expenses[0].split = {
          kind: 'shares',
          weights: [{ participant: 'p1', value: 0 }],
        };
      });
      expectInvalid(result, 'expenses[0].split');
    });

    it('rejects malformed allocations', () => {
      for (const weights of [
        [{ participant: 'p1', value: -1 }],
        [{ participant: 'p1' }],
        'x',
      ]) {
        const result = parseMutated((r) => {
          r.expenses[0].split = { kind: 'shares', weights };
        });
        expect(result.ok).toBe(false);
      }
    });

    it('accepts shares and exact splits', () => {
      const result = parseMutated((r) => {
        r.expenses[0].split = {
          kind: 'shares',
          weights: [
            { participant: 'p1', value: 1 },
            { participant: 'p2', value: 2 },
          ],
        };
        r.expenses[1].split = {
          kind: 'exact',
          amounts: [
            { participant: 'p1', value: 4000 },
            { participant: 'p3', value: 550 },
          ],
        };
      });
      expect(result.ok).toBe(true);
    });
  });
});
