import { useEffect, useState } from 'react';
import { strings } from '../strings';

type Props = {
  readonly shareUrl: string;
  readonly tooLong: boolean;
  readonly copy: () => Promise<boolean>;
};

export function ShareSection({ shareUrl, tooLong, copy }: Props) {
  const t = strings.share;
  const [status, setStatus] = useState('');

  useEffect(() => setStatus(''), [shareUrl]);

  return (
    <section aria-labelledby="share-heading" className="step">
      <h2 id="share-heading">{t.heading}</h2>
      <p>{t.note}</p>
      <label>
        {t.linkLabel}
        <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
      </label>
      {tooLong && <p className="warning">{t.tooLong}</p>}
      <button
        type="button"
        onClick={async () =>
          setStatus((await copy()) ? t.copied : t.copyFailed)
        }
      >
        {t.copy}
      </button>
      <p role="status">{status}</p>
    </section>
  );
}
