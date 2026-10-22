import { useState } from 'react';
import type { Action, ActionError } from '../state/actions';
import type { AppState } from '../state/model';
import { strings } from '../strings';
import { formatMoney } from './amount';
import { ExpenseForm } from './ExpenseForm';

type Props = {
  readonly state: AppState;
  readonly dispatch: (action: Action) => ActionError | undefined;
};

export function ExpensesSection({ state, dispatch }: Props) {
  const t = strings.expenses;
  const [error, setError] = useState<ActionError | undefined>();
  const nameOf = (id: string) =>
    state.participants.find((p) => p.id === id)?.name ?? id;

  return (
    <section aria-labelledby="expenses-heading">
      <h2 id="expenses-heading">{t.heading}</h2>
      {state.expenses.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul className="list">
          {state.expenses.map((expense) => (
            <li key={expense.id} className="row">
              <span className="grow">
                <strong>{expense.description}</strong>{' '}
                {formatMoney(expense.amount)}
                <br />
                <small>{t.paidBy(nameOf(expense.payer))}</small>
              </span>
              <button
                type="button"
                className="secondary"
                aria-label={t.removeLabel(expense.description)}
                onClick={() =>
                  setError(dispatch({ type: 'removeExpense', id: expense.id }))
                }
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="error">
          {strings.errors.action[error]}
        </p>
      )}
      <ExpenseForm participants={state.participants} dispatch={dispatch} />
    </section>
  );
}
