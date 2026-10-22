import { useMemo } from 'react';
import { summarize } from '../state/summary';
import type { AppState } from '../state/model';
import { strings } from '../strings';
import { formatMoney } from './amount';

export function SummarySection({ state }: { readonly state: AppState }) {
  const t = strings.summary;
  const { balances, transfers } = useMemo(() => summarize(state), [state]);
  const nameOf = (id: string) =>
    state.participants.find((p) => p.id === id)?.name ?? id;

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading">{t.heading}</h2>
      <h3>{t.balances}</h3>
      <ul className="list">
        {balances.map((b) => (
          <li key={b.participant} className="row">
            <span className="grow">{nameOf(b.participant)}</span>
            <span>
              {b.amount === 0
                ? t.even
                : `${b.amount > 0 ? t.positive : t.negative} ${formatMoney(Math.abs(b.amount))}`}
            </span>
          </li>
        ))}
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
