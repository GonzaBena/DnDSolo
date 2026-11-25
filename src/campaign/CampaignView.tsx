import { findCampaign } from "../campaigns";
import { playHref } from "./links";
import { bestiaryOf, type BestiaryEntry } from "../domain/bestiary";
import { campaignStats, timelineOf, type TimelineEntry } from "../domain/campaignStats";
import { parseInline } from "../domain/inlineMarkdown";
import type { Attitude, GameState } from "../domain/types";
import { NpcAvatar } from "../game/NpcAvatar";
import { Inline } from "../game/TurnLog";

const ATTITUDE: Record<Attitude, string> = { friendly: "Aliado", neutral: "Neutral", hostile: "Hostil" };

function dateOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

function momentText(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "place":
      return `Llegaste a ${entry.name}`;
    case "quest":
      return entry.status === "completed"
        ? `Misión cumplida: ${entry.title}`
        : entry.status === "failed"
          ? `Misión fallida: ${entry.title}`
          : `Nueva misión: ${entry.title}`;
    case "level":
      return `Subiste a nivel ${entry.level}`;
    case "death":
      return "Caíste en combate";
  }
}

function Card({ entry }: { entry: BestiaryEntry }) {
  return (
    <li className="bestiary-card" data-attitude={entry.attitude}>
      <NpcAvatar name={entry.name} npc={entry.npc} size="lg" />
      <div className="bestiary-card__body">
        <strong className="bestiary-card__name">{entry.name}</strong>
        {entry.blurb && <p className="bestiary-card__blurb">{entry.blurb}</p>}
        <p className="bestiary-card__tags">
          <span className="bestiary-card__tag" data-attitude={entry.attitude}>
            {ATTITUDE[entry.attitude]}
          </span>
          {entry.status && (
            <span className="bestiary-card__tag" data-status={entry.status}>
              {entry.status}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

function Bestiary({ title, entries, empty }: { title: string; entries: BestiaryEntry[]; empty: string }) {
  return (
    <section className="campaign-section">
      <h2>{title}</h2>
      {entries.length > 0 ? (
        <ul className="bestiary">
          {entries.map((entry) => (
            <Card key={entry.name} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="campaign-empty">{empty}</p>
      )}
    </section>
  );
}

/** "Tu campaña": the whole campaign at a glance, from the saved game. */
export function CampaignView({ state }: { state: GameState }) {
  const campaign = findCampaign(state.campaignId);
  const hero = state.players[0];
  const stats = campaignStats(state);
  const timeline = timelineOf(state);
  const { people, monsters } = bestiaryOf(state);
  const summary = state.summary.split(/\n+/).filter((p) => p.trim() !== "");
  const numbers: [number, string][] = [
    [stats.turns, "turnos"],
    [stats.places, "lugares visitados"],
    [stats.people, "personajes conocidos"],
    [stats.monsters, "monstruos encontrados"],
    [stats.monstersDefeated, "monstruos derrotados"],
    [stats.questsCompleted, "misiones cumplidas"],
    [stats.questsFailed, "misiones fallidas"],
    [stats.questsActive, "misiones en curso"],
    [stats.threadsResolved, "misterios resueltos"],
    [stats.rolls, "tiradas"],
    [stats.natural20s, "veinte naturales"],
    [stats.natural1s, "unos naturales"],
  ];
  const alive = !state.players.some((p) => p.condition === "dead");
  return (
    <article className="campaign">
      <header className="campaign-header">
        <p className="campaign-header__kicker">{campaign?.title ?? "Aventura libre"}</p>
        <h1>Tu campaña</h1>
        {hero && (
          <p className="campaign-header__hero">
            {hero.name} · {hero.race} · {hero.characterClass} · Nivel {hero.level}
          </p>
        )}
        <p className="campaign-header__dates">
          Empezó el {dateOf(state.createdAt)} · Última partida el {dateOf(state.updatedAt)}
        </p>
        <div className="actions">
          {alive && (
            <a className="button button--primary" href={playHref(state.id)}>
              Volver a jugar
            </a>
          )}
          <a className="button" href="/">
            Ir a la portada
          </a>
        </div>
      </header>

      <section className="campaign-section">
        <h2>En números</h2>
        <ul className="campaign-numbers">
          {numbers.map(([value, label]) => (
            <li key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="campaign-section">
        <h2>Crónica</h2>
        {summary.length > 0 && (
          <div className="campaign-summary">
            {summary.map((paragraph, index) => (
              <p key={index}>
                <Inline nodes={parseInline(paragraph)} />
              </p>
            ))}
          </div>
        )}
        {timeline.length > 0 ? (
          <ol className="timeline">
            {timeline.map((entry, index) => (
              <li key={index} className="timeline__entry" data-kind={entry.kind}>
                <span className="timeline__turn">Turno {entry.turn}</span>
                <span>{momentText(entry)}</span>
              </li>
            ))}
          </ol>
        ) : (
          summary.length === 0 && <p className="campaign-empty">Tu historia recién comienza.</p>
        )}
      </section>

      <Bestiary title="Personajes" entries={people} empty="Todavía no conociste a nadie." />
      <Bestiary title="Monstruos" entries={monsters} empty="Todavía no te cruzaste con monstruos." />
    </article>
  );
}

/** The page for an id that isn't saved in this browser. */
export function CampaignMissing() {
  return (
    <section className="campaign">
      <h1>No encontramos esa campaña</h1>
      <p>Puede que esté guardada en otro navegador o que la hayas borrado.</p>
      <div className="actions">
        <a className="button button--primary" href="/">
          Ir a la portada
        </a>
      </div>
    </section>
  );
}
