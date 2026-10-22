import { expenseShares, totalExpenses } from '../core/totals';
import type { ExpenseEntry } from '../state/model';
import { strings } from '../strings';
import { formatMoney, formatPercent } from './amount';

type Props = {
  readonly expenses: readonly ExpenseEntry[];
};

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Evenly spread hues (golden angle) so any number of expenses get distinct colors. */
const colorOf = (index: number): string =>
  `hsl(${(index * 137.508) % 360} 55% 42%)`;

export function ExpenseDonut({ expenses }: Props) {
  const t = strings.summary;
  const total = totalExpenses(expenses);
  const shares = expenseShares(expenses);
  const totalText = formatMoney(total);

  const segments = expenses.reduce<
    { expense: ExpenseEntry; length: number; offset: number }[]
  >((acc, expense) => {
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.length : 0;
    // Floating point is fine here: this is chart geometry, not money.
    const fraction = total === 0 ? 0 : expense.amount / total;
    acc.push({ expense, length: fraction * CIRCUMFERENCE, offset });
    return acc;
  }, []);

  return (
    <div className="donut">
      <p className="donut-total">
        {t.total}: <strong>{totalText}</strong>
      </p>
      {expenses.length > 0 && total > 0 && (
        <>
          <svg
            className="donut-chart"
            viewBox="0 0 100 100"
            role="img"
            aria-label={t.donutLabel(totalText)}
          >
            <g transform="rotate(-90 50 50)">
              {segments.map((s, i) => (
                <circle
                  key={s.expense.id}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  stroke={colorOf(i)}
                  strokeWidth="16"
                  strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
                  strokeDashoffset={-s.offset}
                />
              ))}
            </g>
            <text
              x="50"
              y="50"
              textAnchor="middle"
              dominantBaseline="central"
              className="donut-center"
            >
              {totalText}
            </text>
          </svg>
          <ul className="list donut-legend">
            {expenses.map((expense, i) => (
              <li key={expense.id} className="donut-item">
                <span
                  className="donut-swatch"
                  style={{ background: colorOf(i) }}
                  aria-hidden="true"
                />
                <span className="grow">{expense.description}</span>
                <span>
                  {formatMoney(expense.amount)} ({formatPercent(shares[i] ?? 0)}
                  )
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
