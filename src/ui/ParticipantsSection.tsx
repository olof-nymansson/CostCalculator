import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ParticipantId } from '../core/types';
import type { Action, ActionError } from '../state/actions';
import type { Participant } from '../state/model';
import { strings } from '../strings';

type Props = {
  readonly participants: readonly Participant[];
  readonly dispatch: (action: Action) => ActionError | undefined;
};

type RowProps = Pick<Props, 'dispatch'> & {
  readonly participant: Participant;
  readonly onError: (e: ActionError | undefined) => void;
  /** Called after the participant has been removed, so focus can move somewhere sensible. */
  readonly onRemoved: () => void;
};

function ParticipantRow({
  participant,
  dispatch,
  onError,
  onRemoved,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(participant.name);
  const t = strings.participants;
  const renameButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // After Save or Cancel the edit form disappears; put focus back on the button that opened it.
  useEffect(() => {
    if (wasEditing.current && !editing) renameButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const error = dispatch({
      type: 'renameParticipant',
      id: participant.id,
      name,
    });
    onError(error);
    if (!error) setEditing(false);
  };

  if (editing) {
    return (
      <li>
        <form className="row" onSubmit={save}>
          <label>
            <span className="visually-hidden">
              {t.renameLabel(participant.name)}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </label>
          <button type="submit">{t.save}</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setName(participant.name);
              setEditing(false);
              onError(undefined);
            }}
          >
            {t.cancel}
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="row">
      <span className="grow">{participant.name}</span>
      <button
        type="button"
        className="secondary"
        ref={renameButton}
        aria-label={t.renameButtonLabel(participant.name)}
        onClick={() => setEditing(true)}
      >
        {t.rename}
      </button>
      <button
        type="button"
        className="secondary"
        aria-label={t.removeLabel(participant.name)}
        onClick={() => {
          const error = dispatch({
            type: 'removeParticipant',
            id: participant.id as ParticipantId,
          });
          onError(error);
          if (!error) onRemoved();
        }}
      >
        {t.remove}
      </button>
    </li>
  );
}

export function ParticipantsSection({ participants, dispatch }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<ActionError | undefined>();
  const t = strings.participants;
  const heading = useRef<HTMLHeadingElement>(null);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const result = dispatch({ type: 'addParticipant', name });
    setError(result);
    if (!result) setName('');
  };

  return (
    <section aria-labelledby="participants-heading" className="step">
      <h2 id="participants-heading" ref={heading} tabIndex={-1}>
        {t.heading}
      </h2>
      {participants.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul className="list">
          {participants.map((p) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              dispatch={dispatch}
              onError={setError}
              onRemoved={() => heading.current?.focus()}
            />
          ))}
        </ul>
      )}
      <form className="row" onSubmit={add}>
        <label className="grow">
          {t.nameLabel}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit">{t.add}</button>
      </form>
      {error && (
        <p role="alert" className="error">
          {strings.errors.action[error]}
        </p>
      )}
    </section>
  );
}
