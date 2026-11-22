import { useState } from "react";
import type { CharacterInput } from "../domain/character";
import { BACKGROUND_OPTIONS, CLASSES, MAX_LEVEL, MIN_LEVEL, SPECIES_OPTIONS, createGame } from "../domain/character";
import { statsFromForm } from "../domain/stats";
import { applyBuildChange } from "./buildChange";
import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import { findClass } from "../rules";

interface Props {
  values: CharacterInput;
  onChange: (values: CharacterInput) => void;
}

export function CharacterForm({ values, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const subclass = findClass(values.classId)?.subclass;
  const subclassOption = subclass && values.level >= subclass.level ? subclass : null;
  // Numbers that came with a generated sheet are shown, not edited.
  const [review, setReview] = useState(false);
  const fromSheet = values.stats != null && !review;
  const [manualHp, setManualHp] = useState("");
  const [manualAc, setManualAc] = useState("");
  const set = (patch: Partial<CharacterInput>) => onChange({ ...values, ...patch });
  // The generated stats and gear describe one exact build: see applyBuildChange.
  const setBuild = (patch: Partial<CharacterInput>) => {
    const result = applyBuildChange(values, patch);
    if (result.review && !review && values.stats) {
      setManualHp(String(values.stats.maxHp));
      setManualAc(String(values.stats.armorClass));
    }
    setReview(result.review);
    onChange(result.values);
  };
  const toNumber = (text: string) => (text.trim() === "" || !Number.isFinite(Number(text)) ? null : Math.trunc(Number(text)));

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const stats =
        values.stats && review
          ? {
              ...values.stats,
              maxHp: toNumber(manualHp) ?? values.stats.maxHp,
              armorClass: toNumber(manualAc) ?? values.stats.armorClass,
            }
          : fromSheet
            ? values.stats
            : statsFromForm(toNumber(manualHp), toNumber(manualAc));
      const game = createGame({ ...values, stats, subclassId: subclassOption ? values.subclassId : null });
      // The new game becomes the latest save, which is what /play opens.
      await new IndexedDBGameRepo().save(game);
      location.href = "/play";
    } catch {
      setError("No se pudo guardar la partida en este navegador.");
      setSaving(false);
    }
  }

  return (
    <form id="character-form" className="form" onSubmit={submit}>
      <label className="field">
        <span>Nombre</span>
        <input
          type="text"
          maxLength={40}
          required
          autoComplete="off"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Especie</span>
        <select value={values.speciesId} onChange={(e) => setBuild({ speciesId: e.target.value })}>
          {SPECIES_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Clase</span>
        <select value={values.classId} onChange={(e) => setBuild({ classId: e.target.value, subclassId: null })}>
          {CLASSES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Nivel</span>
        <input
          type="number"
          min={MIN_LEVEL}
          max={MAX_LEVEL}
          required
          value={values.level}
          onChange={(e) => setBuild({ level: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>
          Subclase
          {subclass && !subclassOption && <small> (desde el nivel {subclass.level})</small>}
        </span>
        <select
          disabled={!subclassOption}
          value={subclassOption ? (values.subclassId ?? "") : ""}
          onChange={(e) => set({ subclassId: e.target.value || null })}
        >
          <option value="">Ninguna</option>
          {subclassOption && <option value={subclassOption.id}>{subclassOption.name}</option>}
        </select>
      </label>

      <label className="field">
        <span>Trasfondo (reglas)</span>
        <select value={values.srdBackgroundId ?? ""} onChange={(e) => setBuild({ srdBackgroundId: e.target.value || null })}>
          <option value="">Ninguno</option>
          {BACKGROUND_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>
          Trasfondo (historia) <small>(opcional)</small>
        </span>
        <textarea
          rows={3}
          maxLength={2000}
          value={values.background}
          onChange={(e) => set({ background: e.target.value })}
          placeholder="Ej: ex soldado que busca a su hermana desaparecida."
        />
      </label>

      <label className="field">
        <span>
          PG máximos <small>(opcional)</small>
        </span>
        <input
          type="number"
          min={1}
          max={999}
          inputMode="numeric"
          readOnly={fromSheet}
          value={fromSheet ? values.stats!.maxHp : manualHp}
          onChange={(e) => setManualHp(e.target.value)}
        />
      </label>

      <label className="field">
        <span>
          Clase de armadura <small>(opcional)</small>
        </span>
        <input
          type="number"
          min={1}
          max={40}
          inputMode="numeric"
          readOnly={fromSheet}
          value={fromSheet ? values.stats!.armorClass : manualAc}
          onChange={(e) => setManualAc(e.target.value)}
        />
        <small>
          {fromSheet
            ? "De la ficha generada"
            : review
              ? "Cambiaste la especie: revisá los PG y la CA."
              : "Si los completás, la app lleva tus PG (hacen falta los dos)."}
        </small>
      </label>

      <p className="status" role="status" aria-live="polite" data-tone={error ? "error" : undefined}>
        {error ?? ""}
      </p>
      <div className="actions">
        <a className="button" href="/">
          Volver
        </a>
        <button type="submit" className="button button--primary" disabled={saving}>
          Empezar la aventura
        </button>
      </div>
    </form>
  );
}
