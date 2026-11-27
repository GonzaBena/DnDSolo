import { useEffect, useId, useState, type RefObject } from "react";
import { useAnimatedDialog } from "../../animations/useAnimatedDialog";
import type { StatValues } from "../../domain/statCorrections";

interface AttackRow {
  key: number;
  name: string;
  bonus: string;
  damage: string;
}

interface Props {
  open: boolean;
  /** The values shown now (the stats, corrections included); null when the sheet has none yet. */
  values: StatValues | null;
  /** Whether there is a built sheet to go back to. */
  canReset: boolean;
  /** Whether the shown values already carry corrections. */
  corrected: boolean;
  originRef?: RefObject<Element | null>;
  onClose: () => void;
  /** Resolves to an error message, or null once saved. */
  onSave: (values: StatValues) => Promise<string | null>;
  onReset: () => Promise<string | null>;
  /** A turn is running: the change would land on an older state. */
  disabled?: boolean;
}

const text = (n: number | null) => (n === null ? "" : String(n));
/** Bonuses are written with their sign, as on a sheet: +4, -1. */
const bonus = (n: number | null) => (n === null ? "" : n >= 0 ? `+${n}` : String(n));
const parse = (s: string): number | null => {
  const t = s.trim().replace("−", "-");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
};

let nextKey = 0;

/** Copies the numbers of the player's own sheet into the game: the DM uses
    these instead of the ones the app calculated. */
export function StatsDialog({ open, values, canReset, corrected, originRef, onClose, onSave, onReset, disabled = false }: Props) {
  const dialogProps = useAnimatedDialog(open, onClose, originRef);
  const uid = useId();
  const [maxHp, setMaxHp] = useState("");
  const [armorClass, setArmorClass] = useState("");
  const [initiative, setInitiative] = useState("");
  const [speed, setSpeed] = useState("");
  const [spellSaveDc, setSpellSaveDc] = useState("");
  const [spellAttack, setSpellAttack] = useState("");
  const [attacks, setAttacks] = useState<AttackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Every opening starts from what is stored.
  useEffect(() => {
    if (!open) return;
    setMaxHp(text(values?.maxHp ?? null));
    setArmorClass(text(values?.armorClass ?? null));
    setInitiative(bonus(values?.initiative ?? 0));
    setSpeed(text(values?.speed ?? 30));
    setSpellSaveDc(text(values?.spellSaveDc ?? null));
    setSpellAttack(bonus(values?.spellAttackBonus ?? null));
    setAttacks((values?.attacks ?? []).map((a) => ({ key: nextKey++, name: a.name, bonus: bonus(a.attackBonus), damage: a.damage })));
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
    const required = { maxHp: parse(maxHp), armorClass: parse(armorClass), initiative: parse(initiative), speed: parse(speed) };
    if (Object.values(required).some((n) => n === null)) {
      setError("Completá PG máximos, CA, iniciativa y velocidad.");
      return;
    }
    const rows = attacks.filter((a) => a.name.trim() !== "" || a.bonus.trim() !== "" || a.damage.trim() !== "");
    const parsed: StatValues = {
      maxHp: required.maxHp!,
      armorClass: required.armorClass!,
      initiative: required.initiative!,
      speed: required.speed!,
      spellSaveDc: parse(spellSaveDc),
      spellAttackBonus: parse(spellAttack),
      attacks: rows.map((a) => ({ name: a.name, attackBonus: parse(a.bonus) ?? 0, damage: a.damage })),
    };
    void run(() => onSave(parsed));
  };

  const setRow = (key: number, patch: Partial<AttackRow>) =>
    setAttacks((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const number = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <div className="field">
      <label htmlFor={`${uid}-${id}`}>{label}</label>
      <input
        id={`${uid}-${id}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={hint}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );

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
          Corregir con tu hoja
        </h2>
        <p className="stats-dialog__lead">
          Para lo que las reglas no saben (un escudo +1, PG tirados). Se guarda la diferencia con lo calculado: si cambia
          un atributo o subís de nivel, se recalcula y la diferencia se mantiene. Atributos y competencias se corrigen en
          la ficha completa.
        </p>
        <div className="stats-dialog__grid">
          {number("hp", "PG máximos", maxHp, setMaxHp)}
          {number("ac", "CA", armorClass, setArmorClass)}
          {number("init", "Iniciativa", initiative, setInitiative)}
          {number("speed", "Velocidad (pies)", speed, setSpeed)}
          {number("dc", "CD de conjuros", spellSaveDc, setSpellSaveDc, "—")}
          {number("spell", "Ataque mágico", spellAttack, setSpellAttack, "—")}
        </div>

        <fieldset className="stats-dialog__attacks">
          <legend>Ataques</legend>
          {attacks.length === 0 && <p className="npc-rename__hint">Sin ataques cargados.</p>}
          {attacks.map((a, index) => (
            <div key={a.key} className="stats-dialog__attack">
              <input
                type="text"
                aria-label={`Nombre del ataque ${index + 1}`}
                placeholder="Nombre"
                value={a.name}
                onChange={(e) => setRow(a.key, { name: e.target.value })}
              />
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Bonificador de ${a.name || `ataque ${index + 1}`}`}
                placeholder="+0"
                value={a.bonus}
                onChange={(e) => setRow(a.key, { bonus: e.target.value })}
              />
              <input
                type="text"
                aria-label={`Daño de ${a.name || `ataque ${index + 1}`}`}
                placeholder="1d8+3"
                value={a.damage}
                onChange={(e) => setRow(a.key, { damage: e.target.value })}
              />
              <button
                type="button"
                className="info-step"
                aria-label={`Quitar ${a.name || `ataque ${index + 1}`}`}
                onClick={() => setAttacks((rows) => rows.filter((r) => r.key !== a.key))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="info-link"
            onClick={() => setAttacks((rows) => [...rows, { key: nextKey++, name: "", bonus: "", damage: "" }])}
          >
            + Agregar ataque
          </button>
        </fieldset>

        {error && (
          <p className="npc-rename__error" role="alert">
            {error}
          </p>
        )}
        {disabled && <p className="npc-rename__hint">Esperá a que el DM termine el turno.</p>}
        <div className="actions">
          {canReset && corrected && (
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
