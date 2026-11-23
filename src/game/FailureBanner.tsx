import type { FailureNotice } from "./failureNotice";

interface Props {
  error: FailureNotice;
  /** Null when there is no input to resend. */
  onRetry: (() => void) | null;
  retryDisabled: boolean;
}

/** A failed turn: its message, "Reintentar" and, when useful, a link to settings. */
export function FailureBanner({ error, onRetry, retryDisabled }: Props) {
  return (
    <div className="notice notice--error" role="alert">
      <p>{error.message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="button button--primary" disabled={retryDisabled} onClick={onRetry}>
            Reintentar
          </button>
        )}
        {error.suggestSettings && (
          <a className="button" href="/settings">
            Revisar configuración
          </a>
        )}
      </div>
    </div>
  );
}
