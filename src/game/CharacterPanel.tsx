import type { GameState } from "../domain/types";

export function CharacterPanel({ state }: { state: GameState }) {
  const player = state.players[0];
  if (!player) return null;
  const activeQuests = state.quests.filter((q) => q.status === "active");

  return (
    <aside className="sheet" aria-label="Tu personaje">
      <div className="sheet__identity">
        <strong>{player.name}</strong>
        <span>
          {player.race} · {player.characterClass} · Nivel {player.level}
        </span>
      </div>
      <div className="sheet__hp" aria-label={`Puntos de golpe: ${player.hp} de ${player.maxHp}`}>
        <span>PG</span>
        <strong>
          {player.hp}/{player.maxHp}
        </strong>
      </div>
      <dl className="sheet__details">
        <div>
          <dt>Lugar</dt>
          <dd>{state.location.name || "—"}</dd>
        </div>
        <div>
          <dt>Inventario</dt>
          <dd>
            {player.inventory.length === 0
              ? "Vacío"
              : player.inventory
                  .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
                  .join(", ")}
          </dd>
        </div>
        {activeQuests.length > 0 && (
          <div>
            <dt>Misiones</dt>
            <dd>{activeQuests.map((q) => q.title).join(", ")}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
