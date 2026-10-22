import { useRef, useState } from 'react';
import type { Action, ActionError } from '../state/actions';
import type { AppState } from '../state/model';
import { strings } from '../strings';
import { formatMoney } from './amount';

type Props = {
  readonly state: AppState;
  readonly dispatch: (action: Action) => ActionError | undefined;
};

export function ExpenseList({ state, dispatch }: Props) {
  const t = strings.expenses;
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<ActionError | undefined>();
  const nameOf = (id: string) =>
    state.participants.find((p) => p.id === id)?.name ?? id;

  return (
    <div>
      <h3 ref={heading} tabIndex={-1}>
        {t.heading}
      </h3>
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
                onClick={() => {
                  const failure = dispatch({
                    type: 'removeExpense',
                    id: expense.id,
                  });
                  setError(failure);
                  if (!failure) heading.current?.focus();
                }}
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
    </div>
  );
}
