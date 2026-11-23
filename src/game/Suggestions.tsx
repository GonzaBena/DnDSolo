import type { CSSProperties } from "react";

/** The DM's suggested next moves as chips. Picking one only fills the
    composer: the player still reads, edits and sends it.
    The slot stays mounted so it can open and close smoothly instead of
    popping in when the narration ends; fresh chips rise in one by one. */
export function Suggestions({
  actions,
  visible,
  onPick,
}: {
  actions: string[];
  /** Whether it is the player's moment to pick (no turn running, no roll asked). */
  visible: boolean;
  onPick: (action: string) => void;
}) {
  const open = visible && actions.length > 0;
  return (
    <div className={`suggestions-slot${open ? " suggestions-slot--open" : ""}`} inert={!open}>
      <div className="suggestions" role="group" aria-label="Sugerencias del DM">
        {actions.map((action, index) => (
          <button
            key={action}
            type="button"
            className="suggestion"
            style={{ "--i": index } as CSSProperties}
            onClick={() => onPick(action)}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
