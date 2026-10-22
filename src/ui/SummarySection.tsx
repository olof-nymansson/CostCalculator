import { useMemo } from 'react';
import { summarize } from '../state/summary';
import type { Action, ActionError } from '../state/actions';
import type { AppState } from '../state/model';
import { strings } from '../strings';
import { formatMoney } from './amount';
import { ExpenseDonut } from './ExpenseDonut';
import { ExpenseList } from './ExpenseList';

type Props = {
  readonly state: AppState;
  readonly dispatch: (action: Action) => ActionError | undefined;
};

export function SummarySection({ state, dispatch }: Props) {
  const t = strings.summary;
  const { balances, transfers } = useMemo(() => summarize(state), [state]);
  const maxAbs = Math.max(0, ...balances.map((b) => Math.abs(b.amount)));
  const nameOf = (id: string) =>
    state.participants.find((p) => p.id === id)?.name ?? id;

  return (
    <section aria-labelledby="summary-heading" className="step">
      <h2 id="summary-heading">{t.heading}</h2>
      <ExpenseDonut expenses={state.expenses} />
      <ExpenseList state={state} dispatch={dispatch} />
      <h3>{t.balances}</h3>
      <ul className="list balance-chart">
        {balances.map((b) => {
          const label =
            b.amount === 0
              ? t.even
              : `${b.amount > 0 ? t.positive : t.negative} ${formatMoney(Math.abs(b.amount))}`;
          const share = maxAbs === 0 ? 0 : (Math.abs(b.amount) / maxAbs) * 100;
          return (
            <li key={b.participant} className="balance-item">
              <div className="balance-header">
                <span className="balance-name">{nameOf(b.participant)}</span>
                <span
                  className={
                    b.amount > 0
                      ? 'balance-amount positive'
                      : b.amount < 0
                        ? 'balance-amount negative'
                        : 'balance-amount'
                  }
                >
                  {label}
                </span>
              </div>
              <div className="balance-track" aria-hidden="true">
                <div
                  className={`balance-bar ${b.amount > 0 ? 'positive' : 'negative'}`}
                  style={{ width: `${share / 2}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <h3>{t.transfers}</h3>
      {transfers.length === 0 ? (
        <p>{t.settled}</p>
      ) : (
        <ul className="list">
          {transfers.map((tr) => (
            <li key={`${tr.from}-${tr.to}`}>
              {t.transfer(
                nameOf(tr.from),
                nameOf(tr.to),
                formatMoney(tr.amount),
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
