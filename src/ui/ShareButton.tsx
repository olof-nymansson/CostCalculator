import { useEffect, useState } from 'react';
import { strings } from '../strings';

type Props = {
  readonly shareUrl: string;
  readonly tooLong: boolean;
  readonly copy: () => Promise<boolean>;
};

const TOAST_MS = 4000;

type Toast = { readonly ok: boolean; readonly text: string };

export function ShareButton({ shareUrl, tooLong, copy }: Props) {
  const t = strings.share;
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => setToast(null), [shareUrl]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const onCopy = async () => {
    if (!(await copy())) {
      setToast({ ok: false, text: t.copyFailed });
      return;
    }
    setToast({
      ok: true,
      text: tooLong ? `${t.copied}. ${t.tooLong}` : t.copied,
    });
  };

  return (
    <div className="share-button">
      <button type="button" className="header-button" onClick={onCopy}>
        {t.copy}
      </button>
      <div role="status" className="toast-region">
        {toast !== null && (
          <p className={toast.ok ? 'toast' : 'toast toast-error'}>
            {toast.ok && (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
            {toast.text}
          </p>
        )}
      </div>
    </div>
  );
}
