import { useEffect, useState } from "react";
import type { CharacterInput } from "../domain/character";
import { BACKGROUND_OPTIONS, CLASSES, MAX_LEVEL, MIN_LEVEL, OUTSIDE_SRD_NOTE_MAX, SPECIES_OPTIONS, createGame } from "../domain/character";
import { inventoryFromSheet, statsFromForm, statsFromSheet } from "../domain/stats";
import { applyBuildChange, levelTextFor, mergeReviewedStats, parseLevel, parseWholeNumber } from "./buildChange";
import { createGameRepo } from "../sync/runtime";
import { LOADED_MAX_LEVEL, findClass } from "../rules";
import { buildQuickChoices } from "../rules/quickBuild";
import { CharacterPreview } from "./CharacterPreview";
import { PortraitChooser } from "./PortraitPicker";
import { genderOf, portraitFor } from "../domain/heroPortraits";

interface Props {
  values: CharacterInput;
  onChange: (values: CharacterInput) => void;
  /** When provided, submitting advances to the campaign selection step instead of saving immediately. */
  onNext?: (prepared: CharacterInput) => void;
}

export function CharacterForm({ values, onChange, onNext }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const subclass = findClass(values.classId)?.subclass;
  const subclassOption = subclass && values.level >= subclass.level ? subclass : null;
  // Numbers that came with a generated sheet are shown, not edited.
  const [review, setReview] = useState(false);
  const fromSheet = values.stats != null && !review;
  const [manualHp, setManualHp] = useState("");
  const [manualAc, setManualAc] = useState("");
  // The level is typed as text so clearing the field mid-edit doesn't change the build.
  const [levelText, setLevelText] = useState(String(values.level));
  // A generated sheet arrives after mount: follow the level when it changes from outside.
  useEffect(() => {
    setLevelText((text) => levelTextFor(text, values.level));
  }, [values.level]);
  const set = (patch: Partial<CharacterInput>) => onChange({ ...values, ...patch });
  // The gender of the last picked portrait, kept across classes (even one without portraits); none for the initials.
  const [portraitGender, setPortraitGender] = useState(() => genderOf(values.portrait));
  // The generated stats and gear describe one exact build: see applyBuildChange.
  const setBuild = (patch: Partial<CharacterInput>) => {
    const result = applyBuildChange(values, patch);
    if (result.review && !review && values.stats) {
      setManualHp(String(values.stats.maxHp));
      setManualAc(String(values.stats.armorClass));
    }
    // A dropped sheet leaves nothing to review: forget the prefilled numbers.
    if (values.stats && !result.values.stats) {
      setManualHp("");
      setManualAc("");
    }
    setReview(result.review);
    onChange(result.values);
  };
  const toNumber = parseWholeNumber;
  const onlyOneFilled = !fromSheet && !review && (manualHp.trim() === "") !== (manualAc.trim() === "");
  const canQuickBuild = values.level >= 1 && values.level <= LOADED_MAX_LEVEL;

  function applyQuickBuild() {
    const built = buildQuickChoices({
      speciesId: values.speciesId,
      classId: values.classId,
      backgroundId: values.srdBackgroundId,
      level: values.level,
    });
    if (!built) return;
    setReview(false);
    setManualHp("");
    setManualAc("");
    onChange({
      ...values,
      srdBackgroundId: built.choices.backgroundId,
      choices: built.choices,
      stats: statsFromSheet(built.sheet),
      startingInventory: inventoryFromSheet(built.sheet),
    });
  }

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setError(null);
    const stats =
      values.stats && review
        ? mergeReviewedStats(values.stats, manualHp, manualAc)
        : fromSheet
          ? values.stats
          : statsFromForm(toNumber(manualHp), toNumber(manualAc), values.speciesId);
    const prepared: CharacterInput = {
      ...values,
      stats,
      subclassId: subclassOption ? values.subclassId : null,
    };

    if (onNext) {
      onNext(prepared);
      return;
    }

    setSaving(true);
    try {
      const game = createGame(prepared);
      // The new game becomes the latest save, which is what /play opens.
      await createGameRepo().save(game);
      location.href = "/play";
    } catch {
      setError("No se pudo guardar la partida en este navegador.");
      setSaving(false);
    }
  }

  const shownHp = fromSheet ? String(values.stats!.maxHp) : manualHp.trim();
  const shownAc = fromSheet ? String(values.stats!.armorClass) : manualAc.trim();
  const filledStats = (shownHp ? 1 : 0) + (shownAc ? 1 : 0);
  const statLink = filledStats === 2 ? "complete" : filledStats === 1 ? "partial" : "empty";

  return (
    <div className="creator-layout">
      <form id="character-form" className="form character-form" onSubmit={submit}>
        <div className="form-row form-row--name">
          <label className="field field--name">
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
            <span>Nivel</span>
            <input
              type="number"
              min={MIN_LEVEL}
              max={MAX_LEVEL}
              required
              value={levelText}
              onChange={(e) => {
                setLevelText(e.target.value);
                const level = parseLevel(e.target.value);
                if (level !== null) setBuild({ level });
              }}
              onBlur={() => setLevelText(String(values.level))}
            />
          </label>
        </div>
        <PortraitChooser
          classId={values.classId}
          name={values.name}
          value={values.portrait ?? null}
          onPick={(portrait) => {
            setPortraitGender(genderOf(portrait));
            set({ portrait });
          }}
        />
        <div className="form-row form-row--3">
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
            <select value={values.classId} onChange={(e) =>
                setBuild({
                  classId: e.target.value,
                  subclassId: null,
                  // The portraits are the class's: the new class's bust of the same gender.
                  portrait: portraitFor(e.target.value, portraitGender),
                })
              }>
              {CLASSES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
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
        </div>
        <div className="form-row form-row--stats">
          <label className="field field--background">
            <span>Trasfondo (reglas)</span>
            <select
              value={values.srdBackgroundId ?? ""}
              onChange={(e) => setBuild({ srdBackgroundId: e.target.value || null })}
            >
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
              CA <small>(opcional)</small>
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
          </label>
          {/* Chains HP and AC together: they only count as a pair. */}
          <div className="stat-link" data-state={statLink} aria-hidden="true">
            <svg className="stat-link__chain" viewBox="0 0 36 18" width="48" height="24">
              <rect x="2" y="4" width="18" height="10" rx="5" />
              <rect x="16" y="4" width="18" height="10" rx="5" />
            </svg>
          </div>
        </div>
        <div className="form-hints">
          <small className="form-hint">
            {fromSheet
              ? "De la ficha SRD cargada (incluye equipo inicial, ataques y conjuros)"
              : review
                ? "Cambiaste la especie: revisá los PG y la CA."
                : "Si los completás, la app lleva tus PG (hacen falta los dos)."}
          </small>
          {canQuickBuild && !fromSheet && (
            <div className="form-quick">
              <button type="button" className="button button--small" onClick={applyQuickBuild}>
                Completar ficha SRD rápida
              </button>
              <small className="form-hint">Calcula PG, CA, ataques, conjuros y equipo inicial al instante.</small>
            </div>
          )}
          {onlyOneFilled && (
            <small className="form-hint" role="status">
              Completá los dos para que la app lleve tus PG.
            </small>
          )}
        </div>
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
            Fuera del SRD <small>(opcional)</small>
          </span>
          <textarea
            rows={2}
            maxLength={OUTSIDE_SRD_NOTE_MAX}
            value={values.outsideSrdNote ?? ""}
            onChange={(e) => set({ outsideSrdNote: e.target.value })}
            placeholder="Ej: subclase Maestro de batalla, trasfondo Ermitaño, elfo del bosque."
          />
          <small>
            Solo opciones oficiales de creación acordes a tu nivel (rasgos, subclases o conjuros). El equipo se consigue jugando.
          </small>
        </label>
        <p className="status" role="status" aria-live="polite" data-tone={error ? "error" : undefined}>
          {error ?? ""}
        </p>
        <div className="actions">
          <a className="button" href="/">
            Volver
          </a>
          <button type="submit" className="button button--primary form-submit" disabled={saving}>
            Empezar la aventura
          </button>
        </div>
      </form>

      <CharacterPreview values={values} hp={shownHp} ac={shownAc} saving={saving} />
    </div>
  );
}
