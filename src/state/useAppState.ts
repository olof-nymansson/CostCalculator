import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAction } from './actions';
import type { Action, ActionError } from './actions';
import type { AppState, ParseError } from './model';
import { encodeState, isOverSoftLimit, loadFromHash } from './url';

export type AppStateApi = {
  readonly state: AppState;
  /** Set when the link the app was opened with could not be read. */
  readonly loadError: ParseError | undefined;
  readonly dismissLoadError: () => void;
  /** Applies the action; returns an error code if it was rejected (state is then unchanged). */
  readonly dispatch: (action: Action) => ActionError | undefined;
  readonly shareUrl: string;
  readonly shareUrlTooLong: boolean;
  /** Copies the share link; resolves to false if the browser refused. */
  readonly copyShareUrl: () => Promise<boolean>;
};

const hashFor = (state: AppState): string =>
  state.participants.length === 0 && state.expenses.length === 0
    ? ''
    : encodeState(state);

/**
 * The only place that touches the URL and the clipboard. The state lives in React, is mirrored
 * to `location.hash` after every change, and is reloaded when the hash changes (e.g. when a
 * link is opened or pasted into the address bar of an already open tab).
 */
export const useAppState = (): AppStateApi => {
  const [initial] = useState(() => loadFromHash(window.location.hash));
  const [state, setState] = useState<AppState>(initial.state);
  const [loadError, setLoadError] = useState<ParseError | undefined>(
    initial.error,
  );
  const hash = useMemo(() => hashFor(state), [state]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const { pathname, search } = window.location;
    window.history.replaceState(
      null,
      '',
      hash === '' ? pathname + search : `#${hash}`,
    );
  }, [hash]);

  useEffect(() => {
    const onHashChange = () => {
      const loaded = loadFromHash(window.location.hash);
      setState(loaded.state);
      setLoadError(loaded.error);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const dispatch = useCallback(
    (action: Action): ActionError | undefined => {
      const result = applyAction(state, action);
      if (!result.ok) return result.error;
      setState(result.value);
      setLoadError(undefined);
      return undefined;
    },
    [state],
  );

  const { origin, pathname, search } = window.location;
  const shareUrl = `${origin}${pathname}${search}${hash === '' ? '' : `#${hash}`}`;

  const copyShareUrl = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      return false;
    }
  }, [shareUrl]);

  return {
    state,
    loadError,
    dismissLoadError: () => setLoadError(undefined),
    dispatch,
    shareUrl,
    shareUrlTooLong: isOverSoftLimit(hash),
    copyShareUrl,
  };
};
