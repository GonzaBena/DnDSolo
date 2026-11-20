import type { Attitude, GameState, QuestStatus, StoryItem } from "../domain/types";
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

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface ItemRowProps {
  item: StoryItem;
  /** Total carried, for taken items. */
  quantity?: number;
  /** Small label after the name: who holds it, or where it was seen. */
  note?: string;
}

/** One object on one line; the description, when there is one, unfolds. */
function ItemRow({ item, quantity, note }: ItemRowProps) {
  const head = (
    <>
      <span className="story-item__name">{item.name}</span>
      {quantity !== undefined && quantity > 1 && <span className="story-item__qty">×{quantity}</span>}
      {note && <span className="story-item__note">{note}</span>}
      {item.status === "gone" && <span className="story-item__note">Ya no está</span>}
    </>
  );
  return (
    <li className="story-item" data-status={item.status}>
      {item.description ? (
        <details>
          <summary>{head}</summary>
          <p>{item.description}</p>
        </details>
      ) : (
        <div className="story-item__head">{head}</div>
      )}
    </li>
  );
}

interface Props {
  state: GameState;
  open: boolean;
  onClose: () => void;
}

/** Everything the campaign knows: characters, place, quests, story items
    and the NPCs met so far. */
export function InfoDrawer({ state, open, onClose }: Props) {
  const { dialogProps, panelRef } = useDrawer(open, onClose);
  const players = state.players ?? [];
  const storyItems = state.storyItems ?? [];
  const here = storyItems.filter(
    (i) => i.status === "available" && i.location !== "" && sameName(i.location, state.location?.name ?? ""),
  );
  const held = storyItems.filter((i) => i.status === "taken");
  const past = storyItems.filter((i) => i.status !== "taken" && !here.includes(i));
  const holding = (item: StoryItem) =>
    players
      .map((p) => ({ player: p, entry: p.inventory.find((e) => sameName(e.name, item.name)) }))
      .filter((h) => h.entry !== undefined);

  return (
    <dialog {...dialogProps} aria-labelledby="info-title">
      <div ref={panelRef} className="drawer__panel drawer__panel-info" data-mode="calm">
        <header className="drawer__header">
          <div>
            <h2 id="info-title">Información</h2>
            <p className="drawer__place">{state.location?.name || "Lugar desconocido"}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {state.location?.description && <p>{state.location.description}</p>}

        <section className="info-section">
          <div className="info-section__header">
            <h3>Crónica de la campaña</h3>
            <span className="info-badge">{(state.turns ?? []).length} turnos</span>
          </div>
          {typeof state.summary === "string" && state.summary.trim() !== "" ? (
            <div className="chronicle-text">
              {state.summary.split(/\n+/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="drawer__empty">
              Tu historia recién comienza. A medida que avances, el diario de campaña registrará los hechos más importantes.
            </p>
          )}
        </section>

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
          <div className="info-section__header">
            <h3>Objetos de la historia</h3>
            {storyItems.length > 0 && <span className="info-badge">{storyItems.length}</span>}
          </div>
          {storyItems.length === 0 ? (
            <p className="drawer__empty">Todavía no apareció ningún objeto.</p>
          ) : (
            <>
              {here.length > 0 && (
                <div className="story-items story-items--here">
                  <h4>A tu alcance</h4>
                  <ul>
                    {here.map((i) => (
                      <ItemRow key={i.name} item={i} />
                    ))}
                  </ul>
                </div>
              )}
              {held.length > 0 && (
                <div className="story-items">
                  <h4>En tu poder</h4>
                  <ul>
                    {held.map((i) => {
                      const holders = holding(i);
                      const quantity = holders.reduce((sum, h) => sum + (h.entry?.quantity ?? 0), 0);
                      const note = players.length > 1 ? holders.map((h) => h.player.name).join(", ") : undefined;
                      return <ItemRow key={i.name} item={i} quantity={quantity} note={note} />;
                    })}
                  </ul>
                </div>
              )}
              {past.length > 0 && (
                <div className="story-items story-items--past">
                  <h4>Vistos antes</h4>
                  <ul>
                    {past.map((i) => (
                      <ItemRow key={i.name} item={i} note={i.status === "available" ? i.location : undefined} />
                    ))}
                  </ul>
                </div>
              )}
            </>
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
