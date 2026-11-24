import { useEffect, useRef } from "react";
import { enterLevelUp } from "../animations/motion";
import type { BannerQueue } from "./bannerQueue";
import type { LevelUp } from "./levelUp";

/** The level-up screen waits for the turn's banners to leave first. */
export function levelUpVisible(levelUp: LevelUp | null, banners: BannerQueue | null): boolean {
  return levelUp !== null && banners === null;
}

/** What the screen says: the new level, then what it brought. */
export function LevelUpContent({ levelUp }: { levelUp: LevelUp }) {
  return (
    <div className="level-up__content">
      <span className="level-up__star" aria-hidden="true">
        ⭐
      </span>
      <h2 id="level-up-title" className="level-up__title">
        ¡Nivel {levelUp.level}!
      </h2>
      <p className="level-up__name">{levelUp.name}</p>
      {levelUp.subclass !== null && <p className="level-up__subclass">Subclase: {levelUp.subclass}</p>}
      {levelUp.proficiencyBonus !== null && (
        <p className="level-up__bonus">Bonificador de competencia: +{levelUp.proficiencyBonus}</p>
      )}
      {levelUp.features.length > 0 && (
        <ul className="level-up__features">
          {levelUp.features.map((feature) => (
            <li key={feature.name}>
              <strong>{feature.name}</strong>
              <span>{feature.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The hero reached a new level: a full screen that stays until "Seguir". */
export function LevelUpScreen({ levelUp, onClose }: { levelUp: LevelUp; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    enterLevelUp(dialog);
  }, []);

  return (
    <dialog ref={dialogRef} className="level-up" aria-labelledby="level-up-title" onClose={onClose}>
      <LevelUpContent levelUp={levelUp} />
      <button type="button" className="button button--primary" autoFocus onClick={() => dialogRef.current?.close()}>
        Seguir
      </button>
    </dialog>
  );
}
