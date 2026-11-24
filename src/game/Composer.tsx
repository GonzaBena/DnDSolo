import { useLayoutEffect, useState, type RefObject } from "react";
import { fieldHeight, nextExpanded } from "./composerLayout";
import { DieShape } from "./DieShape";
import { Suggestions } from "./Suggestions";
import { withSuggestion } from "./suggestions";

interface Props {
  draft: string;
  onDraftChange: (update: (current: string) => string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  canAct: boolean;
  busy: boolean;
  /** The DM is waiting on a roll: the die button and the placeholder say so. */
  rollRequested: boolean;
  atBottom: boolean;
  onScrollToBottom: () => void;
  /** Null when the player turned suggestions off. */
  suggestions: { actions: string[]; visible: boolean } | null;
  onSubmit: (event: { preventDefault(): void }) => void;
  onOpenRoll: () => void;
  onStop: () => void;
}

/** The pinned box at the bottom: suggestions, the text field, roll and send/stop. */
export function Composer({
  draft,
  onDraftChange,
  inputRef,
  canAct,
  busy,
  rollRequested,
  atBottom,
  onScrollToBottom,
  suggestions,
  onSubmit,
  onOpenRoll,
  onStop,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Grow the textarea with its content: one line when empty, capped by CSS
  // max-height. Text that no longer fits on the line beside the buttons
  // moves up to a row of its own (see composerLayout).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const style = getComputedStyle(el);
    const textHeight = el.scrollHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const overflows = !expanded && textHeight > parseFloat(style.lineHeight) * 1.5;
    // scrollHeight leaves out the border; add it back so a border-box
    // textarea fits its text without overflowing.
    const height = fieldHeight(draft, el.scrollHeight, el.offsetHeight - el.clientHeight);
    el.style.height = height === null ? "" : `${height}px`;
    setExpanded((current) => nextExpanded(current, draft, overflows));
  }, [draft, expanded, inputRef]);

  return (
    <form className="action-form" onSubmit={onSubmit}>
      {!atBottom && (
        <button
          type="button"
          className="button scroll-bottom"
          aria-label="Ir al final"
          title="Ir al final"
          onClick={onScrollToBottom}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 4v15m-6-6 6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {suggestions && (
        <Suggestions
          actions={suggestions.actions}
          visible={suggestions.visible}
          onPick={(action) => {
            onDraftChange((current) => withSuggestion(current, action));
            // On a phone, focusing would open the keyboard over the field:
            // the player can send it as is, or tap the field to edit it.
            if (matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
          }}
        />
      )}
      <div className="field">
        <label htmlFor="action-input">¿Qué hacés?</label>
        <div className={`action-row${expanded ? " action-row--expanded" : ""}`}>
          <textarea
            id="action-input"
            ref={inputRef}
            className="action-input"
            rows={1}
            value={draft}
            disabled={!canAct}
            onChange={(event) => {
              const value = event.target.value;
              onDraftChange(() => value);
            }}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter makes a new line.
              if (event.key === "Enter" && !event.shiftKey) onSubmit(event);
            }}
            placeholder={rollRequested ? "Total de tu tirada…" : "Describí tu acción…"}
          />
          <button
            type="button"
            className={`button action-roll${rollRequested ? " action-roll--requested" : ""}`}
            aria-label="Cargar tirada"
            title="Cargar tirada"
            disabled={!canAct}
            onClick={onOpenRoll}
          >
            <DieShape die="d20" className="action-roll__die" />
          </button>
          {/* Distinct keys plus preventDefault: otherwise React reuses this
              same <button> and turns it into the submit one before the
              click finishes, so the click would send the form again. */}
          {busy ? (
            <button
              key="stop"
              type="button"
              className="button button--primary action-send"
              aria-label="Detener respuesta"
              title="Detener"
              onClick={(event) => {
                event.preventDefault();
                onStop();
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              key="send"
              type="submit"
              className="button button--primary action-send"
              aria-label="Enviar"
              title="Enviar"
              disabled={!canAct || draft.trim() === ""}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  d="M21 3 3 10.5l7 2.5 2.5 7L21 3Zm0 0L10 13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
