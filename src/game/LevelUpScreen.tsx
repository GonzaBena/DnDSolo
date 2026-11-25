import { useEffect, useRef, useState } from "react";
import { play } from "../audio/sound";
import { enterLevelUp } from "../animations/motion";
import type { BannerQueue } from "./bannerQueue";
import { levelUpFromPlayer, type LevelUp } from "./levelUp";
import { ChoicePicker } from "./ChoicePicker";
import { hiddenErrors, levelSpecs, lockedPicks, pendingLevelUp, pendingSpecs, previewLevelUp } from "../domain/sheetProgress";
import { applySubclassPick, needsSubclassChoice, type SubclassPick } from "../domain/outsideSrd";
import { OUTSIDE_SRD_NOTE_MAX } from "../domain/character";
import { findClass } from "../rules";
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
      {levelUp.customSubclass !== null && (
        <p className="level-up__bonus">Tu subclase está fuera del SRD: revisá tu manual para este nivel.</p>
      )}
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
  onConfirm: (picks: Record<string, string[]>, subclass: SubclassPick | null, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const asksSubclass = player !== null && needsSubclassChoice(player);
  const [subclassKind, setSubclassKind] = useState<"srd" | "custom" | null>(null);
  const [customName, setCustomName] = useState("");
  const pick: SubclassPick | null =
    subclassKind === "srd" ? { kind: "srd" } : subclassKind === "custom" ? { kind: "custom", name: customName } : null;
  const pickValid = !asksSubclass || subclassKind === "srd" || (subclassKind === "custom" && customName.trim() !== "");
  // The player as "Seguir" would leave them: the subclass picked here decides what the level's sheet includes.
  const staged = player && asksSubclass && pick && pickValid ? applySubclassPick(player, pick) : player;
  const asks = staged !== null && pendingLevelUp(staged);
  const [picks, setPicks] = useState(() => (player ? lockedPicks(player) : {}));
  const [note, setNote] = useState(player?.outsideSrd.note ?? "");
  const [saving, setSaving] = useState(false);
  // The preview is null until the level's picks build a valid sheet.
  const preview = asks ? previewLevelUp(staged, picks) : null;
  const specs = asks ? levelSpecs(staged, picks) : [];
  const missing = asks ? pendingSpecs(staged, picks).length : 0;
  const maxHp =
    preview?.ok && player?.stats ? { before: player.stats.maxHp, after: preview.sheet.hitPoints } : undefined;
  // Errors only once every pick is made: before that, "falta elegir" says nothing new.
  const errors = preview && !preview.ok && missing === 0 ? preview.errors : [];
  // Errors the picker can't fix: listed, and "Más tarde" lets the player out instead of trapping them.
  const stuck = asks ? hiddenErrors(staged, picks) : [];
  const shown = staged ? levelUpFromPlayer(staged) : levelUp;
  const srdSubclass = player ? findClass(player.classId ?? player.characterClass)?.subclass : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    play("levelUp");
    enterLevelUp(dialog);
  }, []);

  const confirm = async () => {
    if (player) {
      setSaving(true);
      try {
        await onConfirm(picks, asksSubclass ? pick : null, note);
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
        if ((asks || asksSubclass) && stuck.length === 0) event.preventDefault();
      }}
    >
      <LevelUpContent levelUp={shown} maxHp={maxHp} />
      {asksSubclass && srdSubclass && (
        <fieldset className="choice-picker choice-picker__group level-up__subclass">
          <legend className="choice-picker__label">Subclase</legend>
          <label className="choice-picker__option">
            <input type="radio" name="subclass" checked={subclassKind === "srd"} onChange={() => setSubclassKind("srd")} />
            <span className="choice-picker__text">
              <strong>{srdSubclass.name} (SRD)</strong>
            </span>
          </label>
          <label className="choice-picker__option">
            <input
              type="radio"
              name="subclass"
              checked={subclassKind === "custom"}
              onChange={() => setSubclassKind("custom")}
            />
            <span className="choice-picker__text">
              <strong>Otra de tu manual</strong>
              <input
                type="text"
                maxLength={80}
                value={customName}
                placeholder="Ej: Maestro de las bestias"
                onFocus={() => setSubclassKind("custom")}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </span>
          </label>
        </fieldset>
      )}
      {asks && (
        <ChoicePicker specs={specs} picks={picks} locked={lockedPicks(staged)} errors={errors} onChange={setPicks} />
      )}
      {player && (
        <label className="field level-up__note">
          <span>Fuera del SRD (opcional)</span>
          <textarea rows={3} maxLength={OUTSIDE_SRD_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
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
        autoFocus={!asks && !asksSubclass}
        disabled={saving || !pickValid || (asks && !preview?.ok)}
        onClick={() => void confirm()}
      >
        Seguir
      </button>
    </dialog>
  );
}
