/** The DM's suggested next moves as chips. Picking one only fills the
    composer: the player still reads, edits and sends it.
    It lives at the top of the composer and stays mounted: when the
    narration ends it drops open from the composer's top border like a
    curtain, instead of popping in. One row that scrolls sideways, so it
    never takes more than a line of height. */
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
      <div className="suggestions-curtain">
        <div className="suggestions" role="group" aria-label="Sugerencias del DM">
          {actions.map((action) => (
            <button key={action} type="button" className="suggestion" onClick={() => onPick(action)}>
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
