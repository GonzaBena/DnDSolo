import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { enterPage, enterSubpage, leaveSubpage } from "../animations/motion";
import { findCampaign } from "../campaigns";
import type { InventoryEdit } from "../domain/manualEdits";
import {
  hasCombatAdjustments,
  hasSheetAdjustments,
  sheetOverridesOf,
  type AbilityValues,
  type StatValues,
} from "../domain/statCorrections";
import type { GameState } from "../domain/types";
import { buildSheet } from "../rules/buildSheet";
import type { CharacterSheet } from "../rules/types";
import { HeroTab } from "./info/HeroTab";
import { Icon, type IconName } from "./info/icons";
import { SheetPage } from "./info/SheetPage";
import { StoryTab } from "./info/StoryTab";
import { WorldTab } from "./info/WorldTab";
import type { OutsideSrdEdit } from "./OutsideSrdSection";
import { useDrawer } from "./useDrawer";

type Tab = "hero" | "story" | "world";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "hero", label: "Héroe", icon: "shield" },
  { id: "story", label: "Historia", icon: "book" },
  { id: "world", label: "Mundo", icon: "map" },
];

interface Props {
  state: GameState;
  open: boolean;
  onClose: () => void;
  /** Opens "Anteriormente en…" over the game. */
  onOpenRecap: () => void;
  /** A turn is being played: leaving the page now would lose it. */
  turnRunning?: boolean;
  /** Saves the first player's "Fuera del SRD" note and subclass; without it the section is not shown. */
  onSaveOutsideSrd?: (edit: OutsideSrdEdit) => Promise<void>;
  /** Saves the first player's portrait (null: their initials); without it the portrait can't be changed. */
  onSavePortrait?: (portrait: string | null) => Promise<void>;
  /** Opens the screen that completes the first player's rules choices (shown only when they can be completed). */
  onUpgradeSheet?: () => void;
  /** Opens the rename dialog for an NPC; without it they can't be renamed. */
  onEditNpc?: (name: string) => void;
  /** Adjusts the first player's spent hit dice (+1 recovers, -1 spends). */
  onAdjustHitDice?: (delta: number) => Promise<void>;
  /** Edits the first player's carried inventory manually. */
  onEditInventory?: (edit: InventoryEdit) => Promise<void>;
  /** Replaces the first player's DM-facing numbers with their own sheet's; resolves to an error or null. */
  onCorrectStats?: (values: StatValues) => Promise<string | null>;
  /** Drops the first player's corrections; resolves to an error or null. */
  onResetStats?: () => Promise<string | null>;
  /** Replaces the first player's ability scores, saves and skill training with their own sheet's. */
  onCorrectAbilities?: (values: AbilityValues) => Promise<string | null>;
  /** Drops the first player's ability, save and skill corrections. */
  onResetAbilities?: () => Promise<string | null>;
}

/** Everything the campaign knows, in three tabs: the characters (Héroe),
    what has happened (Historia) and where they are and whom they met
    (Mundo). A character's full sheet opens as a page over the tabs. */
