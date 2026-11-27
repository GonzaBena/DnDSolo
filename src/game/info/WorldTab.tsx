import { useState } from "react";
import { npcTag } from "../../domain/npcRename";
import type { Attitude, GameState, StoryItem } from "../../domain/types";
import { NpcAvatar } from "../NpcAvatar";
import { NpcEditButton } from "../NpcRenameDialog";
import { sameName } from "./format";

type Filter = "all" | Attitude;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "friendly", label: "Aliados" },
  { id: "neutral", label: "Neutrales" },
  { id: "hostile", label: "Hostiles" },
];

function ItemDetail({ item, note }: { item: StoryItem; note?: string }) {
  const head = (
    <>
      <span className="world-item__name">{item.name}</span>
      {note && <span className="world-item__note">{note}</span>}
    </>
  );
  return (
    <li className="world-item" data-status={item.status}>
      {item.description ? (
        <details className="info-disclosure">
          <summary>{head}</summary>
          <p>{item.description}</p>
        </details>
      ) : (
        <div className="world-item__head">{head}</div>
      )}
    </li>
  );
}

interface Props {
  state: GameState;
  onEditNpc?: (name: string) => void;
}

/** Where the character is and who and what they have come across. */
export function WorldTab({ state, onEditNpc }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const place = state.location?.name ?? "";
  const storyItems = state.storyItems ?? [];
  const here = storyItems.filter((i) => i.status === "available" && i.location !== "" && sameName(i.location, place));
  const past = storyItems.filter((i) => i.status !== "taken" && !here.includes(i));
  const present = state.npcs.filter((n) => n.present);
  const counts = (f: Filter) => (f === "all" ? state.npcs.length : state.npcs.filter((n) => n.attitude === f).length);
  const filters = FILTERS.filter((f) => f.id === "all" || counts(f.id) > 0);
  const shown = filter === "all" ? state.npcs : state.npcs.filter((n) => n.attitude === filter);

  return (
    <>
      <section className="info-card info-card--flush" aria-label="Aquí y ahora">
        <div className="world-here__head">
          <span className="info-eyebrow">Aquí y ahora</span>
          <h3>{place || "Lugar desconocido"}</h3>
        </div>
        <div className="world-here__body">
          {state.location?.description && <p className="world-here__text">{state.location.description}</p>}
          {present.length > 0 && (
            <div>
              <p className="info-eyebrow">En escena</p>
              <ul className="world-present">
                {present.map((n) => (
                  <li key={n.name}>
                    <NpcAvatar name={n.name} npc={n} size="lg" />
                    <strong>{n.name}</strong>
                    <span className="info-pill" data-attitude={n.attitude}>
                      {npcTag(n)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {here.length > 0 && (
            <div>
              <p className="info-eyebrow">A tu alcance</p>
              <ul className="world-items world-items--here">
                {here.map((i) => (
                  <ItemDetail key={i.name} item={i} />
                ))}
              </ul>
            </div>
          )}
          {!state.location?.description && present.length === 0 && here.length === 0 && (
            <p className="drawer__empty">Nada a la vista por ahora.</p>
          )}
        </div>
      </section>

      <section aria-label="Personajes conocidos">
        <div className="info-sec-head">
          <h3>Personajes conocidos</h3>
        </div>
        {state.npcs.length === 0 ? (
          <p className="drawer__empty">Todavía no conociste a nadie.</p>
        ) : (
          <>
            {filters.length > 2 && (
              <div className="info-segmented" role="group" aria-label="Filtrar por actitud">
                {filters.map((f) => (
                  <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label} · {counts(f.id)}
                  </button>
                ))}
              </div>
            )}
            <ul className="info-card info-card--rows world-npcs">
              {shown.map((n) => (
                <li key={n.name} className="world-npc">
                  <NpcAvatar name={n.name} npc={n} size="lg" />
                  <div className="world-npc__body">
                    <div className="world-npc__head">
                      <div>
                        <strong>{n.name}</strong>
                        <span className="world-npc__tags">
                          <span className="world-npc__tag" data-attitude={n.attitude}>
                            {npcTag(n)}
                          </span>
                          {n.present && <span className="info-pill info-pill--ok">En escena</span>}
                        </span>
                      </div>
                      {onEditNpc && <NpcEditButton name={n.name} onClick={() => onEditNpc(n.name)} />}
                    </div>
                    {n.description && <p>{n.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Objetos vistos antes">
          <div className="info-sec-head">
            <h3>
              Objetos vistos antes <span className="info-pill">{past.length}</span>
            </h3>
          </div>
          <ul className="world-items world-items--past">
            {past.map((i) => (
              <ItemDetail key={i.name} item={i} note={i.status === "gone" ? "Ya no está" : i.location || undefined} />
            ))}
          </ul>
          <p className="info-hint">Lo que llevás encima está en Héroe › Inventario.</p>
        </section>
      )}
    </>
  );
}
