/** The DM's suggested next moves as chips. Picking one only fills the
    composer: the player still reads, edits and sends it. */
export function Suggestions({
  actions,
  onPick,
}: {
  actions: string[];
  onPick: (action: string) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="suggestions" role="group" aria-label="Sugerencias del DM">
      {actions.map((action) => (
        <button key={action} type="button" className="suggestion" onClick={() => onPick(action)}>
          {action}
        </button>
      ))}
    </div>
  );
}
