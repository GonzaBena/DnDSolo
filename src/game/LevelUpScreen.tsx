import { useEffect, useRef, useState } from "react";
import { play } from "../audio/sound";
import { enterLevelUp } from "../animations/motion";
import type { BannerQueue } from "./bannerQueue";
import type { LevelUp } from "./levelUp";
import { ChoicePicker } from "./ChoicePicker";
import { hiddenErrors, levelSpecs, lockedPicks, pendingLevelUp, pendingSpecs, previewLevelUp } from "../domain/sheetProgress";
import type { Character } from "../domain/types";

/** Whether to open the next pending level-up screen: only once the turn's
    banners and toasts have left (the screen would hide them), and never
    while one is already open. */
export function shouldOpenLevelUp(
  pending: number,
  banners: BannerQueue | null,
  toastCount: number,
  open: boolean,
): boolean {
  return pending > 0 && !open && banners === null && toastCount === 0;
}

/** What the screen says: the new level, then what it brought. */
export function LevelUpContent({ levelUp, maxHp }: { levelUp: LevelUp; maxHp?: { before: number; after: number } }) {
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
      {maxHp && maxHp.after !== maxHp.before && (
        <p className="level-up__bonus">
          PG máx: {maxHp.before} → {maxHp.after}
        </p>
      )}
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

/** The hero reached a new level: a full screen that stays until "Seguir".
    With stored choices, it also asks for the level's picks and rebuilds the
    sheet before closing; "Seguir" waits until the picks are valid. */
export function LevelUpScreen({
  levelUp,
  player,
  onConfirm,
  onClose,
}: {
  levelUp: LevelUp;
  player: Character | null;
  onConfirm: (picks: Record<string, string[]>) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const asks = player !== null && pendingLevelUp(player);
  const [picks, setPicks] = useState(() => (player ? lockedPicks(player) : {}));
  const [saving, setSaving] = useState(false);
  // The preview is null until the level's picks build a valid sheet.
  const preview = asks ? previewLevelUp(player, picks) : null;
  const specs = asks ? levelSpecs(player, picks) : [];
  const missing = asks ? pendingSpecs(player, picks).length : 0;
  const maxHp =
    preview?.ok && player?.stats ? { before: player.stats.maxHp, after: preview.sheet.hitPoints } : undefined;
  // Errors only once every pick is made: before that, "falta elegir" says nothing new.
  const errors = preview && !preview.ok && missing === 0 ? preview.errors : [];
  // Errors the picker can't fix: listed, and "Más tarde" lets the player out instead of trapping them.
  const stuck = asks ? hiddenErrors(player, picks) : [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    play("levelUp");
    enterLevelUp(dialog);
  }, []);

  const confirm = async () => {
    if (asks) {
      setSaving(true);
      try {
        await onConfirm(picks);
      } finally {
        setSaving(false);
      }
    }
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="level-up"
      aria-labelledby="level-up-title"
      onClose={onClose}
      // Esc would skip the level's choices.
      onCancel={(event) => {
        if (asks && stuck.length === 0) event.preventDefault();
      }}
    >
      <LevelUpContent levelUp={levelUp} maxHp={maxHp} />
      {asks && (
        <ChoicePicker specs={specs} picks={picks} locked={lockedPicks(player)} errors={errors} onChange={setPicks} />
      )}
      {stuck.length > 0 && (
        <div className="notice notice--error level-up__stuck">
          <p>No se puede recalcular la ficha con estas elecciones anteriores:</p>
          <ul>
            {stuck.map((e) => (
              <li key={e.field + e.message}>{e.message}</li>
            ))}
          </ul>
          <button type="button" className="button" onClick={() => dialogRef.current?.close()}>
            Más tarde
          </button>
        </div>
      )}
      <button
        type="button"
        className="button button--primary"
        autoFocus={!asks}
        disabled={saving || (asks && !preview?.ok)}
        onClick={() => void confirm()}
      >
        Seguir
      </button>
    </dialog>
  );
}
