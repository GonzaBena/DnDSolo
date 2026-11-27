import { useEffect, useId, useState, type RefObject } from "react";
import { useAnimatedDialog } from "../../animations/useAnimatedDialog";
import type { AbilityValues } from "../../domain/statCorrections";
import type { SkillTier } from "../../domain/types";
import { ABILITIES, ABILITY_NAMES, SKILLS, type Ability, type SkillId } from "../../rules/types";

/** Skills in Spanish alphabetical order, as the sheet lists them. */
const SKILLS_ES = [...SKILLS].sort((a, b) => a.name.localeCompare(b.name, "es"));

const TIERS: { id: SkillTier; label: string }[] = [
  { id: "none", label: "—" },
  { id: "proficient", label: "Competente" },
  { id: "expertise", label: "Pericia" },
];

interface Props {
  open: boolean;
  /** What the sheet shows now (corrections included). */
  values: AbilityValues;
  /** Whether the shown values already carry corrections. */
  corrected: boolean;
  originRef?: RefObject<Element | null>;
  onClose: () => void;
  /** Resolves to an error message, or null once saved. */
  onSave: (values: AbilityValues) => Promise<string | null>;
  onReset: () => Promise<string | null>;
  disabled?: boolean;
}

/** Copies the ability scores, save proficiencies and skill training of the
    player's own sheet over the calculated ones. */
export function AbilitiesDialog({ open, values, corrected, originRef, onClose, onSave, onReset, disabled = false }: Props) {
  const dialogProps = useAnimatedDialog(open, onClose, originRef);
  const uid = useId();
  const [scores, setScores] = useState<Record<Ability, string>>({} as Record<Ability, string>);
  const [saves, setSaves] = useState(values.saves);
  const [skills, setSkills] = useState(values.skills);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Every opening starts from what is stored.
  useEffect(() => {
    if (!open) return;
    setScores(Object.fromEntries(ABILITIES.map((a) => [a, String(values.scores[a])])) as Record<Ability, string>);
    setSaves(values.saves);
    setSkills(values.skills);
    setError(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (task: () => Promise<string | null>) => {
    setSaving(true);
    try {
      const message = await task();
      if (message) setError(message);
      else onClose();
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const parsed = Object.fromEntries(
      ABILITIES.map((a) => [a, scores[a]?.trim() === "" ? Number.NaN : Number(scores[a])]),
    ) as Record<Ability, number>;
    void run(() => onSave({ scores: parsed, saves, skills }));
  };

  return (
    <dialog {...dialogProps} className="roll-dialog stats-dialog" aria-labelledby={`${uid}-title`}>
      <form
        className="roll-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !saving) submit();
        }}
      >
        <h2 id={`${uid}-title`} className="roll-dialog__title">
          Atributos y habilidades
        </h2>
        <p className="stats-dialog__lead">
          Copiá las puntuaciones y competencias de tu hoja. Todo lo que depende de ellas se recalcula con las reglas:
          modificadores, salvaciones, habilidades, PG, CA, iniciativa, ataques y CD de conjuros.
        </p>

        <fieldset className="abilities-dialog__group">
          <legend>Puntuaciones y salvaciones</legend>
          <div className="abilities-dialog__scores">
            {ABILITIES.map((a) => (
              <div key={a} className="abilities-dialog__score">
                <label htmlFor={`${uid}-${a}`}>{ABILITY_NAMES[a]}</label>
                <input
                  id={`${uid}-${a}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={scores[a] ?? ""}
                  onChange={(e) => setScores((s) => ({ ...s, [a]: e.target.value }))}
                />
                <label className="abilities-dialog__check">
                  <input
                    type="checkbox"
                    checked={saves[a]}
                    onChange={(e) => setSaves((s) => ({ ...s, [a]: e.target.checked }))}
                  />
                  Salvación
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="abilities-dialog__group">
          <legend>Habilidades</legend>
          <ul className="abilities-dialog__skills">
            {SKILLS_ES.map((k) => (
              <li key={k.id}>
                <label htmlFor={`${uid}-${k.id}`}>{k.name}</label>
                <select
                  id={`${uid}-${k.id}`}
                  value={skills[k.id as SkillId] ?? "none"}
                  onChange={(e) => setSkills((s) => ({ ...s, [k.id]: e.target.value as SkillTier }))}
                >
                  {TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </fieldset>

        {error && (
          <p className="npc-rename__error" role="alert">
            {error}
          </p>
        )}
        {disabled && <p className="npc-rename__hint">Esperá a que el DM termine el turno.</p>}
        <div className="actions">
          {corrected && (
            <button type="button" className="button" disabled={disabled || saving} onClick={() => void run(onReset)}>
              Volver a lo calculado
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button--primary" disabled={disabled || saving}>
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  );
}
