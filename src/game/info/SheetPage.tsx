import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { enterMenu, leaveMenu, motionAllowed } from "../../animations/motion";
import { copyText } from "../../character/clipboard";
import { formatSheetMarkdown, formatSheetText } from "../../rules/formatSheet";
import type { CharacterStats } from "../../domain/types";
import { ABILITIES, ABILITY_NAMES, SKILLS, type Ability, type CharacterSheet } from "../../rules/types";
import { abilityValuesOf, type AbilityValues } from "../../domain/statCorrections";
import { AbilitiesDialog } from "./AbilitiesDialog";
import { Icon } from "./icons";
import { signed, speedInFeet } from "./format";

/** How long the index button stays after the last scroll. */
const INDEX_HIDE_AFTER_MS = 5000;

const ABILITY_SHORT: Record<Ability, string> = { str: "FUE", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR" };
const SKILL_ABILITY = new Map(SKILLS.map((s) => [s.id, s.ability]));

interface Props {
  sheet: CharacterSheet;
  /** The numbers the DM uses (with the player's corrections); they win over the sheet's. */
  stats: CharacterStats | null;
  /** Whether the player corrected the combat numbers. */
  corrected: boolean;
  /** Whether the player corrected abilities, saves or skills. */
  abilitiesCorrected: boolean;
  /** Saves the ability, save and skill corrections; resolves to an error or null. Without it they can't be edited. */
  onCorrectAbilities?: (values: AbilityValues) => Promise<string | null>;
  onResetAbilities?: () => Promise<string | null>;
  turnRunning?: boolean;
  name: string;
  story: string;
  onBack: () => void;
}

interface Section {
  id: string;
  title: string;
}

/** The full character sheet, laid out like one: ability blocks, a skills
    table, collapsible features. A floating index jumps between sections. */
export function SheetPage({
  sheet: s,
  stats,
  corrected,
  abilitiesCorrected,
  onCorrectAbilities,
  onResetAbilities,
  turnRunning = false,
  name,
  story,
  onBack,
}: Props) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement | null>(null);
  const editButton = (label: string) =>
    onCorrectAbilities ? (
      <button
        type="button"
        className="info-link"
        aria-label={label}
        onClick={(event) => {
          editRef.current = event.currentTarget;
          setEditing(true);
        }}
      >
        <Icon name="pencil" size={15} />
        Corregir
      </button>
    ) : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const klass = s.subclass ? `${s.className} (${s.subclass})` : s.className;
  const sc = s.spellcasting;
  const hasSpells = sc !== null || s.otherSpells.length > 0;
  const ids = {
    abilities: "sheet-abilities",
    combat: "sheet-combat",
    skills: "sheet-skills",
    spells: "sheet-spells",
    features: "sheet-features",
    proficiencies: "sheet-proficiencies",
    story: "sheet-story",
  };
  const sections: Section[] = [
    { id: ids.abilities, title: "Atributos" },
    { id: ids.combat, title: "Combate" },
    { id: ids.skills, title: "Habilidades" },
    ...(hasSpells ? [{ id: ids.spells, title: "Conjuros" }] : []),
    { id: ids.features, title: "Rasgos" },
    { id: ids.proficiencies, title: "Competencias" },
    ...(story.trim() ? [{ id: ids.story, title: "Historia" }] : []),
  ];

  // What the DM uses wins: the player's corrected numbers over the built ones.
  const combat = stats ?? {
    maxHp: s.hitPoints, armorClass: s.armorClass, initiative: s.initiative, speed: s.speed, attacks: s.attacks,
  };
  const masteries = new Map(s.attacks.map((a) => [a.name, a.mastery]));

  const copy = async (what: string, text: string) => {
    const result = await copyText(text, navigator.clipboard);
    setCopied(result === "copied" ? `${what} copiada.` : "No pude copiar.");
  };

  const featureGroups: { source: string; items: CharacterSheet["features"] }[] = [];
  for (const f of s.features) {
    const last = featureGroups.at(-1);
    if (last && last.source === f.source) last.items.push(f);
    else featureGroups.push({ source: f.source, items: [f] });
  }

  const proficiencies: [string, string[]][] = [
    ["Armaduras", s.proficiencies.armor],
    ["Armas", s.proficiencies.weapons],
    ["Maestrías", s.masteries.map((m) => `${m.weapon} · ${m.mastery}`)],
    ["Herramientas", s.proficiencies.tools],
    ["Idiomas", s.languages],
  ];

  return (
    <div ref={rootRef} className="sheet-page" aria-label={`Ficha de ${name}`} role="region">
      <header className="sheet-page__top">
        <button type="button" className="info-round" aria-label="Volver" onClick={onBack}>
          <Icon name="back" size={20} />
        </button>
        <div className="sheet-page__title">
          <p className="info-eyebrow">Ficha completa</p>
          <h2>{name}</h2>
        </div>
      </header>

      <div className="sheet-page__body">
        <p className="info-pills">
          <span className="info-pill info-pill--sun">Nivel {s.level}</span>
          <span className="info-pill">{s.species}</span>
          <span className="info-pill">{klass}</span>
          <span className="info-pill">Trasfondo: {s.background}</span>
          <span className="info-pill">Competencia {signed(s.proficiencyBonus)}</span>
        </p>

        <p className="sheet-note">
          Calculada con tus elecciones y las reglas. Si tu hoja dice otra cosa, vale tu hoja: corregí atributos y
          habilidades acá (lo que depende de ellos se recalcula), y lo que las reglas no saben, como un objeto mágico,
          desde Héroe › Corregir con tu hoja.
          {(corrected || abilitiesCorrected) && " Lo que ya corregiste se marca «Según tu hoja»."}
        </p>

        <section aria-labelledby={ids.abilities}>
          <div className="sheet-h__row">
            <h3 id={ids.abilities} className="sheet-h">Atributos</h3>
            {abilitiesCorrected && <span className="info-pill info-pill--calm">Según tu hoja</span>}
            {editButton("Corregir atributos y salvaciones")}
          </div>
          <ul className="sheet-abilities">
            {ABILITIES.map((a) => {
              const x = s.abilities[a];
              return (
                <li key={a} className="sheet-ability">
                  <span className="sheet-ability__name">{ABILITY_NAMES[a]}</span>
                  <span className="sheet-ability__mod">{signed(x.modifier)}</span>
                  <span className="sheet-ability__score">{x.score}</span>
                  <span className="sheet-ability__save">
                    <span className="sheet-dot" data-kind={x.proficientSave ? "proficient" : undefined} />
                    Salv. {signed(x.save)}
                    {x.proficientSave && <span className="sr-only"> (competente)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="sheet-legend">
            <span><span className="sheet-dot" data-kind="proficient" />Competente</span>
            <span><span className="sheet-dot" data-kind="expertise" />Pericia</span>
          </p>
        </section>

        <section aria-labelledby={ids.combat}>
          <div className="sheet-h__row">
            <h3 id={ids.combat} className="sheet-h">Combate</h3>
            {corrected && <span className="info-pill info-pill--calm">Según tu hoja</span>}
          </div>
          <dl className="info-card sheet-combat">
            <div><dd>{combat.maxHp}</dd><dt>PG máx.</dt></div>
            <div><dd>{combat.armorClass}</dd><dt>CA</dt></div>
            <div><dd>{s.hitDice}</dd><dt>Dados de golpe</dt></div>
            <div><dd>{signed(combat.initiative)}</dd><dt>Iniciativa</dt></div>
            <div><dd>{speedInFeet(combat.speed)}</dd><dt>Velocidad</dt></div>
            <div><dd>{s.passivePerception}</dd><dt>Perc. pasiva</dt></div>
          </dl>
          {combat.attacks.length > 0 && (
            <ul className="sheet-attacks">
              {combat.attacks.map((a) => (
                <li key={a.name}>
                  <strong>{a.name}</strong>
                  <span>
                    {signed(a.attackBonus)} · {a.damage}
                    {masteries.get(a.name) ? ` · ${masteries.get(a.name)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby={ids.skills}>
          <div className="sheet-h__row">
            <h3 id={ids.skills} className="sheet-h">Habilidades</h3>
            {editButton("Corregir habilidades")}
          </div>
          <ul className="info-card sheet-skills">
            {s.skills.map((k) => {
              const ability = SKILL_ABILITY.get(k.id);
              const kind = k.expertise ? "expertise" : k.proficient ? "proficient" : undefined;
              return (
                <li key={k.id} data-proficient={kind ? "" : undefined}>
                  <span className="sheet-dot" data-kind={kind} />
                  <span className="sheet-skill__name">
                    {k.name}
                    {ability && <small>{ABILITY_SHORT[ability]}</small>}
                    {kind && <span className="sr-only">{kind === "expertise" ? " (pericia)" : " (competente)"}</span>}
                  </span>
                  <b>{signed(k.bonus)}</b>
                </li>
              );
            })}
          </ul>
        </section>

        {hasSpells && (
          <section aria-labelledby={ids.spells}>
            <h3 id={ids.spells} className="sheet-h">Conjuros</h3>
            <div className="info-card info-stack">
              {sc && (
                <>
                  <p className="info-pills">
                    <span className="info-pill info-pill--calm">{ABILITY_NAMES[sc.ability]}</span>
                    <span className="info-pill">CD {sc.saveDc}</span>
                    <span className="info-pill">Ataque {signed(sc.attackBonus)}</span>
                    {sc.slots.map((n, i) =>
                      n > 0 ? (
                        <span key={i} className="info-pill">
                          Nivel {i + 1}: {n} {n === 1 ? "espacio" : "espacios"}
                        </span>
                      ) : null,
                    )}
                    {sc.pactSlots && (
                      <span className="info-pill">
                        Pacto: {sc.pactSlots.count} de nivel {sc.pactSlots.slotLevel}
                      </span>
                    )}
                  </p>
                  {sc.cantrips.length > 0 && <SpellList title="Trucos" spells={sc.cantrips} />}
                  <SpellList title="Preparados" spells={sc.prepared} />
                  {sc.spellbook && <SpellList title="Libro de conjuros" spells={sc.spellbook} />}
                </>
              )}
              {s.otherSpells.map((g) => (
                <SpellList
                  key={g.source}
                  title={`${g.source} · ${ABILITY_NAMES[g.ability]}, CD ${g.saveDc}, ataque ${signed(g.attackBonus)}`}
                  spells={g.spells}
                />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby={ids.features}>
          <h3 id={ids.features} className="sheet-h">Rasgos</h3>
          <div className="info-card info-card--rows">
            {featureGroups.length === 0 && <p className="drawer__empty">—</p>}
            {featureGroups.map((g) => (
              <div key={g.source}>
                <p className="info-eyebrow sheet-group">{g.source}</p>
                {g.items.map((f) => (
                  <details key={f.name} className="info-disclosure sheet-feature">
                    <summary>
                      {f.name}
                      <Icon name="next" size={16} />
                    </summary>
                    <p>{f.summary}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby={ids.proficiencies}>
          <h3 id={ids.proficiencies} className="sheet-h">Competencias</h3>
          <dl className="info-card sheet-profs">
            {proficiencies.map(([label, values]) =>
              values.length === 0 && label === "Maestrías" ? null : (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {values.length === 0 ? "—" : values.map((v) => <span key={v} className="info-chip">{v}</span>)}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>

        {story.trim() && (
          <section aria-labelledby={ids.story}>
            <h3 id={ids.story} className="sheet-h">Historia</h3>
            <p className="sheet-story">{story.trim()}</p>
          </section>
        )}

        <div className="sheet-page__actions">
          <button type="button" className="button" onClick={() => void copy("Ficha", formatSheetText(s, name, story))}>
            Copiar ficha
          </button>
          <button type="button" className="button" onClick={() => void copy("Markdown", formatSheetMarkdown(s, name, story))}>
            Copiar en Markdown
          </button>
        </div>
        <p className="info-hint" role="status" aria-live="polite">
          {copied ?? ""}
        </p>
        <p className="info-hint">Reglas: SRD 5.2 (CC-BY-4.0)</p>

        <SheetIndex sections={sections} rootRef={rootRef} />
        {onCorrectAbilities && (
          <AbilitiesDialog
            open={editing}
            values={abilityValuesOf(s)}
            corrected={abilitiesCorrected}
            originRef={editRef}
            onClose={() => setEditing(false)}
            onSave={onCorrectAbilities}
            onReset={onResetAbilities ?? (async () => null)}
            disabled={turnRunning}
          />
        )}
      </div>
    </div>
  );
}

function SpellList({ title, spells }: { title: string; spells: string[] }) {
  return (
    <div>
      <p className="info-eyebrow">{title}</p>
      <p className="info-pills">
        {spells.length === 0 ? "—" : spells.map((sp) => <span key={sp} className="info-chip">{sp}</span>)}
      </p>
    </div>
  );
}

/** The floating index: shows while the sheet scrolls, hides a while after
    it stops; open, it lists the sections and jumps to one. */
function SheetIndex({ sections, rootRef }: { sections: Section[]; rootRef: React.RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(true);
  // Bumped on every scroll (or touch of the button): restarts the hide timer.
  const [activity, setActivity] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuShown, setMenuShown] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wake = () => {
    setVisible(true);
    setActivity((n) => n + 1);
  };

  useEffect(() => {
    const scroller = rootRef.current?.closest(".drawer__panel");
    if (!scroller) return;
    scroller.addEventListener("scroll", wake, { passive: true });
    return () => scroller.removeEventListener("scroll", wake);
  }, [rootRef]);

  // Hide once the sheet has been still a while (never while the menu is open).
  useEffect(() => {
    if (open || !visible) return;
    const timer = setTimeout(() => setVisible(false), INDEX_HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [activity, open, visible]);

  // The menu stays mounted until its closing animation ends.
  useLayoutEffect(() => {
    if (open) {
      setMenuShown(true);
      return;
    }
    if (!menuShown || !menuRef.current) return;
    return leaveMenu(menuRef.current, () => setMenuShown(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (open && menuShown && menuRef.current) {
      enterMenu(menuRef.current);
      menuRef.current.querySelector("button")?.focus();
    }
  }, [open, menuShown]);

  // Escape closes the menu (and not the drawer); a click elsewhere too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  const jump = (id: string) => {
    setOpen(false);
    wake();
    document.getElementById(id)?.scrollIntoView({ behavior: motionAllowed() ? "smooth" : "auto", block: "start" });
  };

  return (
    <div className="sheet-index" data-visible={visible || open || menuShown}>
      {menuShown && (
        <nav ref={menuRef} className="sheet-index__menu" aria-label="Índice de la ficha">
          {sections.map((s) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)}>
              <i className="sheet-index__dot" aria-hidden="true" />
              {s.title}
            </button>
          ))}
        </nav>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="sheet-index__button"
        aria-label="Índice de la ficha"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          wake();
        }}
        onFocus={wake}
      >
        <Icon name={open ? "close" : "list"} size={22} />
      </button>
    </div>
  );
}
