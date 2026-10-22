import { describe, expect, it } from 'vitest';
import { migrateToCurrent, migrations } from '../../src/state/migrate';
import type { Migration } from '../../src/state/migrate';

describe('migrateToCurrent', () => {
  it('passes current-version data through untouched', () => {
    const raw = { version: 1, participants: [], expenses: [] };
    expect(migrateToCurrent(raw)).toEqual({ ok: true, value: raw });
  });

  it('registers no migration for the current version', () => {
    expect(migrations[1]).toBeUndefined();
  });

  it('upgrades an old version step by step', () => {
    const table: Record<number, Migration> = {
      1: (raw) => ({ ...raw, version: 2, renamed: raw.oldName }),
      2: (raw) => ({ ...raw, version: 3, extra: true }),
    };
    const result = migrateToCurrent({ version: 1, oldName: 'x' }, table, 3);
    expect(result).toEqual({
      ok: true,
      value: { version: 3, oldName: 'x', renamed: 'x', extra: true },
    });
  });

  it('rejects versions newer than the app understands', () => {
    expect(migrateToCurrent({ version: 99 })).toEqual({
      ok: false,
      error: { kind: 'unsupported-version', version: 99 },
    });
  });

  it('rejects an old version that has no migration', () => {
    expect(migrateToCurrent({ version: 1 }, {}, 2)).toEqual({
      ok: false,
      error: { kind: 'unsupported-version', version: 1 },
    });
  });

  it('rejects non-numeric versions', () => {
    for (const version of ['1', null, undefined, 1.5, NaN]) {
      expect(migrateToCurrent({ version }).ok).toBe(false);
    }
  });

  it('stops a migration that does not advance the version', () => {
    const table: Record<number, Migration> = { 1: (raw) => ({ ...raw }) };
    expect(migrateToCurrent({ version: 1 }, table, 2).ok).toBe(false);
  });
});
