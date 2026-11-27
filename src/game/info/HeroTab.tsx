import { useRef, useState } from "react";
import { PortraitChooser, PortraitFace } from "../../character/PortraitPicker";
import { MAX_LEVEL } from "../../domain/character";
import type { InventoryEdit } from "../../domain/manualEdits";
import { featureRecovery, resourceStatusFor } from "../../domain/resources";
import { canUpgradeSheet } from "../../domain/sheetProgress";
import { hasCombatAdjustments, statValuesOf, type StatValues } from "../../domain/statCorrections";
import { MILESTONES_PER_LEVEL, type Character, type StoryItem } from "../../domain/types";
import type { CharacterSheet } from "../../rules/types";
import { OutsideSrdSection, type OutsideSrdEdit } from "../OutsideSrdSection";
import { Icon, StoryStar } from "./icons";
import { sameName, signed, speedInFeet } from "./format";
import { StatsDialog } from "./StatsDialog";

/** Up to this many uses are drawn as dots; more are written as numbers. */
const MAX_PIPS = 8;

function Pips({ available, max }: { available: number; max: number }) {
  const label = `${available} de ${max} disponibles`;
  if (max > MAX_PIPS) {
    return (
      <span className="info-pips info-pips--count" aria-label={label}>
        {available}/{max}
      </span>
    );
  }
  return (
    <span className="info-pips" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="info-pip" data-on={i < available} />
      ))}
    </span>
  );
}

const CONDITION_LABEL = { dying: "Agonizando", stable: "Estable", dead: "Muerto" } as const;

/** The HP bar's colour: comfortable, hurt, in danger. */
function hpTone(current: number, max: number): "ok" | "hurt" | "bad" {
  const ratio = max > 0 ? current / max : 0;
  return ratio > 0.5 ? "ok" : ratio > 0.25 ? "hurt" : "bad";
}

interface HeroCardProps {
  player: Character;
  sheet: CharacterSheet | null;
  onOpenSheet?: () => void;
  onSavePortrait?: (portrait: string | null) => Promise<void>;
  onCorrectStats?: (values: StatValues) => Promise<string | null>;
  onResetStats?: () => Promise<string | null>;
  turnRunning: boolean;
}

