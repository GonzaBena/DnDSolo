import { useState } from "react";
import { MILESTONES_PER_LEVEL, type GameState } from "../domain/types";
import { HpDialog } from "./HpDialog";
import { hpTone } from "./hpBar";

interface Props {
  state: GameState;
  onOpenScene: () => void;
  onOpenInfo: () => void;
  zenMode?: boolean;
  onToggleZen?: () => void;
  /** Manual hit point fix (signed). Without it the HP controls are read-only. */
  onAdjustHp?: (delta: number) => void;
  /** Disables the HP controls, e.g. while the DM is answering. */
  hpDisabled?: boolean;
}

export function CharacterPanel({
  state,
  onOpenScene,
  onOpenInfo,
  zenMode = false,
  onToggleZen,
  onAdjustHp,
  hpDisabled = false,
}: Props) {
  const [hpOpen, setHpOpen] = useState(false);
  const player = state.players?.[0];
  if (!player) return null;
  // The first active quest is the main one.
  const mainQuest = (state.quests ?? []).find((q) => q.status === "active");
  // Players, the DM and the NPCs around.
  const inScene = (state.players?.length ?? 1) + 1 + (state.npcs ?? []).filter((n) => n.present).length;
  const inCombat = state.scene?.inCombat ?? false;

  const stats = player.stats;
  const hp = stats && player.currentHp !== null ? { current: player.currentHp, max: stats.maxHp } : null;
  const conditions = player.activeConditions ?? [];

  return (
    <aside className={`sheet${zenMode ? " sheet--zen" : ""}`} aria-label="Tu personaje">
      <div className="sheet__main">
        <div className="sheet__identity">
          <strong>{player.name}</strong>
          <span>
            {player.race} · {player.characterClass} · Nivel {player.level}
            <span
              className="sheet__progress"
              title="Hitos para el próximo nivel"
              aria-label={`${Math.min(player.milestonesSinceLevel, MILESTONES_PER_LEVEL)} de ${MILESTONES_PER_LEVEL} hitos para el próximo nivel`}
            >
              {" · Progreso "}
              {"●".repeat(Math.min(player.milestonesSinceLevel, MILESTONES_PER_LEVEL))}
              {"○".repeat(Math.max(0, MILESTONES_PER_LEVEL - player.milestonesSinceLevel))}
            </span>
          </span>
        </div>
        {stats && hp && (
          <div className="sheet__vitals">
            <div className="hp">
              <div
                className="hp__bar"
                data-tone={hpTone(hp.current, hp.max)}
                role="progressbar"
                aria-label="Puntos de golpe"
                aria-valuemin={0}
                aria-valuemax={hp.max}
                aria-valuenow={hp.current}
              >
                <div
                  className="hp__fill"
                  style={{ width: `${Math.max(0, Math.min(100, (hp.current / hp.max) * 100))}%` }}
                />
              </div>
              <span className="hp__label">
                <button
                  type="button"
                  className="hp__value"
                  aria-label={`Puntos de golpe ${hp.current} de ${hp.max}. Corregir`}
                  aria-haspopup="dialog"
                  disabled={hpDisabled || !onAdjustHp}
                  onClick={() => setHpOpen(true)}
                >
                  PG {hp.current}/{hp.max}
                </button>
                <span className="sheet__ac"> – CA {stats.armorClass}</span>
              </span>
            </div>
            <div className="hp__steps">
              <button
                type="button"
                className="button hp__step hp__step--minus"
                aria-label="Restar 1 PG"
                disabled={hpDisabled || !onAdjustHp || hp.current <= 0}
                onClick={() => onAdjustHp?.(-1)}
              >
                −
              </button>
              <button
                type="button"
                className="button hp__step hp__step--plus"
                aria-label="Sumar 1 PG"
                disabled={hpDisabled || !onAdjustHp || hp.current >= hp.max}
                onClick={() => onAdjustHp?.(1)}
              >
                +
              </button>
            </div>
          </div>
        )}
        {!zenMode && conditions.length > 0 && (
          <ul className="sheet__conditions" aria-label="Condiciones activas">
            {conditions.map((condition) => (
              <li key={condition} className="sheet__condition">
                {condition}
              </li>
            ))}
          </ul>
        )}
        {!zenMode && (
          <dl className="sheet__details">
            <div>
              <dt>Lugar</dt>
              <dd>{state.location.name || "—"}</dd>
            </div>
            {mainQuest && (
              <div>
                <dt>Misión</dt>
                <dd>{mainQuest.title}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <div className="sheet__actions">
        {onToggleZen && (
          <button
            type="button"
            className={`button scene-toggle ${zenMode ? "scene-toggle--active" : ""}`}
            onClick={onToggleZen}
            title={zenMode ? "Mostrar ficha completa" : "Modo lectura"}
            aria-label={zenMode ? "Mostrar ficha completa" : "Modo lectura"}
          >
            {zenMode ? "Ficha" : "Lectura"}
          </button>
        )}
        <button
          type="button"
          className="button scene-toggle scene-toggle--scene"
          data-mode={inCombat ? "combat" : "calm"}
          onClick={onOpenScene}
          aria-haspopup="dialog"
        >
          {inCombat ? "Combate" : "Escena"}
          <span className="scene-toggle__count" aria-label={`${inScene} personajes`}>
            {inScene}
          </span>
        </button>
        <button
          type="button"
          className="button scene-toggle"
          onClick={onOpenInfo}
          aria-haspopup="dialog"
          data-inventory-target
        >
          Info
        </button>
      </div>
      {stats && hp && onAdjustHp && (
        <HpDialog
          open={hpOpen}
          disabled={hpDisabled}
          onClose={() => setHpOpen(false)}
          onSubmit={(delta) => {
            setHpOpen(false);
            onAdjustHp(delta);
          }}
        />
      )}
    </aside>
  );
}
