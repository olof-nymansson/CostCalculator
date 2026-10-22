import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ParticipantId } from '../core/types';
import type { Action, ActionError } from '../state/actions';
import type { Participant } from '../state/model';
import { strings } from '../strings';
import { buildExpense } from './expenseDraft';
import type { SplitKind } from './expenseDraft';

type Props = {
  readonly participants: readonly Participant[];
  readonly dispatch: (action: Action) => ActionError | undefined;
};

const KINDS: readonly SplitKind[] = ['equal', 'shares', 'exact', 'percent'];

export function ExpenseForm({ participants, dispatch }: Props) {
  const t = strings.expenses;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [kind, setKind] = useState<SplitKind>('equal');
  const [excluded, setExcluded] = useState<readonly string[]>([]);
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | undefined>();

  if (participants.length === 0) {
    return <p>{t.needParticipants}</p>;
  }

  const payer = participants.some((p) => p.id === payerId)
    ? payerId
    : (participants[0]?.id ?? '');
  const ids = participants.map((p) => p.id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const built = buildExpense(
      {
        description,
        amount,
        payer: payer as ParticipantId,
        kind,
        included: ids.filter((id) => !excluded.includes(id)),
        values,
      },
      ids,
    );
    if (!built.ok) {
      setError(
        built.error === 'invalid-amount'
          ? strings.errors.invalidAmount
          : built.error === 'invalid-value'
            ? strings.errors.invalidValue
            : strings.errors.noSharers,
      );
      return;
    }
    const failure = dispatch({ type: 'addExpense', expense: built.value });
    if (failure) {
      setError(strings.errors.action[failure]);
      return;
    }
    setError(undefined);
    setDescription('');
    setAmount('');
    setValues({});
  };

  const fieldLabel = (name: string) =>
    kind === 'shares'
      ? t.shareFieldLabel(name)
      : kind === 'exact'
        ? t.exactFieldLabel(name)
        : t.percentFieldLabel(name);

  return (
    <form onSubmit={submit} aria-labelledby="new-expense-heading">
      <h3 id="new-expense-heading">{t.newHeading}</h3>
      <label>
        {t.description}
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        {t.amount}
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          aria-describedby="amount-hint"
        />
        <small id="amount-hint">{t.amountHint}</small>
      </label>
      <label>
        {t.payer}
        <select value={payer} onChange={(e) => setPayerId(e.target.value)}>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.split}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SplitKind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.splitKinds[k]}
            </option>
          ))}
        </select>
      </label>
      <fieldset aria-describedby="split-hint">
        <legend>{t.splitKinds[kind]}</legend>
        <p id="split-hint">{t.splitHints[kind]}</p>
        {participants.map((p) =>
          kind === 'equal' ? (
            <label key={p.id} className="check">
              <input
                type="checkbox"
                checked={!excluded.includes(p.id)}
                onChange={(e) =>
                  setExcluded(
                    e.target.checked
                      ? excluded.filter((id) => id !== p.id)
                      : [...excluded, p.id],
                  )
                }
              />
              {p.name}
            </label>
          ) : (
            <label key={p.id}>
              {fieldLabel(p.name)}
              <input
                value={values[p.id] ?? ''}
                onChange={(e) =>
                  setValues({ ...values, [p.id]: e.target.value })
                }
                inputMode="decimal"
                autoComplete="off"
              />
            </label>
          ),
        )}
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit">{t.add}</button>
    </form>
  );
}