export function InfoDrawer({
  state,
  open,
  onClose,
  onOpenRecap,
  turnRunning = false,
  onSaveOutsideSrd,
  onSavePortrait,
  onUpgradeSheet,
  onEditNpc,
  onAdjustHitDice,
  onEditInventory,
  onCorrectStats,
  onResetStats,
  onCorrectAbilities,
  onResetAbilities,
}: Props) {
  const { dialogProps, panelRef } = useDrawer(open, onClose);
  const uid = useId();
  const [tab, setTab] = useState<Tab>("hero");
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ hero: null, story: null, world: null });
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({ hero: null, story: null, world: null });
  const sheetRef = useRef<HTMLDivElement>(null);
  const mainScroll = useRef(0);
  const animateTab = useRef(false);
  const campaign = findCampaign(state.campaignId);
  const players = state.players ?? [];

  // Sheets are built only while the drawer is open.
  const sheets = useMemo(() => {
    const map = new Map<string, CharacterSheet>();
    if (!open) return map;
    for (const p of players) {
      if (!p.choices) continue;
      // With the player's own scores and training, computed by the rules.
      const built = buildSheet(p.choices, sheetOverridesOf(p.statAdjustments));
      if (built.ok) map.set(p.id, built.sheet);
    }
    return map;
  }, [open, players]);

  // Every opening starts on the tabs, not on a sheet left open last time.
  useLayoutEffect(() => {
    if (open) setSheetFor(null);
  }, [open]);

  // A new tab's blocks rise in, like any other screen.
  useEffect(() => {
    if (!animateTab.current) return;
    animateTab.current = false;
    const panel = panelRefs.current[tab];
    if (panel) enterPage([...panel.children]);
  }, [tab]);

  const scroller = () => panelRef.current;

  const selectTab = (next: Tab, focus = false) => {
    if (next !== tab) {
      animateTab.current = true;
      setTab(next);
      scroller()?.scrollTo({ top: 0 });
    }
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const to =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : -1;
    if (to < 0) return;
    event.preventDefault();
    selectTab(TABS[to]!.id, true);
  };

  const openSheet = (playerId: string) => {
    mainScroll.current = scroller()?.scrollTop ?? 0;
    setSheetFor(playerId);
  };

  // The sheet slides in once it is mounted, from the top of the drawer.
  useLayoutEffect(() => {
    if (!sheetFor || !sheetRef.current) return;
    scroller()?.scrollTo({ top: 0 });
    enterSubpage(sheetRef.current);
    sheetRef.current.querySelector("button")?.focus();
  }, [sheetFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSheet = () => {
    const element = sheetRef.current;
    const back = () => {
      const from = sheetFor;
      setSheetFor(null);
      requestAnimationFrame(() => {
        scroller()?.scrollTo({ top: mainScroll.current });
        const panel = panelRefs.current[tab];
        if (panel) enterPage([...panel.children]);
        panel?.querySelector<HTMLButtonElement>(`[data-sheet-for="${from}"]`)?.focus();
      });
    };
    if (element) leaveSubpage(element, back);
    else back();
  };

  const sheetPlayer = sheetFor ? players.find((p) => p.id === sheetFor) : undefined;
  const sheet = sheetFor ? sheets.get(sheetFor) : undefined;

  return (
    <dialog {...dialogProps} aria-labelledby={`${uid}-title`}>
      <div ref={panelRef} className="drawer__panel drawer__panel-info" data-mode="calm">
        {sheetPlayer && sheet ? (
          <div ref={sheetRef} className="info-subpage">
            <h2 id={`${uid}-title`} className="sr-only">
              Información
            </h2>
            <SheetPage
              sheet={sheet}
              stats={sheetPlayer.stats}
              corrected={hasCombatAdjustments(sheetPlayer.statAdjustments)}
              abilitiesCorrected={hasSheetAdjustments(sheetPlayer.statAdjustments)}
              onCorrectAbilities={sheetPlayer === players[0] ? onCorrectAbilities : undefined}
              onResetAbilities={sheetPlayer === players[0] ? onResetAbilities : undefined}
              turnRunning={turnRunning}
              name={sheetPlayer.name} story={sheetPlayer.background ?? ""} onBack={closeSheet} />
          </div>
        ) : null}
        <div className="info-main" hidden={sheetPlayer !== undefined && sheet !== undefined}>
          <header className="info-top">
            <div className="info-top__row">
              <div>
                <p className="info-eyebrow">Estás en</p>
                <h2 id={sheetPlayer && sheet ? undefined : `${uid}-title`} className="info-top__place">
                  {state.location?.name || "Lugar desconocido"}
                </h2>
              </div>
              <button type="button" className="info-round" onClick={onClose} aria-label="Cerrar">
                <Icon name="close" />
              </button>
            </div>
            <div className="info-tabs" role="tablist" aria-label="Secciones de información">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${t.id}`}
                  className="info-tab"
                  aria-selected={tab === t.id}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => selectTab(t.id)}
                  onKeyDown={onTabKey}
                >
                  <Icon name={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>
          </header>

          {TABS.map((t) => (
            <div
              key={t.id}
              ref={(el) => {
                panelRefs.current[t.id] = el;
              }}
              role="tabpanel"
              id={`${uid}-panel-${t.id}`}
              aria-labelledby={`${uid}-tab-${t.id}`}
              className="info-panel"
              hidden={tab !== t.id}
              tabIndex={0}
            >
              {t.id === "hero" && (
                <HeroTab
                  players={players}
                  storyItems={state.storyItems ?? []}
                  sheets={sheets}
                  onOpenSheet={openSheet}
                  turnRunning={turnRunning}
                  onSaveOutsideSrd={onSaveOutsideSrd}
                  onSavePortrait={onSavePortrait}
                  onUpgradeSheet={onUpgradeSheet}
                  onAdjustHitDice={onAdjustHitDice}
                  onEditInventory={onEditInventory}
                  onCorrectStats={onCorrectStats}
                  onResetStats={onResetStats}
                />
              )}
              {t.id === "story" && (
                <StoryTab state={state} campaign={campaign} onOpenRecap={onOpenRecap} turnRunning={turnRunning} />
              )}
              {t.id === "world" && <WorldTab state={state} onEditNpc={onEditNpc} />}
            </div>
          ))}
        </div>
      </div>
    </dialog>
  );
}
