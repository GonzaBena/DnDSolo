import { TopBanner } from "./TopBanner";

type Outcome = "completed" | "failed";

/** Failed stays up a little longer, so the burn ends before it leaves. */
const SHOWN_MS: Record<Outcome, number> = { completed: 3000, failed: 3200 };

/** The banner's content. Hidden from screen readers: the turn's
    announcement says which quest closed (see milestoneAnnouncement). */
export function QuestStrip({ outcome, title }: { outcome: Outcome; title: string }) {
  return (
    <div className="quest-banner__inner" aria-hidden="true">
      <span className="quest-banner__kicker">{outcome === "completed" ? "Misión cumplida" : "Misión fallida"}</span>
      <strong className="quest-banner__title">{title}</strong>
      {outcome === "completed" ? (
        <span className="quest-banner__seal" aria-hidden="true">
          ✓
        </span>
      ) : (
        <span className="quest-banner__flame" aria-hidden="true">
          🔥
        </span>
      )}
    </div>
  );
}

/** A quest closed: a parchment strip drops from the top and gets sealed,
    or burns. */
export function QuestBanner({ outcome, title, onDone }: { outcome: Outcome; title: string; onDone: () => void }) {
  return (
    <TopBanner
      className={`quest-banner quest-banner--${outcome}`}
      shownMs={SHOWN_MS[outcome]}
      sound={outcome === "completed" ? "questDone" : "questFailed"}
      onDone={onDone}
    >
      <QuestStrip outcome={outcome} title={title} />
    </TopBanner>
  );
}
