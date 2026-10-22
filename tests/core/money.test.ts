import { describe, expect, it } from 'vitest';
import {
  ZERO,
  addMoney,
  isMoney,
  toMoney,
  subMoney,
  sumMoney,
} from '../../src/core/money';

describe('toMoney', () => {
  it('accepts integers including zero and negatives', () => {
    expect(toMoney(0)).toBe(0);
    expect(toMoney(12345)).toBe(12345);
    expect(toMoney(-500)).toBe(-500);
  });

  it('rejects fractions, NaN and infinities', () => {
    expect(() => toMoney(1.5)).toThrow(RangeError);
    expect(() => toMoney(NaN)).toThrow(RangeError);
    expect(() => toMoney(Infinity)).toThrow(RangeError);
  });

  it('rejects integers beyond the safe range', () => {
    expect(isMoney(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(() => toMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('arithmetic', () => {
  it('adds, subtracts and sums', () => {
    expect(addMoney(toMoney(100), toMoney(250))).toBe(350);
    expect(subMoney(toMoney(100), toMoney(250))).toBe(-150);
    expect(sumMoney([toMoney(1), toMoney(2), toMoney(3)])).toBe(6);
  });

  it('sums an empty list to zero', () => {
    expect(sumMoney([])).toBe(ZERO);
  });

  it('throws instead of silently losing precision on overflow', () => {
    expect(() =>
      addMoney(toMoney(Number.MAX_SAFE_INTEGER), toMoney(1)),
    ).toThrow(RangeError);
  });
});
