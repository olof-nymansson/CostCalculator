import { useRef, useState } from 'react';
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

/** The form field an error belongs to, so it can be marked and focused. */
type ErrorField = 'description' | 'amount' | 'split' | undefined;

type FormError = { readonly message: string; readonly field: ErrorField };

const ERROR_ID = 'expense-error';

const actionErrorField = (error: ActionError): ErrorField =>
  error === 'invalid-description'
    ? 'description'
    : error === 'invalid-amount'
      ? 'amount'
      : error === 'invalid-split'
        ? 'split'
        : undefined;

export function ExpenseForm({ participants, dispatch }: Props) {
  const t = strings.expenses;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [kind, setKind] = useState<SplitKind>('equal');
  const [excluded, setExcluded] = useState<readonly string[]>([]);
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<FormError | undefined>();
  const descriptionRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLFieldSetElement>(null);

  // Per-person input belongs to specific participants, so start over when the group changes.
  const idsKey = participants.map((p) => p.id).join(',');
  const [seenIdsKey, setSeenIdsKey] = useState(idsKey);
  if (seenIdsKey !== idsKey) {
    setSeenIdsKey(idsKey);
    setExcluded([]);
    setValues({});
  }

  if (participants.length === 0) {
    return <p>{t.needParticipants}</p>;
  }

  const payer = participants.some((p) => p.id === payerId)
    ? payerId
    : (participants[0]?.id ?? '');
  const ids = participants.map((p) => p.id);

  const fail = (message: string, field: ErrorField) => {
    setError({ message, field });
    const target =
      field === 'description'
        ? descriptionRef.current
        : field === 'amount'
          ? amountRef.current
          : field === 'split'
            ? splitRef.current?.querySelector('input')
            : null;
    target?.focus();
  };

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
      if (built.error === 'invalid-amount') {
        fail(strings.errors.invalidAmount, 'amount');
      } else if (built.error === 'invalid-value') {
        fail(
          kind === 'shares'
            ? strings.errors.invalidShares
            : strings.errors.invalidValue,
          'split',
        );
      } else {
        fail(strings.errors.noSharers, 'split');
      }
      return;
    }
    const failure = dispatch({ type: 'addExpense', expense: built.value });
    if (failure) {
      fail(strings.errors.action[failure], actionErrorField(failure));
      return;
    }
    setError(undefined);
    setDescription('');
    setAmount('');
    setValues({});
    descriptionRef.current?.focus();
  };

  /** aria attributes for the field an error belongs to. */
  const invalidProps = (field: ErrorField) =>
    error?.field === field
      ? { 'aria-invalid': true as const, 'aria-describedby': ERROR_ID }
      : {};

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
          ref={descriptionRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoComplete="off"
          {...invalidProps('description')}
        />
      </label>
      <label>
        {t.amount}
        <input
          ref={amountRef}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          {...(error?.field === 'amount'
            ? invalidProps('amount')
            : { 'aria-describedby': 'amount-hint' })}
        />
      </label>
      <small id="amount-hint">{t.amountHint}</small>
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
          onChange={(e) => {
            setKind(e.target.value as SplitKind);
            setValues({});
            setError(undefined);
          }}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t.splitKinds[k]}
            </option>
          ))}
        </select>
      </label>
      <fieldset
        ref={splitRef}
        aria-describedby={
          error?.field === 'split' ? `split-hint ${ERROR_ID}` : 'split-hint'
        }
      >
        <legend>{t.splitLegend}</legend>
        <p id="split-hint">{t.splitHints[kind]}</p>
        {participants.map((p) =>
          kind === 'equal' ? (
            <label key={p.id} className="check">
              <input
                type="checkbox"
                checked={!excluded.includes(p.id)}
                aria-invalid={error?.field === 'split' || undefined}
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
                aria-invalid={error?.field === 'split' || undefined}
              />
            </label>
          ),
        )}
      </fieldset>
      {error && (
        <p id={ERROR_ID} role="alert" className="error">
          {error.message}
        </p>
      )}
      <button type="submit">{t.add}</button>
    </form>
  );
}
