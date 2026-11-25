import { findCampaign } from "../campaigns";
import { bestiaryOf, monsterAlbum, type BestiaryEntry, type MonsterSlot } from "../domain/bestiary";
import { campaignStats, timelineOf, type TimelineEntry } from "../domain/campaignStats";
import { parseInline } from "../domain/inlineMarkdown";
import { portraitUrl } from "../domain/portraits";
import type { Attitude, GameState } from "../domain/types";
import { initials } from "../game/NpcAvatar";
import { Inline } from "../game/TurnLog";
import { playHref } from "./links";

const ATTITUDE: Record<Attitude, string> = { friendly: "Aliado", neutral: "Neutral", hostile: "Hostil" };

export const CAMPAIGN_TABS = ["cronica", "personajes", "monstruos"] as const;
export type CampaignTab = (typeof CAMPAIGN_TABS)[number];

/** The tab a "#monstruos"-style hash points to; the chronicle otherwise. */
export function tabFromHash(hash: string): CampaignTab {
  const name = hash.replace(/^#/, "");
  return (CAMPAIGN_TABS as readonly string[]).includes(name) ? (name as CampaignTab) : "cronica";
}

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

/** One face of the gallery: big portrait on top, then who they are. */
function Card({ entry }: { entry: BestiaryEntry }) {
  const { npc } = entry;
  const image = npc.portrait ? portraitUrl(npc.portrait, npc.name) : null;
  return (
    <li className="book-card" data-attitude={entry.attitude} data-status={entry.status ?? undefined}>
      <div className="book-card__portrait">
        {image ? <img src={image} alt="" loading="lazy" /> : <span className="book-card__initials">{initials(entry.name)}</span>}
      </div>
      <strong className="book-card__name">{entry.name}</strong>
      {entry.blurb && <p className="book-card__blurb">{entry.blurb}</p>}
      <p className="book-card__tags">
        <span data-attitude={entry.attitude}>{ATTITUDE[entry.attitude]}</span>
        {entry.status && <span data-status={entry.status}>{entry.status}</span>}
      </p>
    </li>
  );
}

/** A kind of creature not met yet: its silhouette behind a question mark. */
function UnknownCard({ slot }: { slot: MonsterSlot }) {
  return (
    <li className="book-card book-card--unknown" aria-label="Monstruo sin descubrir">
      <div className="book-card__portrait">
        {slot.image && <img src={slot.image} alt="" loading="lazy" />}
        <span className="book-card__mark" aria-hidden="true">
          ?
        </span>
      </div>
      <strong className="book-card__name">???</strong>
      <p className="book-card__blurb">Todavía no te cruzaste con esta criatura.</p>
    </li>
  );
}

const TAB_LABEL: Record<CampaignTab, string> = { cronica: "📜 Crónica", personajes: "🧑 Personajes", monstruos: "🐉 Monstruos" };
const TAB_TITLE: Record<CampaignTab, string> = { cronica: "Crónica", personajes: "Personajes", monstruos: "Monstruos" };

/** "Tu campaña": the numbers up front, then the campaign as a book with
    three tabs: the chronicle, the people met and the album of monsters. */
export function CampaignView({
  state,
  tab,
  onTab,
}: {
  state: GameState;
  tab: CampaignTab;
  onTab?: (tab: CampaignTab) => void;
}) {
  const campaign = findCampaign(state.campaignId);
  const hero = state.players[0];
  const stats = campaignStats(state);
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
  const { people } = bestiaryOf(state);
  const album = monsterAlbum(state);
  const counts: Record<CampaignTab, string | null> = {
    cronica: null,
    personajes: String(people.length),
    monstruos: `${album.found}/${album.total}`,
  };
  const alive = !state.players.some((p) => p.condition === "dead");
  return (
    <article className="book">
      <header className="book-cover">
        <p className="book-cover__kicker">{campaign?.title ?? "Aventura libre"}</p>
        <h1>Tu campaña</h1>
        {hero && (
          <p className="book-cover__hero">
            {hero.name} · {hero.race} · {hero.characterClass} · Nivel {hero.level}
          </p>
        )}
        <p className="book-cover__dates">
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

      <ul className="book-stats">
        {numbers.map(([value, label]) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div>
        <nav className="book-ribbons" role="tablist" aria-label="Secciones de la campaña">
          {CAMPAIGN_TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              data-tab={name}
              aria-controls="book-page"
              onClick={() => onTab?.(name)}
            >
              {TAB_LABEL[name]}
              {counts[name] !== null && <small> {counts[name]}</small>}
            </button>
          ))}
        </nav>

        <section id="book-page" className="book-page" role="tabpanel" aria-label={TAB_TITLE[tab]}>
          <h2 className="book-page__title">{TAB_TITLE[tab]}</h2>
          <p className="book-page__ornament" aria-hidden="true">
            ❦
          </p>
          {tab === "cronica" && <Chronicle state={state} />}
          {tab === "personajes" &&
            (people.length > 0 ? (
              <ul className="book-gallery">
                {people.map((entry) => (
                  <Card key={entry.name} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="book-empty">Todavía no conociste a nadie.</p>
            ))}
          {tab === "monstruos" && (
            <>
              <p className="book-progress">
                Descubriste {album.found} de {album.total}
              </p>
              <ul className="book-gallery">
                {album.slots.map((slot, index) =>
                  slot.entry ? (
                    <Card key={`${slot.kind}-${slot.entry.name}`} entry={slot.entry} />
                  ) : (
                    <UnknownCard key={`${slot.kind}-${index}`} slot={slot} />
                  ),
                )}
              </ul>
            </>
          )}
        </section>
      </div>
    </article>
  );
}

function Chronicle({ state }: { state: GameState }) {
  const timeline = timelineOf(state);
  const summary = state.summary.split(/\n+/).filter((p) => p.trim() !== "");
  if (summary.length === 0 && timeline.length === 0) {
    return <p className="book-empty">Tu historia recién comienza.</p>;
  }
  return (
    <>
      {summary.length > 0 && (
        <div className="book-prose">
          {summary.map((paragraph, index) => (
            <p key={index}>
              <Inline nodes={parseInline(paragraph)} />
            </p>
          ))}
        </div>
      )}
      {summary.length > 0 && timeline.length > 0 && (
        <p className="book-page__ornament" aria-hidden="true">
          ✦ ✦ ✦
        </p>
      )}
      {timeline.length > 0 && (
        <ol className="book-timeline">
          {timeline.map((entry, index) => (
            <li key={index} data-kind={entry.kind}>
              <span>Turno {entry.turn}</span>
              {momentText(entry)}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** The page for an id that isn't saved in this browser. */
export function CampaignMissing() {
  return (
    <section className="book">
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
