import { useEffect, useRef, useState } from "react";
import type { CharacterInput } from "../domain/character";
import { BACKGROUND_OPTIONS, CLASSES, SPECIES_OPTIONS } from "../domain/character";
import { enterDrawer, leaveDrawer } from "../animations/motion";
import { findClass } from "../rules";
import { heroPortraitUrl } from "../domain/heroPortraits";

interface Props {
  values: CharacterInput;
  /** What the HP and AC fields show right now, typed or from a generated sheet. */
  hp: string;
  ac: string;
  saving: boolean;
}

const STORY_PREVIEW = 160;
// Same breakpoint as .creator-layout in character.css.
const WIDE = "(min-width: 56rem)";

const labelOf = (options: { id: string; label: string }[], id: string | null) =>
  options.find((o) => o.id === id)?.label ?? null;

/** The character as the DM will meet it, updated as the form changes. */
function CharacterCard({ values, hp, ac }: Omit<Props, "saving">) {
  const species = labelOf(SPECIES_OPTIONS, values.speciesId);
  const className = labelOf(CLASSES, values.classId);
  const subclass = findClass(values.classId)?.subclass;
  const subclassName = subclass && values.subclassId === subclass.id ? subclass.name : null;
  const background = labelOf(BACKGROUND_OPTIONS, values.srdBackgroundId);
  const story = values.background.trim();
  const name = values.name.trim();
  const portraitUrl = heroPortraitUrl(values.portrait ?? null);

  return (
    <div className={`character-card${portraitUrl ? " character-card--portrait" : ""}`}>
      <div className="character-card__crest" aria-hidden="true">
        <span className="character-card__die">{values.level}</span>
        {portraitUrl && (
          <img className="character-card__portrait" src={portraitUrl} alt="" decoding="async" />
        )}
      </div>
      <div className="character-card__body">
        <p className="character-card__eyebrow">Así te verá el DM</p>
        <h2 className="character-card__name" data-empty={!name || undefined}>
          {name || "Sin nombre"}
        </h2>
        <p className="character-card__line">
          {species} · {className}
          {subclassName && ` (${subclassName})`} · Nivel {values.level}
        </p>
        {(hp || ac) && (
          <p className="character-card__pills">
            {hp && <span className="pill pill--hp">♥ {hp} PG</span>}
            {ac && <span className="pill pill--ac">CA {ac}</span>}
            {values.stats?.spellSaveDc !== null && values.stats?.spellSaveDc !== undefined && (
              <span className="pill">CD {values.stats.spellSaveDc}</span>
            )}
          </p>
        )}
        {values.stats && values.stats.attacks.length > 0 && (
          <dl className="character-card__facts">
            <dt>Ataques</dt>
            <dd>
              {values.stats.attacks
                .slice(0, 2)
                .map((a) => `${a.name} (${a.attackBonus >= 0 ? `+${a.attackBonus}` : a.attackBonus}, ${a.damage})`)
                .join(" · ")}
            </dd>
          </dl>
        )}
        {background && (
          <dl className="character-card__facts">
            <dt>Trasfondo</dt>
            <dd>{background}</dd>
          </dl>
        )}
        {story && (
          <p className="character-card__story">
            {story.length > STORY_PREVIEW ? `${story.slice(0, STORY_PREVIEW).trimEnd()}…` : story}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Wide screens: the card sits beside the form, sticky, with the submit button.
 * Narrow screens: a floating button opens it in a drawer, like the /docs index.
 */
export function CharacterPreview(props: Props) {
  const drawerRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);
  const [open, setOpen] = useState(false);

  function show() {
    const drawer = drawerRef.current;
    if (!drawer || drawer.open) return;
    drawer.showModal();
    setOpen(true);
    if (panelRef.current) enterDrawer(panelRef.current);
  }

  function hide() {
    const drawer = drawerRef.current;
    const panel = panelRef.current;
    if (!drawer?.open || !panel || leavingRef.current) return;
    leavingRef.current = true;
    leaveDrawer(panel, () => {
      leavingRef.current = false;
      drawer.close();
      panel.style.transform = ""; // the next opening slides in from scratch
    });
  }

  // Back to a wide screen with the drawer open: the side card takes over, at once.
  useEffect(() => {
    const media = matchMedia(WIDE);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches && drawerRef.current?.open) drawerRef.current.close();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <aside className="character-preview" aria-label="Vista previa del personaje">
        <CharacterCard {...props} />
        <button type="submit" form="character-form" className="button button--primary" disabled={props.saving}>
          Empezar la aventura
        </button>
      </aside>

      <button
        type="button"
        className="character-fab"
        aria-label="Ver la ficha"
        aria-controls="character-drawer"
        aria-expanded={open}
        onClick={show}
      >
        <span aria-hidden="true">{props.values.level}</span>
      </button>

      <dialog
        ref={drawerRef}
        id="character-drawer"
        className="character-drawer"
        aria-label="Vista previa del personaje"
        onClose={() => setOpen(false)}
        // Escape: animate the way out instead of the browser's instant close.
        onCancel={(event) => {
          event.preventDefault();
          hide();
        }}
        // The dialog covers the screen; a click outside the panel lands on it.
        onClick={(event) => {
          if (event.target === drawerRef.current) hide();
        }}
      >
        <div ref={panelRef} className="character-drawer__panel">
          <CharacterCard {...props} />
        </div>
        {/* The modal covers the page button, so the drawer brings its own in the same spot. */}
        <button type="button" className="character-fab" aria-label="Ocultar la ficha" onClick={hide}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </dialog>
    </>
  );
}
