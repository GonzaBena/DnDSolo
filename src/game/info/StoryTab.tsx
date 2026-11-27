import { useState } from "react";
import { campaignHref } from "../../campaign/links";
import type { OfficialCampaign } from "../../campaigns/types";
import type { GameState, ThreadKind } from "../../domain/types";
import { Icon, type IconName } from "./icons";

const THREAD: Record<ThreadKind, { label: string; icon: IconName }> = {
  goal: { label: "Objetivo", icon: "flag" },
  threat: { label: "Amenaza", icon: "alert" },
  mystery: { label: "Misterio", icon: "question" },
};

/** Past this many characters the chronicle starts folded. */
const CHRONICLE_FOLD = 420;

interface Props {
  state: GameState;
  campaign: OfficialCampaign | undefined;
  onOpenRecap: () => void;
  turnRunning: boolean;
}

/** The campaign and what has happened in it: chronicle, quests, threads. */
export function StoryTab({ state, campaign, onOpenRecap, turnRunning }: Props) {
  const [expanded, setExpanded] = useState(false);
  const turns = (state.turns ?? []).length;
  const summary = typeof state.summary === "string" ? state.summary.trim() : "";
  const foldable = summary.length > CHRONICLE_FOLD;
  const active = state.quests.filter((q) => q.status === "active");
  const closed = state.quests.filter((q) => q.status !== "active");
  // Secret threads are the DM's: the player only sees what was revealed.
  const threads = (state.threads ?? []).filter((t) => !t.secret);
  const open = threads.filter((t) => t.status !== "resolved");
  const resolved = threads.filter((t) => t.status === "resolved");

  return (
    <>
      <section className="info-card info-card--flush" aria-label="Campaña">
        {campaign && (
          <div className="story-campaign">
            <span className="info-pill info-pill--surface">{campaign.tag}</span>
            <h3>{campaign.title}</h3>
            <p>{campaign.synopsis}</p>
          </div>
        )}
        <div className="story-chronicle">
          <div className="info-sec-head">
            <span className="info-eyebrow">Crónica</span>
            <span className="info-pill">{turns} {turns === 1 ? "turno" : "turnos"}</span>
          </div>
          {summary ? (
            <>
              <div className="chronicle-text" data-folded={foldable && !expanded ? "" : undefined}>
                {summary.split(/\n+/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              {foldable && (
                <button type="button" className="info-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                  {expanded ? "Mostrar menos" : "Leer toda la crónica"}
                </button>
              )}
            </>
          ) : (
            <p className="drawer__empty">
              Tu historia recién comienza. A medida que avances, el diario de campaña registrará los hechos más importantes.
            </p>
          )}
          <div className="chronicle-actions">
            {turns > 0 && (
              <button type="button" className="button button--primary" onClick={onOpenRecap}>
                Anteriormente en…
              </button>
            )}
            {!turnRunning && (
              <a className="button" href={campaignHref(state.id)}>
                Ver tu campaña
              </a>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Misiones">
        <div className="info-sec-head">
          <h3>Misiones</h3>
          {active.length > 0 && (
            <span className="info-hint">
              {active.length} {active.length === 1 ? "activa" : "activas"}
            </span>
          )}
        </div>
        {state.quests.length === 0 ? (
          <p className="drawer__empty">Todavía no hay misiones.</p>
        ) : (
          <div className="info-stack">
            {active.map((q) => (
              <article key={q.title} className="info-card story-quest">
                <span className="info-pill info-pill--sun">Activa</span>
                <h4>{q.title}</h4>
                <p>{q.description}</p>
              </article>
            ))}
            {closed.length > 0 && (
              <details className="info-disclosure story-closed">
                <summary>
                  Completadas y fallidas ({closed.length})
                  <Icon name="next" size={16} />
                </summary>
                <ul>
                  {closed.map((q) => (
                    <li key={q.title} data-status={q.status}>
                      <Icon name={q.status === "completed" ? "check" : "close"} size={16} />
                      <div>
                        <strong>{q.title}</strong>
                        <span className="sr-only">{q.status === "completed" ? " (completada)" : " (fallida)"}</span>
                        <p>{q.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section aria-label="Hilos">
        <div className="info-sec-head">
          <h3>Hilos</h3>
        </div>
        {threads.length === 0 ? (
          <p className="drawer__empty">Todavía no se abrió ningún hilo.</p>
        ) : (
          <div className="info-stack">
            {open.length > 0 && (
              <ul className="info-card info-card--rows story-threads">
                {open.map((t) => (
                  <li key={t.title} className="story-thread" data-kind={t.kind}>
                    <span className="story-thread__icon">
                      <Icon name={THREAD[t.kind].icon} />
                    </span>
                    <div>
                      <span className="info-eyebrow">{THREAD[t.kind].label}</span>
                      <strong>{t.title}</strong>
                      {t.description && <p>{t.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {resolved.length > 0 && (
              <details className="info-disclosure story-closed">
                <summary>
                  Resueltos ({resolved.length})
                  <Icon name="next" size={16} />
                </summary>
                <ul>
                  {resolved.map((t) => (
                    <li key={t.title} className="thread--resolved">
                      <Icon name="check" size={16} />
                      <div>
                        <strong>{t.title}</strong>
                        <span className="sr-only"> ({THREAD[t.kind].label}, resuelto)</span>
                        {t.description && <p>{t.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </>
  );
}
