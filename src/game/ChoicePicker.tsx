import type { ChoiceError } from "../rules/buildSheet";
import type { ChoiceSpec } from "../rules/types";

type Picks = Record<string, string[]>;

/** Adds (+1) or removes (-1) one copy of `optionId`. Locked picks are never removed and the total never passes
    `spec.count`; only `allowRepeat` choices take the same option twice (Ability Score Improvement: +2 to one). */
export function togglePick(spec: ChoiceSpec, current: string[], locked: string[], optionId: string, delta: 1 | -1): string[] {
  if (delta === 1) {
    if (current.length >= spec.count) return current;
    if (!spec.allowRepeat && current.includes(optionId)) return current;
    return [...current, optionId];
  }
  const taken = current.filter((id) => id === optionId).length;
  const fixed = locked.filter((id) => id === optionId).length;
  if (taken <= fixed) return current;
  const index = current.lastIndexOf(optionId);
  return [...current.slice(0, index), ...current.slice(index + 1)];
}

interface Props {
  specs: ChoiceSpec[];
  picks: Picks;
  locked: Picks;
  errors: ChoiceError[];
  onChange: (picks: Picks) => void;
}

/** One group per choice the level brings: what is already chosen stays fixed, the rest is picked here. */
export function ChoicePicker({ specs, picks, locked, errors, onChange }: Props) {
  return (
    <div className="choice-picker">
      {specs.map((spec) => {
        const current = picks[spec.id] ?? [];
        const fixed = locked[spec.id] ?? [];
        const missing = spec.count - fixed.length;
        const single = missing === 1 && !spec.allowRepeat;
        const change = (optionId: string, delta: 1 | -1) =>
          onChange({ ...picks, [spec.id]: togglePick(spec, current, fixed, optionId, delta) });
        const specErrors = errors.filter((e) => e.field === `picks.${spec.id}`);
        return (
          <fieldset key={spec.id} className="choice-picker__group">
            <legend className="choice-picker__label">
              {spec.label} <span className="choice-picker__count">Elegí {missing}</span>
            </legend>
            {spec.options.map((option) => {
              const times = current.filter((id) => id === option.id).length;
              const isLocked = fixed.includes(option.id);
              const text = (
                <span className="choice-picker__text">
                  <strong>{option.name}</strong>
                  <span>{option.summary}</span>
                </span>
              );
              if (spec.allowRepeat) {
                return (
                  <div key={option.id} className="choice-picker__option choice-picker__option--counter">
                    {text}
                    <span className="choice-picker__counter">
                      <button type="button" aria-label={`Quitar ${option.name}`} disabled={times === 0} onClick={() => change(option.id, -1)}>
                        −
                      </button>
                      <output>{times}</output>
                      <button type="button" aria-label={`Sumar ${option.name}`} onClick={() => change(option.id, 1)}>
                        +
                      </button>
                    </span>
                  </div>
                );
              }
              const checked = times > 0;
              const onToggle = () => {
                if (isLocked) return;
                // A radio replaces the one free pick; checkboxes add or remove.
                if (single) onChange({ ...picks, [spec.id]: [...fixed, option.id] });
                else change(option.id, checked ? -1 : 1);
              };
              return (
                <label key={option.id} className="choice-picker__option">
                  <input
                    type={single && !isLocked ? "radio" : "checkbox"}
                    name={spec.id}
                    checked={checked}
                    disabled={isLocked}
                    onChange={onToggle}
                  />
                  {text}
                </label>
              );
            })}
            {specErrors.map((e) => (
              <p key={e.message} className="choice-picker__error">
                {e.message}
              </p>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
