import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatPercent,
  formatScaled,
  parseScaled,
  parseWhole,
} from '../../src/ui/amount';

describe('parseScaled', () => {
  it('parses whole numbers and decimals with comma or dot', () => {
    expect(parseScaled('249')).toBe(24900);
    expect(parseScaled('249,5')).toBe(24950);
    expect(parseScaled('249,50')).toBe(24950);
    expect(parseScaled('249.05')).toBe(24905);
    expect(parseScaled('0')).toBe(0);
    expect(parseScaled('0,01')).toBe(1);
  });

  it('ignores spaces used as thousands separators', () => {
    expect(parseScaled('1 234,50')).toBe(123450);
    expect(parseScaled('1 234')).toBe(123400);
    expect(parseScaled(' 12 ')).toBe(1200);
  });

  it('is exact where floating point would not be', () => {
    expect(parseScaled('0,29')).toBe(29);
    expect(parseScaled('1,15')).toBe(115);
    expect(parseScaled('4,35')).toBe(435);
  });

  it('rejects everything else', () => {
    for (const text of [
      '',
      ' ',
      'abc',
      '-5',
      '1,234',
      '1,',
      ',5',
      '1e3',
      '1,2,3',
      '12 kr',
      '+1',
    ]) {
      expect(parseScaled(text)).toBeUndefined();
    }
  });

  it('rejects numbers too large to be safe', () => {
    expect(parseScaled('99999999999999')).toBeUndefined();
  });
});

describe('parseWhole', () => {
  it('parses non-negative integers only', () => {
    expect(parseWhole('3')).toBe(3);
    expect(parseWhole(' 12 ')).toBe(12);
    for (const text of ['', '1,5', '-1', 'x', '1234567890']) {
      expect(parseWhole(text)).toBeUndefined();
    }
  });
});

describe('formatting', () => {
  it('formats öre as kronor with a decimal comma and grouped thousands', () => {
    expect(formatScaled(0)).toBe('0,00');
    expect(formatScaled(5)).toBe('0,05');
    expect(formatScaled(24950)).toBe('249,50');
    expect(formatScaled(123456789)).toBe('1 234 567,89');
  });

  it('formats negative values with a minus sign', () => {
    expect(formatScaled(-150)).toBe('−1,50');
  });

  it('appends the unit after a non-breaking space', () => {
    expect(formatMoney(24950)).toBe('249,50 kr');
    expect(formatPercent(3333)).toBe('33,33 %');
  });

  it('round-trips through parseScaled', () => {
    for (const value of [0, 1, 99, 100, 12345, 99999999]) {
      expect(parseScaled(formatScaled(value))).toBe(value);
    }
  });
});
