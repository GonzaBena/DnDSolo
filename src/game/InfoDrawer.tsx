import { campaignHref } from "../campaign/links";
import { canUpgradeSheet } from "../domain/sheetProgress";
import { OutsideSrdSection, type OutsideSrdEdit } from "./OutsideSrdSection";
import { findCampaign } from "../campaigns";
import { npcTag } from "../domain/npcRename";
import { resourceStatusFor } from "../domain/resources";
import { buildSheet } from "../rules/buildSheet";
import { formatSheetText } from "../rules/formatSheet";
import { NpcEditButton } from "./NpcRenameDialog";
import type { GameState, QuestStatus, StoryItem, ThreadKind } from "../domain/types";
import { useDrawer } from "./useDrawer";
import { PortraitChooser } from "../character/PortraitPicker";

const QUEST_LABEL: Record<QuestStatus, string> = {
  active: "Activa",
  completed: "Completada",
  failed: "Fallida",
};

const THREAD_LABEL: Record<ThreadKind, string> = {
  goal: "Objetivo",
  threat: "Amenaza",
  mystery: "Misterio",
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
  /** Opens "Anteriormente en…" over the game. */
  onOpenRecap: () => void;
  /** A turn is being played: leaving the page now would lose it. */
  turnRunning?: boolean;
  /** Saves the first player's "Fuera del SRD" note and subclass; without it the section is not shown. */
  onSaveOutsideSrd?: (edit: OutsideSrdEdit) => Promise<void>;
  /** Saves the first player's portrait (null: their initials); without it the portrait can't be changed. */
  onSavePortrait?: (portrait: string | null) => Promise<void>;
  /** Opens the screen that completes the first player's rules choices (shown only when they can be completed). */
  onUpgradeSheet?: () => void;
  /** Opens the rename dialog for an NPC; without it they can't be renamed. */
  onEditNpc?: (name: string) => void;
}

/** Everything the campaign knows: characters, place, quests, story items
    and the NPCs met so far. */
export function InfoDrawer({ state, open, onClose, onOpenRecap, turnRunning = false, onSaveOutsideSrd, onSavePortrait, onUpgradeSheet, onEditNpc }: Props) {
  const { dialogProps, panelRef } = useDrawer(open, onClose);
  const campaign = findCampaign(state.campaignId);
  const players = state.players ?? [];
  const storyItems = state.storyItems ?? [];
  const here = storyItems.filter(
    (i) => i.status === "available" && i.location !== "" && sameName(i.location, state.location?.name ?? ""),
  );
  const held = storyItems.filter((i) => i.status === "taken");
  const past = storyItems.filter((i) => i.status !== "taken" && !here.includes(i));
  // Secret threads are the DM's: the player only sees what was revealed.
  const threads = (state.threads ?? []).filter((t) => !t.secret);
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

        {campaign && (
          <section className="info-section">
            <div className="info-section__header">
              <h3>{campaign.title}</h3>
              <span className="info-badge">{campaign.tag}</span>
            </div>
            <p>{campaign.synopsis}</p>
          </section>
        )}

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
          <div className="chronicle-actions">
            {(state.turns ?? []).length > 0 && (
              <button type="button" className="button button--small" onClick={onOpenRecap}>
                Anteriormente en…
              </button>
            )}
            {!turnRunning && (
              <a className="button button--small" href={campaignHref(state.id)}>
                Ver tu campaña
              </a>
            )}
          </div>
        </section>

        <section className="info-section">
          <h3>Personajes</h3>
          <ul className="info-list">
            {state.players.map((p) => {
              const res = resourceStatusFor(p);
              const conditions = p.activeConditions ?? [];
              const built = open && p.choices ? buildSheet(p.choices) : null;
              return (
                <li key={p.id}>
                  <strong>{p.name}</strong>
                  <span>
                    {p.race} · {p.characterClass} · Nivel {p.level}
                  </span>
                  {p.background && <p>{p.background}</p>}
                  {(p.stats || res.slots.length > 0 || res.features.length > 0 || conditions.length > 0) && (
                    <div className="info-player-meta">
                      {p.stats && p.stats.attacks.length > 0 && (
                        <p>
                          <strong>Ataques:</strong>{" "}
                          {p.stats.attacks
                            .map((a) => `${a.name} (${a.attackBonus >= 0 ? `+${a.attackBonus}` : a.attackBonus}, ${a.damage})`)
                            .join(" · ")}
                        </p>
                      )}
                      {p.stats?.spellSaveDc !== null && p.stats?.spellSaveDc !== undefined && (
                        <p>
                          <strong>CD de conjuros:</strong> {p.stats.spellSaveDc}
                          {p.stats.spellAttackBonus !== null &&
                            ` · Ataque mágico: ${p.stats.spellAttackBonus >= 0 ? `+${p.stats.spellAttackBonus}` : p.stats.spellAttackBonus}`}
                        </p>
                      )}
                      {res.slots.length > 0 && (
                        <p>
                          <strong>Espacios:</strong>{" "}
                          {res.slots.map((s) => `${s.label} (${s.available}/${s.max})`).join(" · ")}
                        </p>
                      )}
                      {res.features.length > 0 && (
                        <p>
                          <strong>Recursos:</strong>{" "}
                          {res.features.map((f) => `${f.name} (${f.available}/${f.max})`).join(" · ")}
                        </p>
                      )}
                      {conditions.length > 0 && (
                        <p>
                          <strong>Condiciones:</strong> {conditions.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                  {built?.ok && (
                    <details className="info-sheet-details">
                      <summary>Ver ficha completa</summary>
                      <pre className="info-sheet-text">{formatSheetText(built.sheet, p.name, p.background ?? "")}</pre>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          {/* Outside the list: its styles would reach into the picker. */}
          {onSavePortrait && players[0] && (
            <PortraitChooser
              classId={players[0].classId}
              name={players[0].name}
              value={players[0].portrait}
              onPick={(portrait) => void onSavePortrait(portrait)}
            />
          )}
        </section>

        {onSaveOutsideSrd && players[0] && (
          <OutsideSrdSection
            player={players[0]}
            onSave={onSaveOutsideSrd}
            onUpgradeSheet={onUpgradeSheet && canUpgradeSheet(players[0]) ? onUpgradeSheet : undefined}
          />
        )}

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
          <h3>Hilos</h3>
          {threads.length === 0 ? (
            <p className="drawer__empty">Todavía no se abrió ningún hilo.</p>
          ) : (
            <ul className="info-list">
              {threads.map((t) => (
                <li key={t.title} className={t.status === "resolved" ? "thread thread--resolved" : "thread"}>
                  <strong>{t.title}</strong>
                  <span>
                    {THREAD_LABEL[t.kind]}
                    {t.status === "resolved" ? " · Resuelto" : ""}
                  </span>
                  {t.description && <p>{t.description}</p>}
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
                  <strong>
                    {n.name}
                    {onEditNpc && <NpcEditButton name={n.name} onClick={() => onEditNpc(n.name)} />}
                  </strong>
                  <span>
                    {npcTag(n)}
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
