import { useEffect, useId, useState } from "react";
import { OUTSIDE_SRD_NOTE_MAX } from "../domain/character";
import { SUBCLASS_NAME_MAX, type SubclassPick } from "../domain/outsideSrd";
import { nonSrdSubclassesFor } from "../domain/outsideSrdCatalog";
import type { Character } from "../domain/types";
import { findClass } from "../rules";

export interface OutsideSrdEdit {
  note: string;
  subclass: SubclassPick | null;
}

/** Info: what the character has outside the SRD (a note for the DM) and, past the subclass level, which subclass. */
export function OutsideSrdSection({
  player,
  onSave,
  onUpgradeSheet,
}: {
  player: Character;
  onSave: (edit: OutsideSrdEdit) => Promise<void>;
  /** Present when the sheet's rules choices can be completed (a sheet without them). */
  onUpgradeSheet?: () => void;
}) {
  const classObj = findClass(player.classId ?? player.characterClass);
  const srd = classObj?.subclass;
  const subclassSuggestions = nonSrdSubclassesFor(classObj?.id);
  const datalistId = useId();
  const reached = srd !== undefined && player.level >= srd.level;
  const initialKind = player.outsideSrd.subclass !== null ? "custom" : player.subclassId !== null ? "srd" : null;
  const [note, setNote] = useState(player.outsideSrd.note);
  const [kind, setKind] = useState<"srd" | "custom" | null>(initialKind);
  const [name, setName] = useState(player.outsideSrd.subclass ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  // A save (or a level up) changed the player: start from what is stored.
  useEffect(() => {
    setNote(player.outsideSrd.note);
    setKind(player.outsideSrd.subclass !== null ? "custom" : player.subclassId !== null ? "srd" : null);
    setName(player.outsideSrd.subclass ?? "");
  }, [player.outsideSrd.note, player.outsideSrd.subclass, player.subclassId]);

  const subclassChanged =
    kind !== initialKind || (kind === "custom" && name.trim() !== (player.outsideSrd.subclass ?? ""));
  const changed = note.trim() !== player.outsideSrd.note || subclassChanged;
  const valid = kind !== "custom" || name.trim() !== "";

  const save = async () => {
    setStatus("saving");
    const subclass: SubclassPick | null = !subclassChanged
      ? null
      : kind === "srd"
        ? { kind: "srd" }
        : kind === "custom"
          ? { kind: "custom", name }
          : null;
    try {
      await onSave({ note, subclass });
      setFailure(null);
      setStatus("saved");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "No se pudo guardar.");
      setStatus("idle");
    }
  };

  return (
    <section className="info-section outside-srd">
      <h3>Fuera del SRD</h3>
      <label className="field">
        <span>Lo que tu personaje tiene y no está en el SRD. El DM lo tiene en cuenta.</span>
        <textarea
          rows={3}
          maxLength={OUTSIDE_SRD_NOTE_MAX}
          value={note}
          placeholder="Ej: trasfondo Ermitaño, elfo de los bosques."
          onChange={(e) => {
            setNote(e.target.value);
            setStatus("idle");
          }}
        />
      </label>
      {reached && srd && (
        <fieldset className="outside-srd__subclass">
          <legend>Subclase</legend>
          <label>
            <input type="radio" name="outside-srd-subclass" checked={kind === "srd"} onChange={() => setKind("srd")} />
            {srd.name} (SRD)
          </label>
          <label>
            <input type="radio" name="outside-srd-subclass" checked={kind === "custom"} onChange={() => setKind("custom")} />
            Otra de tu manual
          </label>
          {kind === "custom" && (
            <>
              <input
                type="text"
                maxLength={SUBCLASS_NAME_MAX}
                list={subclassSuggestions.length > 0 ? datalistId : undefined}
                value={name}
                placeholder="Ej: Maestro de batalla"
                aria-label="Nombre de la subclase"
                onChange={(e) => {
                  setName(e.target.value);
                  setStatus("idle");
                }}
              />
              {subclassSuggestions.length > 0 && (
                <datalist id={datalistId}>
                  {subclassSuggestions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </fieldset>
      )}
      {onUpgradeSheet && (
        <p className="outside-srd__upgrade">
          Tu ficha no tiene guardadas sus elecciones de reglas: sin ellas, al subir de nivel no se recalculan los PG.{" "}
          <button type="button" className="button button--small" onClick={onUpgradeSheet}>
            Completar elecciones
          </button>
        </p>
      )}
      <div className="outside-srd__actions">
        <button
          type="button"
          className="button button--small"
          disabled={!changed || !valid || status === "saving"}
          onClick={() => void save()}
        >
          Guardar
        </button>
        <span role="status" aria-live="polite">
          {status === "saved" ? "Guardado." : failure ?? ""}
        </span>
      </div>
    </section>
  );
}
