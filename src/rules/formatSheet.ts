import { ABILITIES, ABILITY_NAMES } from "./types";
import type { CharacterSheet } from "./types";

const FOOTER = "Reglas: SRD 5.2 (CC-BY-4.0)";

const sign = (n: number): string => (n >= 0 ? `+${n}` : `-${Math.abs(n)}`);

/** Feet to metres, rounded to the nearest 0.5 like the Spanish SRD (30 ft -> 9 m, 25 ft -> 7,5 m). */
export function speedInMetres(feet: number): string {
  const m = Math.round(feet * 0.3 * 2) / 2;
  return `${String(m).replace(".", ",")} m`;
}

const list = (items: string[]): string => (items.length > 0 ? items.join(", ") : "—");

interface Line { text: string; group?: boolean }
interface Section { title: string; lines: Line[] }

const plain = (texts: string[]): Line[] => texts.map((text) => ({ text }));

function build(s: CharacterSheet, story: string): { header: string; sections: Section[] } {
  const klass = s.subclass ? `${s.className} (${s.subclass})` : s.className;
  const header = `${s.species} · ${klass} · Nivel ${s.level} · ${s.background}`;

  const out: Section[] = [];
  out.push({
    title: "Atributos",
    lines: plain(ABILITIES.map((a) => {
      const x = s.abilities[a];
      return `${ABILITY_NAMES[a]} ${x.score} (${sign(x.modifier)}) · Salvación ${sign(x.save)}${x.proficientSave ? " (competente)" : ""}`;
    })),
  });
  out.push({
    title: "Combate",
    lines: plain([
      `Bonificador de competencia ${sign(s.proficiencyBonus)}`,
      `PG ${s.hitPoints} · Dados de golpe ${s.hitDice}`,
      `CA ${s.armorClass} · Iniciativa ${sign(s.initiative)}`,
      `Velocidad ${speedInMetres(s.speed)} · Percepción pasiva ${s.passivePerception}`,
    ]),
  });
  out.push({
    title: "Habilidades",
    lines: plain(s.skills.map((k) => `${k.name} ${sign(k.bonus)}${k.expertise ? " (pericia)" : k.proficient ? " (competente)" : ""}`)),
  });
  out.push({
    title: "Competencias",
    lines: plain([
      `Armaduras: ${list(s.proficiencies.armor)}`,
      `Armas: ${list(s.proficiencies.weapons)}`,
      `Herramientas: ${list(s.proficiencies.tools)}`,
      `Idiomas: ${list(s.languages)}`,
      ...(s.masteries.length > 0 ? [`Maestrías: ${s.masteries.map((m) => `${m.weapon} (${m.mastery})`).join(", ")}`] : []),
    ]),
  });
  out.push({
    title: "Ataques",
    lines: plain(s.attacks.length === 0
      ? ["—"]
      : s.attacks.map((a) => `${a.name} ${sign(a.attackBonus)} · ${a.damage}${a.mastery ? ` · Maestría: ${a.mastery}` : ""}`)),
  });

  const features: Line[] = [];
  let source: string | null = null;
  for (const f of s.features) {
    if (f.source !== source) {
      source = f.source;
      features.push({ text: source, group: true });
    }
    features.push({ text: `${f.name}: ${f.summary}` });
  }
  out.push({ title: "Rasgos", lines: features.length > 0 ? features : plain(["—"]) });

  const sc = s.spellcasting;
  if (sc) {
    const lines = [`Característica: ${ABILITY_NAMES[sc.ability]} · CD ${sc.saveDc} · Ataque ${sign(sc.attackBonus)}`];
    const slots = sc.slots.flatMap((n, i) => (n > 0 ? [`nivel ${i + 1}: ${n}`] : []));
    if (slots.length > 0) lines.push(`Espacios: ${slots.join(", ")}`);
    if (sc.pactSlots) lines.push(`Espacios de pacto: ${sc.pactSlots.count} de nivel ${sc.pactSlots.slotLevel}`);
    lines.push(`Trucos: ${list(sc.cantrips)}`, `Preparados: ${list(sc.prepared)}`);
    if (sc.spellbook) lines.push(`Libro de conjuros: ${list(sc.spellbook)}`);
    if (sc.other.length > 0) lines.push(`Otros: ${list(sc.other)}`);
    out.push({ title: "Conjuros", lines: plain(lines) });
  }

  out.push({ title: "Equipo", lines: plain([...s.equipment, `Oro: ${s.gold} po`]) });
  if (story.trim() !== "") out.push({ title: "Historia", lines: plain([story.trim()]) });
  return { header, sections: out };
}

export function formatSheetText(sheet: CharacterSheet, name: string, story: string): string {
  const { header, sections } = build(sheet, story);
  const parts = [name, header];
  for (const sec of sections) {
    parts.push("", sec.title.toUpperCase());
    for (const l of sec.lines) {
      parts.push(sec.title === "Historia" ? l.text : l.group ? ` ${l.text}:` : `  ${l.text}`);
    }
  }
  parts.push("", FOOTER);
  return `${parts.join("\n")}\n`;
}

export function formatSheetMarkdown(sheet: CharacterSheet, name: string, story: string): string {
  const { header, sections } = build(sheet, story);
  const parts = [`# ${name}`, "", `*${header}*`];
  for (const sec of sections) {
    parts.push("", `## ${sec.title}`, "");
    for (const l of sec.lines) {
      if (sec.title === "Historia") parts.push(l.text);
      else if (l.group) parts.push(...(parts.at(-1) === "" ? [] : [""]), `**${l.text}**`, "");
      else parts.push(`- ${l.text}`);
    }
  }
  parts.push("", "---", "", FOOTER);
  return `${parts.join("\n")}\n`;
}