function HeroCard({ player: p, sheet, onOpenSheet, onSavePortrait, onCorrectStats, onResetStats, turnRunning }: HeroCardProps) {
  const [correcting, setCorrecting] = useState(false);
  const correctRef = useRef<HTMLButtonElement>(null);
  const corrected = hasCombatAdjustments(p.statAdjustments);
  const conditions = p.activeConditions ?? [];
  const toNext = MILESTONES_PER_LEVEL - Math.min(p.milestonesSinceLevel, MILESTONES_PER_LEVEL);
  const stats = p.stats;
  const tiles: { value: string; label: string }[] = stats
    ? [
        { value: String(stats.armorClass), label: "CA" },
        { value: signed(stats.initiative), label: "Iniciativa" },
        { value: speedInFeet(stats.speed), label: "Velocidad" },
        ...(sheet ? [{ value: String(sheet.passivePerception), label: "Perc. pasiva" }] : []),
      ]
    : [];

  return (
    <section className="info-card hero-card" aria-label={p.name}>
      <div className="hero-card__head">
        {onSavePortrait ? (
          <PortraitChooser
            classId={p.classId}
            name={p.name}
            value={p.portrait}
            variant="badge"
            disabled={turnRunning}
            onPick={(portrait) => void onSavePortrait(portrait)}
          />
        ) : (
          <span className="portrait-chooser--badge">
            <PortraitFace portrait={p.portrait} name={p.name} size="lg" />
          </span>
        )}
        <div className="hero-card__who">
          <h3>{p.name}</h3>
          <p className="hero-card__line">
            {p.race} · {p.characterClass}
          </p>
          <p className="info-pills">
            <span className="info-pill info-pill--sun">Nivel {p.level}</span>
            {p.level < MAX_LEVEL && (
              <span className="info-pill">
                {toNext} {toNext === 1 ? "hito" : "hitos"} para nivel {p.level + 1}
              </span>
            )}
          </p>
        </div>
      </div>

      {stats && p.currentHp !== null && (
        <div>
          <div className="hero-hp__row">
            <span className="info-eyebrow">Puntos de golpe</span>
            <span className="hero-hp__value">
              {p.currentHp} <span>/ {stats.maxHp}</span>
            </span>
          </div>
          <div
            className="hero-hp__bar"
            role="img"
            aria-label={`${p.currentHp} de ${stats.maxHp} puntos de golpe`}
            data-tone={hpTone(p.currentHp, stats.maxHp)}
          >
            <span style={{ width: `${Math.max(0, Math.min(100, (p.currentHp / Math.max(1, stats.maxHp)) * 100))}%` }} />
          </div>
        </div>
      )}

      {(conditions.length > 0 || p.condition !== "ok") && (
        <p className="info-pills">
          {p.condition !== "ok" && <span className="info-pill info-pill--bad">{CONDITION_LABEL[p.condition]}</span>}
          {conditions.map((c) => (
            <span key={c} className={`info-pill ${c.toLowerCase().startsWith("concentración") ? "info-pill--calm" : "info-pill--bad"}`}>
              {c}
            </span>
          ))}
        </p>
      )}

      {tiles.length > 0 && (
        <dl className="hero-stats">
          {tiles.map((t) => (
            <div key={t.label}>
              <dd>{t.value}</dd>
              <dt>{t.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {onCorrectStats && (
        <div className="hero-card__correct">
          {corrected && <span className="info-pill info-pill--calm">Según tu hoja</span>}
          <button ref={correctRef} type="button" className="info-link" onClick={() => setCorrecting(true)}>
            <Icon name="pencil" size={15} />
            {stats ? "Corregir con tu hoja" : "Cargar los números de tu hoja"}
          </button>
          <StatsDialog
            open={correcting}
            values={stats ? statValuesOf(stats) : null}
            canReset={p.choices !== null && onResetStats !== undefined}
            corrected={corrected}
            originRef={correctRef}
            onClose={() => setCorrecting(false)}
            onSave={onCorrectStats}
            onReset={onResetStats ?? (async () => null)}
            disabled={turnRunning}
          />
        </div>
      )}

      {onOpenSheet && (
        <button type="button" className="info-cta" data-sheet-for={p.id} onClick={onOpenSheet}>
          Ver ficha completa
          <Icon name="next" size={16} />
        </button>
      )}
    </section>
  );
}

interface ResourcesProps {
  player: Character;
  onAdjustHitDice?: (delta: number) => Promise<void>;
  disabled: boolean;
  run: (task: () => Promise<void>) => void;
}

function Resources({ player, onAdjustHitDice, disabled, run }: ResourcesProps) {
  const res = resourceStatusFor(player);
  return (
    <section aria-label="Recursos">
      <div className="info-sec-head">
        <h3>Recursos</h3>
        <span className="info-hint">Vuelven al descansar</span>
      </div>
      <div className="info-card info-card--rows">
        <div className="info-res">
          <div className="info-res__name">
            Dados de golpe<small>{res.hitDice.die} · se gastan en descanso corto</small>
          </div>
          <Pips available={res.hitDice.available} max={res.hitDice.max} />
          {onAdjustHitDice && (
            <span className="info-steps">
              <button
                type="button"
                className="info-step"
                aria-label="Gastar dado de golpe"
                disabled={disabled || res.hitDice.available <= 0}
                onClick={() => run(() => onAdjustHitDice(-1))}
              >
                −
              </button>
              <button
                type="button"
                className="info-step"
                aria-label="Recuperar dado de golpe"
                disabled={disabled || res.hitDice.available >= res.hitDice.max}
                onClick={() => run(() => onAdjustHitDice(1))}
              >
                +
              </button>
            </span>
          )}
        </div>
        {res.slots.map((s) => (
          <div key={s.key} className="info-res">
            <div className="info-res__name">
              {s.key === "pact" ? "Espacios de pacto" : `Espacios de nivel ${s.key}`}
              <small>{s.key === "pact" ? "descanso corto" : "descanso largo"}</small>
            </div>
            <Pips available={s.available} max={s.max} />
          </div>
        ))}
        {res.features.map((f) => (
          <div key={f.name} className="info-res">
            <div className="info-res__name">
              {f.name}
              <small>{featureRecovery(f.name, player.level) === "short" ? "descanso corto" : "descanso largo"}</small>
            </div>
            <Pips available={f.available} max={f.max} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Attacks({ player }: { player: Character }) {
  const stats = player.stats;
  if (!stats || (stats.attacks.length === 0 && stats.spellSaveDc === null)) return null;
  return (
    <section aria-label="Ataques y magia">
      <div className="info-sec-head">
        <h3>Ataques y magia</h3>
      </div>
      <div className="info-stack">
        {stats.attacks.map((a) => (
          <div key={a.name} className="info-card info-attack">
            <div>
              <strong>{a.name}</strong>
              <span>{a.damage}</span>
            </div>
            <span className="info-attack__bonus" aria-label={`Bonificador de ataque ${signed(a.attackBonus)}`}>
              {signed(a.attackBonus)}
            </span>
          </div>
        ))}
        {stats.spellSaveDc !== null && (
          <div className="info-magic">
            <div>
              <span>CD de conjuros</span>
              <strong>{stats.spellSaveDc}</strong>
            </div>
            {stats.spellAttackBonus !== null && (
              <div>
                <span>Ataque mágico</span>
                <strong>{signed(stats.spellAttackBonus)}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

interface InventoryProps {
  player: Character;
  storyItems: StoryItem[];
  onEditInventory?: (edit: InventoryEdit) => Promise<void>;
  disabled: boolean;
  run: (task: () => Promise<void>) => void;
}

function Inventory({ player, storyItems, onEditInventory, disabled, run }: InventoryProps) {
  const [editing, setEditing] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const storyItem = (name: string) => storyItems.find((i) => i.status === "taken" && sameName(i.name, name));
  // Story items first: they are the ones the plot asks about.
  const items = [...player.inventory].sort((a, b) => Number(!!storyItem(b.name)) - Number(!!storyItem(a.name)));

  return (
    <section aria-label="Inventario">
      <div className="info-sec-head">
        <h3>
          Inventario <span className="info-pill">{player.inventory.length}</span>
        </h3>
        {onEditInventory && (
          <button type="button" className="info-link" aria-pressed={editing} onClick={() => setEditing(!editing)}>
            {editing ? (
              "Listo"
            ) : (
              <>
                <Icon name="pencil" size={15} />
                Editar
              </>
            )}
          </button>
        )}
      </div>
      <div className="info-card info-card--rows">
        {items.length === 0 ? (
          <p className="drawer__empty info-inv__empty">No llevás objetos encima.</p>
        ) : (
          <ul className="info-inv">
            {items.map((item) => {
              const story = storyItem(item.name);
              const head = (
                <>
                  <span className="info-inv__mark">{story && <StoryStar />}</span>
                  <span className="info-inv__name">
                    {item.name}
                    {story && <span className="sr-only"> (objeto de la historia)</span>}
                  </span>
                  {item.quantity > 1 && <span className="info-qty">×{item.quantity}</span>}
                </>
              );
              return (
                <li key={item.name} data-story={story ? "" : undefined}>
                  {editing && onEditInventory ? (
                    <div className="info-inv__row">
                      {head}
                      <span className="info-steps">
                        <button
                          type="button"
                          className="info-step"
                          aria-label={`Quitar uno de ${item.name}`}
                          disabled={disabled}
                          onClick={() => run(() => onEditInventory({ type: "delta", name: item.name, delta: -1 }))}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="info-step"
                          aria-label={`Sumar uno de ${item.name}`}
                          disabled={disabled}
                          onClick={() => run(() => onEditInventory({ type: "delta", name: item.name, delta: 1 }))}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="info-step"
                          aria-label={`Eliminar ${item.name}`}
                          disabled={disabled}
                          onClick={() => run(() => onEditInventory({ type: "remove", name: item.name }))}
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  ) : story?.description ? (
                    <details className="info-disclosure">
                      <summary className="info-inv__row">{head}</summary>
                      <p className="info-inv__desc">{story.description}</p>
                    </details>
                  ) : (
                    <div className="info-inv__row">{head}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {editing && onEditInventory && (
          <form
            className="inventory-editor__add"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = itemName.trim();
              if (!trimmed || disabled) return;
              const parsedQty = Number.parseInt(itemQty, 10);
              const quantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
              run(async () => {
                await onEditInventory({ type: "add", name: trimmed, quantity });
                setItemName("");
                setItemQty("1");
              });
            }}
          >
            <input
              type="text"
              aria-label="Objeto nuevo"
              placeholder="Agregar objeto…"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              disabled={disabled}
            />
            <input
              type="number"
              aria-label="Cantidad"
              min={1}
              max={999}
              value={itemQty}
              onChange={(e) => setItemQty(e.target.value)}
              disabled={disabled}
            />
            <button type="submit" className="button button--small" disabled={disabled || !itemName.trim()}>
              Agregar
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export interface HeroTabProps {
  players: Character[];
  storyItems: StoryItem[];
  /** Each player's built sheet, when their rules choices are stored. */
  sheets: Map<string, CharacterSheet>;
  onOpenSheet: (playerId: string) => void;
  turnRunning: boolean;
  onSaveOutsideSrd?: (edit: OutsideSrdEdit) => Promise<void>;
  onSavePortrait?: (portrait: string | null) => Promise<void>;
  onUpgradeSheet?: () => void;
  onAdjustHitDice?: (delta: number) => Promise<void>;
  onEditInventory?: (edit: InventoryEdit) => Promise<void>;
  /** Replaces the first player's DM-facing numbers with their own sheet's; resolves to an error or null. */
  onCorrectStats?: (values: StatValues) => Promise<string | null>;
  /** Drops the first player's corrections. */
  onResetStats?: () => Promise<string | null>;
}

/** The characters: who they are, what they have left, what they carry.
    Only the first player (the one at this screen) can be edited. */
export function HeroTab({
  players,
  storyItems,
  sheets,
  onOpenSheet,
  turnRunning,
  onSaveOutsideSrd,
  onSavePortrait,
  onUpgradeSheet,
  onAdjustHitDice,
  onEditInventory,
  onCorrectStats,
  onResetStats,
}: HeroTabProps) {
  const [busy, setBusy] = useState(false);
  const disabled = turnRunning || busy;
  const run = (task: () => Promise<void>) => {
    setBusy(true);
    void task().finally(() => setBusy(false));
  };

  return (
    <>
      {players.map((p, index) => {
        const own = index === 0;
        const sheet = sheets.get(p.id) ?? null;
        const upgrade = own && onUpgradeSheet && canUpgradeSheet(p) ? onUpgradeSheet : undefined;
        return (
          <div key={p.id} className="info-stack info-stack--loose">
            <HeroCard
              player={p}
              sheet={sheet}
              onOpenSheet={sheet ? () => onOpenSheet(p.id) : undefined}
              onSavePortrait={own ? onSavePortrait : undefined}
              onCorrectStats={own ? onCorrectStats : undefined}
              onResetStats={own ? onResetStats : undefined}
              turnRunning={turnRunning}
            />
            <Resources player={p} onAdjustHitDice={own ? onAdjustHitDice : undefined} disabled={disabled} run={run} />
            <Attacks player={p} />
            <Inventory
              player={p}
              storyItems={storyItems}
              onEditInventory={own ? onEditInventory : undefined}
              disabled={disabled}
              run={run}
            />
            {own && onSaveOutsideSrd && (
              <section aria-label="Ajustes del personaje">
                <div className="info-sec-head">
                  <h3>Ajustes del personaje</h3>
                </div>
                <details className="info-card info-card--rows info-disclosure info-more">
                  <summary>
                    Fuera del SRD y subclase
                    {upgrade ? <span className="info-pill info-pill--sun">Pendiente</span> : <Icon name="next" size={16} />}
                  </summary>
                  <OutsideSrdSection player={p} onSave={onSaveOutsideSrd} onUpgradeSheet={upgrade} />
                </details>
              </section>
            )}
          </div>
        );
      })}
    </>
  );
}
