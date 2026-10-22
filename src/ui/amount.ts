const NBSP = '\u00a0';

/**
 * Parses a non-negative decimal such as "249,50" or "249.5" into an integer scaled by 100
 * (24950), using string arithmetic only. Returns undefined for anything else, including more
 * than two decimals. Used for both amounts (öre) and percentages (basis points).
 */
export const parseScaled = (text: string): number | undefined => {
  const match = /^(\d{1,13})(?:[.,](\d{1,2}))?$/.exec(
    text.replace(/[\s\u00a0]/g, ''),
  );
  if (!match) return undefined;
  const whole = match[1] ?? '0';
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return Number(whole) * 100 + Number(fraction);
};

/** Parses a whole number such as "3" into an integer. */
export const parseWhole = (text: string): number | undefined => {
  const match = /^\d{1,9}$/.exec(text.trim());
  return match ? Number(match[0]) : undefined;
};

const groupThousands = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/** Formats a scaled integer (öre or basis points) as "1 234,50", with a minus sign if negative. */
export const formatScaled = (value: number): string => {
  const sign = value < 0 ? '−' : '';
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${groupThousands(String(whole))},${fraction}`;
};

export const formatMoney = (ore: number): string =>
  `${formatScaled(ore)}${NBSP}kr`;

export const formatPercent = (basisPoints: number): string =>
  `${formatScaled(basisPoints)}${NBSP}%`;
