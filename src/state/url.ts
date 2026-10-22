import { Inflate, deflateSync, strFromU8, strToU8 } from 'fflate';
import { err, ok } from '../core/types';
import type { Result } from '../core/types';
import { emptyState } from './model';
import type { AppState, ParseError } from './model';
import { parseState } from './validate';

/**
 * Links longer than this may not survive being pasted into chat apps or older browsers.
 * The UI warns above it; the state is still encoded.
 */
export const SOFT_LIMIT_LENGTH = 2000;

/**
 * Hashes longer than this are rejected before decoding. It is sized so that the largest state
 * the app itself allows (see LIMITS, with incompressible text) still fits; a test guards this.
 */
export const HARD_LIMIT_LENGTH = 65000;

/**
 * Decompressed JSON larger than this is rejected while inflating, so a small malicious link
 * cannot expand into gigabytes (deflate can expand ~1000x). The largest valid state is well below.
 */
export const MAX_JSON_BYTES = 512 * 1024;

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const toBase64Url = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk =
      ((bytes[i] ?? 0) << 16) |
      ((bytes[i + 1] ?? 0) << 8) |
      (bytes[i + 2] ?? 0);
    out += ALPHABET[(chunk >> 18) & 63];
    out += ALPHABET[(chunk >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(chunk >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[chunk & 63];
  }
  return out;
};

/** Returns undefined for characters outside the alphabet or an impossible length. */
const fromBase64Url = (text: string): Uint8Array | undefined => {
  if (text.length % 4 === 1) return undefined;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) return undefined;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(bytes);
};

/** Inflates while counting output, and gives up as soon as it exceeds MAX_JSON_BYTES. */
const inflateBounded = (bytes: Uint8Array): Result<Uint8Array, ParseError> => {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let exceeded = false;
  try {
    const inflater = new Inflate((chunk) => {
      total += chunk.length;
      if (total > MAX_JSON_BYTES) {
        exceeded = true;
        throw new Error('decompressed data too large');
      }
      chunks.push(chunk);
    });
    inflater.push(bytes, true);
  } catch {
    return err({ kind: exceeded ? 'too-long' : 'corrupt' });
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return ok(out);
};

/** Serializes the state as JSON, compresses it and encodes it as base64url (no leading '#'). */
export const encodeState = (state: AppState): string =>
  toBase64Url(deflateSync(strToU8(JSON.stringify(state)), { level: 9 }));

/** Decodes and validates a hash (with or without the leading '#'). Never throws. */
export const decodeState = (hash: string): Result<AppState, ParseError> => {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (text.length > HARD_LIMIT_LENGTH) return err({ kind: 'too-long' });

  const bytes = fromBase64Url(text);
  if (!bytes) return err({ kind: 'corrupt' });

  const inflated = inflateBounded(bytes);
  if (!inflated.ok) return inflated;

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(inflated.value));
  } catch {
    return err({ kind: 'corrupt' });
  }
  return parseState(raw);
};

export type LoadedState = {
  readonly state: AppState;
  readonly error?: ParseError;
};

/** An empty hash is a normal fresh start; a bad one gives an empty state plus the error. */
export const loadFromHash = (hash: string): LoadedState => {
  if (hash === '' || hash === '#') return { state: emptyState };
  const decoded = decodeState(hash);
  return decoded.ok
    ? { state: decoded.value }
    : { state: emptyState, error: decoded.error };
};

export const isOverSoftLimit = (encoded: string): boolean =>
  encoded.length > SOFT_LIMIT_LENGTH;
