/** Shown while the DM's reply hasn't produced any text yet. */
export function ThinkingIndicator() {
  return (
    <div className="thinking-indicator" role="status" aria-live="polite">
      <span className="thinking-indicator__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      </span>
      <span className="thinking-indicator__text">El DM está pensando</span>
      <span className="thinking-indicator__dots" aria-hidden="true">
        <span>.</span><span>.</span><span>.</span>
      </span>
    </div>
  );
}
