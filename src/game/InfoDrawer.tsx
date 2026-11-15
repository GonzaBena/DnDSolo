import type { Attitude, GameState, QuestStatus } from "../domain/types";
import { useDrawer } from "./useDrawer";

const ATTITUDE_LABEL: Record<Attitude, string> = {
  friendly: "Amistoso",
  neutral: "Neutral",
  hostile: "Hostil",
};

const QUEST_LABEL: Record<QuestStatus, string> = {
  active: "Activa",
  completed: "Completada",
  failed: "Fallida",
};

interface Props {
  state: GameState;
  open: boolean;
  onClose: () => void;
}

/** Everything the campaign knows: characters, place, quests, story items
    and the NPCs met so far. */
export function InfoDrawer({ state, open, onClose }: Props) {
  const { dialogProps, panelRef } = useDrawer(open, onClose);
  const items = state.players.flatMap((p) => p.inventory);

  return (
    <dialog {...dialogProps} aria-labelledby="info-title">
      <div ref={panelRef} className="drawer__panel drawer__panel-info" data-mode="calm">
        <header className="drawer__header">
          <div>
            <h2 id="info-title">Información</h2>
            <p className="drawer__place">{state.location.name || "Lugar desconocido"}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {state.location.description && <p>{state.location.description}</p>}

        <section className="info-section">
          <h3>Personajes</h3>
          <ul className="info-list">
            {state.players.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong>
                <span>
                  {p.race} · {p.characterClass} · Nivel {p.level}
                </span>
                {p.background && <p>{p.background}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="info-section">
          <h3>Misiones</h3>
          {state.quests.length === 0 ? (
            <p className="drawer__empty">Todavía no hay misiones.</p>
          ) : (
            <ul className="info-list">
              {state.quests.map((q) => (
                <li key={q.title}>
                  <strong>{q.title}</strong>
                  <span>{QUEST_LABEL[q.status]}</span>
                  <p>{q.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="info-section">
          <h3>Objetos de la historia</h3>
          {items.length === 0 ? (
            <p className="drawer__empty">Ninguno todavía.</p>
          ) : (
            <ul className="info-list">
              {items.map((i) => (
                <li key={i.name}>
                  <strong>{i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="info-section">
          <h3>Personajes conocidos</h3>
          {state.npcs.length === 0 ? (
            <p className="drawer__empty">Todavía no conociste a nadie.</p>
          ) : (
            <ul className="info-list">
              {state.npcs.map((n) => (
                <li key={n.name}>
                  <strong>{n.name}</strong>
                  <span>
                    {ATTITUDE_LABEL[n.attitude]}
                    {n.present ? " · En escena" : ""}
                  </span>
                  <p>{n.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
