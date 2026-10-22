import { err, ok } from '../core/types';
import type { Result } from '../core/types';
import { CURRENT_VERSION } from './model';
import type { ParseError } from './model';

/** Upgrades the raw data of version N to version N + 1. Input is untrusted. */
export type Migration = (
  raw: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * Migrations keyed by the version they upgrade from. Add an entry here whenever
 * CURRENT_VERSION is bumped, so that old links keep working.
 * Supported versions: 1 (current).
 */
export const migrations: Readonly<Record<number, Migration>> = {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Applies migrations until the data has the target version. The result is still unvalidated. */
export const migrateToCurrent = (
  raw: unknown,
  table: Readonly<Record<number, Migration>> = migrations,
  target: number = CURRENT_VERSION,
): Result<Record<string, unknown>, ParseError> => {
  if (!isRecord(raw)) return err({ kind: 'invalid', path: '' });

  let data = raw;
  let version = data.version;
  while (version !== target) {
    if (
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      version >= target
    ) {
      return err({ kind: 'unsupported-version', version });
    }
    const step = table[version];
    if (!step) return err({ kind: 'unsupported-version', version });
    data = step(data);
    // A migration must move the version forward, otherwise this loop would never end.
    if (typeof data.version !== 'number' || data.version <= version) {
      return err({ kind: 'unsupported-version', version });
    }
    version = data.version;
  }
  return ok(data);
};
