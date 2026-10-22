import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { LIMITS, emptyState } from '../../src/state/model';
import {
  HARD_LIMIT_LENGTH,
  MAX_JSON_BYTES,
  SOFT_LIMIT_LENGTH,
  decodeState,
  encodeState,
  isOverSoftLimit,
  loadFromHash,
} from '../../src/state/url';
import { sampleState } from './fixtures';

const encodeRaw = (value: unknown): string => {
  // Reuse the real encoder's alphabet by encoding a state-shaped wrapper is not possible for
  // arbitrary JSON, so build the base64url text here from raw bytes.
  const bytes = deflateSync(strToU8(JSON.stringify(value)));
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

describe('encodeState / decodeState', () => {
  it('round-trips a state', () => {
    expect(decodeState(encodeState(sampleState))).toEqual({
      ok: true,
      value: sampleState,
    });
  });

  it('round-trips the empty state', () => {
    expect(decodeState(encodeState(emptyState))).toEqual({
      ok: true,
      value: emptyState,
    });
  });

  it('round-trips non-ASCII names', () => {
    const state = {
      ...sampleState,
      participants: [{ id: 'p1', name: 'Åsa Öberg 🙂' }],
      expenses: [],
    } as unknown as typeof sampleState;
    expect(decodeState(encodeState(state))).toEqual({ ok: true, value: state });
  });

  it('produces URL-safe output only', () => {
    expect(encodeState(sampleState)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('accepts a leading #', () => {
    expect(decodeState(`#${encodeState(sampleState)}`).ok).toBe(true);
  });

  it('matches the base64url encoding of the compressed JSON', () => {
    expect(encodeState(sampleState)).toBe(encodeRaw(sampleState));
  });

  it('starts the serialized JSON with the version field', () => {
    expect(JSON.stringify(sampleState).startsWith('{"version":1,')).toBe(true);
  });
});

describe('corrupt input', () => {
  it('rejects characters outside the base64url alphabet', () => {
    expect(decodeState('abc+/=')).toEqual({
      ok: false,
      error: { kind: 'corrupt' },
    });
    expect(decodeState('hello world')).toEqual({
      ok: false,
      error: { kind: 'corrupt' },
    });
  });

  it('rejects an impossible base64 length', () => {
    expect(decodeState('A')).toEqual({ ok: false, error: { kind: 'corrupt' } });
  });

  it('rejects valid base64 that is not compressed data', () => {
    expect(decodeState('AAAAAAAA').ok).toBe(false);
  });

  it('rejects truncated data', () => {
    const encoded = encodeState(sampleState);
    expect(decodeState(encoded.slice(0, encoded.length - 12)).ok).toBe(false);
  });

  it('rejects compressed data that is not JSON', () => {
    const encoded = Buffer.from(deflateSync(strToU8('not json'))).toString(
      'base64url',
    );
    expect(decodeState(encoded)).toEqual({
      ok: false,
      error: { kind: 'corrupt' },
    });
  });

  it('rejects JSON that is not a valid state', () => {
    expect(
      decodeState(
        encodeRaw({ version: 1, participants: 'nope', expenses: [] }),
      ),
    ).toEqual({
      ok: false,
      error: { kind: 'invalid', path: 'participants' },
    });
  });

  it('rejects an unsupported version with a specific error', () => {
    expect(decodeState(encodeRaw({ version: 7 }))).toEqual({
      ok: false,
      error: { kind: 'unsupported-version', version: 7 },
    });
  });

  it('rejects oversized hashes before decoding', () => {
    expect(decodeState('A'.repeat(HARD_LIMIT_LENGTH + 1))).toEqual({
      ok: false,
      error: { kind: 'too-long' },
    });
  });

  it('never throws on random garbage', () => {
    for (let i = 0; i < 200; i++) {
      const garbage = Array.from(
        { length: i },
        (_, j) => 'AZaz09-_'[(i * 7 + j * 13) % 8],
      ).join('');
      expect(() => decodeState(garbage)).not.toThrow();
    }
  });
});

describe('loadFromHash', () => {
  it('treats an empty hash as a fresh start without error', () => {
    expect(loadFromHash('')).toEqual({ state: emptyState });
    expect(loadFromHash('#')).toEqual({ state: emptyState });
  });

  it('loads a valid hash', () => {
    expect(loadFromHash(`#${encodeState(sampleState)}`)).toEqual({
      state: sampleState,
    });
  });

  it('falls back to an empty state and reports the error for a corrupt hash', () => {
    expect(loadFromHash('#%%%')).toEqual({
      state: emptyState,
      error: { kind: 'corrupt' },
    });
  });
});

describe('size limit', () => {
  it('flags links above the soft limit', () => {
    expect(isOverSoftLimit('a'.repeat(SOFT_LIMIT_LENGTH))).toBe(false);
    expect(isOverSoftLimit('a'.repeat(SOFT_LIMIT_LENGTH + 1))).toBe(true);
  });

  it('keeps a realistic group well below the soft limit', () => {
    const participants = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Person ${i + 1}`,
    }));
    const expenses = Array.from({ length: 25 }, (_, i) => ({
      id: `e${i + 1}`,
      description: `Utgift nummer ${i + 1}`,
      amount: 10000 + i * 137,
      payer: `p${(i % 6) + 1}`,
      split: { kind: 'equal', participants: participants.map((p) => p.id) },
    }));
    const state = {
      version: 1,
      participants,
      expenses,
    } as unknown as typeof sampleState;
    expect(encodeState(state).length).toBeLessThan(SOFT_LIMIT_LENGTH);
  });
});

describe('limits are consistent', () => {
  /** Deterministic pseudo-random text, so the data is as incompressible as real text gets. */
  const randomText = (length: number, seed: number): string => {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 åäö';
    let x = seed;
    let out = '';
    for (let i = 0; i < length; i++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      out += chars[x % chars.length];
    }
    return out.trim().padEnd(length, 'x');
  };

  const largestAllowedState = () => {
    const participants = Array.from(
      { length: LIMITS.maxParticipants },
      (_, i) => ({
        id: `p${i + 1}`,
        name: randomText(LIMITS.maxNameLength, i + 1),
      }),
    );
    const expenses = Array.from({ length: LIMITS.maxExpenses }, (_, i) => ({
      id: `e${i + 1}`,
      description: randomText(LIMITS.maxDescriptionLength, 1000 + i),
      amount: LIMITS.maxMoney - i * 7919,
      payer: 'p1',
      split: {
        kind: 'exact',
        amounts: participants.map((p, j) => ({
          participant: p.id,
          value: j === 0 ? 0 : 1 + ((i * 7919 + j * 104729) % 9999),
        })),
      },
    }));
    // The first participant's share is whatever makes the exact amounts add up.
    for (const e of expenses) {
      const rest = e.split.amounts
        .slice(1)
        .reduce((sum, a) => sum + a.value, 0);
      e.amount = rest;
      e.split.amounts[0]!.value = 0;
    }
    return {
      version: 1,
      participants,
      expenses,
    } as unknown as typeof sampleState;
  };

  it('can open every link the app can create, up to the allowed maximum size', () => {
    const state = largestAllowedState();
    const encoded = encodeState(state);
    expect(encoded.length).toBeLessThan(HARD_LIMIT_LENGTH);
    expect(decodeState(encoded)).toEqual({ ok: true, value: state });
  });

  it('keeps the largest allowed state below the decompression bound', () => {
    expect(JSON.stringify(largestAllowedState()).length).toBeLessThan(
      MAX_JSON_BYTES,
    );
  });

  it('rejects a small link that would decompress to a huge payload', () => {
    const bomb = Buffer.from(
      deflateSync(new Uint8Array(20 * 1024 * 1024)),
    ).toString('base64url');
    expect(bomb.length).toBeLessThan(HARD_LIMIT_LENGTH);
    expect(decodeState(bomb)).toEqual({
      ok: false,
      error: { kind: 'too-long' },
    });
  });
});
