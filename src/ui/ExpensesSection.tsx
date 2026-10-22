import type { Action, ActionError } from '../state/actions';
import type { AppState } from '../state/model';
import { strings } from '../strings';
import { ExpenseForm } from './ExpenseForm';

type Props = {
  readonly state: AppState;
  readonly dispatch: (action: Action) => ActionError | undefined;
};

export function ExpensesSection({ state, dispatch }: Props) {
  return (
    <section aria-labelledby="new-expense-heading" className="step">
      <h2 id="new-expense-heading">{strings.expenses.newHeading}</h2>
      <ExpenseForm participants={state.participants} dispatch={dispatch} />
    </section>
  );
}
