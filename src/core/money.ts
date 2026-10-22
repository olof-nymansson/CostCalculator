import type { Money } from './types';

export const isMoney = (value: number): value is Money =>
  Number.isSafeInteger(value);

/** Brands an integer (in öre) as Money. Throws on non-integers and unsafe magnitudes. */
export const toMoney = (value: number): Money => {
  if (!isMoney(value)) {
    throw new RangeError(`Not a valid money value in öre: ${value}`);
  }
  return value;
};

export const ZERO: Money = toMoney(0);

/** Adds two amounts; throws if the result leaves the safe integer range. */
export const addMoney = (a: Money, b: Money): Money => toMoney(a + b);

export const subMoney = (a: Money, b: Money): Money => toMoney(a - b);

export const sumMoney = (amounts: readonly Money[]): Money =>
  amounts.reduce(addMoney, ZERO);
