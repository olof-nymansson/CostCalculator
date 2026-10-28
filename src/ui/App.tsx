import { useAppState } from '../state/useAppState';
import { strings } from '../strings';
import { ExpensesSection } from './ExpensesSection';
import { ParticipantsSection } from './ParticipantsSection';
import { ShareButton } from './ShareButton';
import { SummarySection } from './SummarySection';

export function App() {
  const {
    state,
    loadError,
    dismissLoadError,
    dispatch,
    shareUrl,
    shareUrlTooLong,
    copyShareUrl,
  } = useAppState();

  return (
    <>
      <header className="app-header">
        <div className="page">
          <h1>{strings.appTitle}</h1>
          <p>{strings.appIntro}</p>
          <ShareButton
            shareUrl={shareUrl}
            tooLong={shareUrlTooLong}
            copy={copyShareUrl}
          />
        </div>
      </header>
      <main className="page">
        {loadError && (
          <div role="alert" className="error banner">
            <p>{strings.errors.load[loadError.kind]}</p>
            <button
              type="button"
              className="secondary"
              onClick={dismissLoadError}
            >
              {strings.errors.dismiss}
            </button>
          </div>
        )}
        <ParticipantsSection
          participants={state.participants}
          dispatch={dispatch}
        />
        <ExpensesSection state={state} dispatch={dispatch} />
        <SummarySection state={state} dispatch={dispatch} />
      </main>
    </>
  );
}
