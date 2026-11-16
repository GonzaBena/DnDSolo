import { useState } from "react";
import type { CharacterInput } from "../domain/character";
import { BACKGROUND_OPTIONS, CLASSES, MAX_LEVEL, MIN_LEVEL, SPECIES_OPTIONS, createGame } from "../domain/character";
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
  const set = (patch: Partial<CharacterInput>) => onChange({ ...values, ...patch });

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const game = createGame({ ...values, subclassId: subclassOption ? values.subclassId : null });
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
        <select value={values.speciesId} onChange={(e) => set({ speciesId: e.target.value })}>
          {SPECIES_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Clase</span>
        <select value={values.classId} onChange={(e) => set({ classId: e.target.value, subclassId: null })}>
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
          onChange={(e) => set({ level: Number(e.target.value) })}
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
        <select value={values.srdBackgroundId ?? ""} onChange={(e) => set({ srdBackgroundId: e.target.value || null })}>
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
