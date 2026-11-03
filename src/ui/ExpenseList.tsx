import { useEffect, useRef, useState } from 'react';
import type { Action, ActionError } from '../state/actions';
import type { AppState, ExpenseEntry } from '../state/model';
import { strings } from '../strings';
import { formatMoney } from './amount';
import { ExpenseForm } from './ExpenseForm';

type Props = {
  readonly state: AppState;
  readonly dispatch: (action: Action) => ActionError | undefined;
};

type RowProps = {
  readonly expense: ExpenseEntry;
  readonly state: AppState;
  readonly dispatch: (action: Action) => ActionError | undefined;
  readonly editing: boolean;
  readonly onEdit: () => void;
  readonly onCloseEdit: () => void;
  readonly onRemove: () => void;
};

function ExpenseRow({
  expense,
  state,
  dispatch,
  editing,
  onEdit,
  onCloseEdit,
  onRemove,
}: RowProps) {
  const t = strings.expenses;
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // After Save or Cancel the edit form disappears; put focus back on the button that opened it.
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (editing) {
    return (
      <li>
        <ExpenseForm
          participants={state.participants}
          dispatch={dispatch}
          editing={{ expense, onDone: onCloseEdit, onCancel: onCloseEdit }}
        />
      </li>
    );
  }

  const payerName =
    state.participants.find((p) => p.id === expense.payer)?.name ??
    expense.payer;
  return (
    <li className="row">
      <span className="grow">
        <strong>{expense.description}</strong> {formatMoney(expense.amount)}
        <br />
        <small>{t.paidBy(payerName)}</small>
      </span>
      <button
        type="button"
        className="secondary"
        ref={editButton}
        aria-label={t.editButtonLabel(expense.description)}
        onClick={onEdit}
      >
        {t.edit}
      </button>
      <button
        type="button"
        className="secondary"
        aria-label={t.removeLabel(expense.description)}
        onClick={onRemove}
      >
        {t.remove}
      </button>
    </li>
  );
}

export function ExpenseList({ state, dispatch }: Props) {
  const t = strings.expenses;
  const heading = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState<ActionError | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();

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
            <ExpenseRow
              key={expense.id}
              expense={expense}
              state={state}
              dispatch={dispatch}
              editing={editingId === expense.id}
              onEdit={() => {
                setError(undefined);
                setEditingId(expense.id);
              }}
              onCloseEdit={() => setEditingId(undefined)}
              onRemove={() => {
                const failure = dispatch({
                  type: 'removeExpense',
                  id: expense.id,
                });
                setError(failure);
                if (!failure) {
                  setEditingId(undefined);
                  heading.current?.focus();
                }
              }}
            />
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
