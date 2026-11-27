// The home page: the first-visit landing or the returning player's campaigns,
// the full list ("Ver todas"), import and delete, and keeping it all in step
// with Drive when sync is on.
import type { GameSummary } from "../persistence/GameRepo";
import { downloadGame } from "../persistence/exportGame";
import { loadGis } from "../sync/gis";
import { SYNC_TAPPED_EVENT } from "../sync/indicator";
import { syncBeforeOpen } from "../sync/openGame";
import { createGameRepo, getSyncRuntime, withRenewal, type SyncRuntime } from "../sync/runtime";
import { syncStatus } from "../sync/status";
import { campaignRow, playHref, saveRow } from "./campaignRows";
import { summarizeCampaign } from "./campaignSummary";
import { CAMPAIGNS_HASH, setUpCampaignsView } from "./campaignsView";
import type { HomeContext } from "./context";
import { setUpDeleteDialog } from "./deleteDialog";
import { byId } from "./dom";
import { setUpImportDialog } from "./importDialog";

/** The pre-paint script in index.astro reads this hint; the saved list is the truth. */
function setHome(state: "first" | "returning") {
  document.documentElement.dataset.home = state;
  try {
    localStorage.setItem("dnsolo.home", state);
  } catch {
    // Blocked storage: only the pre-paint guess is lost.
  }
}

function renderContinue(game: GameSummary) {
  const summary = summarizeCampaign(game);
  byId("continue-initials").textContent = summary.initials;
  byId("continue-name").textContent = summary.name;
  byId("continue-subtitle").textContent = summary.subtitle;
  const excerpt = byId("continue-excerpt");
  excerpt.textContent = summary.excerpt ? `“${summary.excerpt}”` : "";
  excerpt.hidden = !summary.excerpt;
  byId("continue-detail").textContent = summary.detail;
  byId<HTMLAnchorElement>("continue-play").href = playHref(game.id);
  byId("home-returning").dataset.ready = ""; // filled: CSS stops hiding it
}

function renderOthers(games: GameSummary[], total: number) {
  // "Ver todas" stays even without others: it is the way to export or delete.
  const others = byId("others");
  byId("others-title").hidden = games.length === 0;
  // The hidden title can't name the section; a label does instead.
  if (games.length) {
    others.setAttribute("aria-labelledby", "others-title");
    others.removeAttribute("aria-label");
  } else {
    others.removeAttribute("aria-labelledby");
    others.setAttribute("aria-label", "Tus campañas");
  }
  byId("others-count").textContent = String(total);
  byId("others-list").replaceChildren(...games.map(campaignRow));
}

export function initHome(): void {
  const sync = getSyncRuntime();
  const info = byId<HTMLParagraphElement>("save-info");
  const savesList = byId<HTMLUListElement>("saves");

  const report = (message: string, tone: "ok" | "error") => {
    info.dataset.tone = tone;
    info.textContent = message;
  };
  const showRefreshError = () => {
    // Saves unreadable: show the landing rather than keep the page blank.
    if (document.documentElement.dataset.home === "pending") setHome("first");
    report("No se pudo leer las partidas guardadas en este navegador.", "error");
  };

  const ctx: HomeContext = {
    repo: createGameRepo(),
    sync,
    refresh,
    refreshSafely: () => refresh().catch(showRefreshError),
    report,
  };

  const campaigns = setUpCampaignsView();
  const askDelete = setUpDeleteDialog(ctx, () => {
    if (!savesList.children.length) campaigns.leave();
  });
  setUpImportDialog(ctx);

  async function refresh() {
    const games = await ctx.repo.listSummaries();
    const [latest, ...rest] = games;
    if (latest) renderContinue(latest);
    renderOthers(rest.slice(0, 2), games.length);
    setHome(latest ? "returning" : "first");
    byId("saves-empty").hidden = games.length > 0;
    savesList.replaceChildren(
      ...games.map((game) =>
        saveRow(game, {
          onExport: (entry) => {
            void ctx.repo.load(entry.id).then((full) => {
              if (full) downloadGame(full);
            });
          },
          onDelete: askDelete,
        }),
      ),
    );
  }

  // Local first, so the list never waits for Drive.
  const firstPaint = ctx.refreshSafely();
  // Reloading (or sharing) /#campanas opens the list again.
  if (location.hash === CAMPAIGNS_HASH) void firstPaint.then(campaigns.show);
  // Back from /play restores this page from the bfcache: the card would show
  // the campaign as it was before that session.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void ctx.refreshSafely();
  });

  if (sync) keepInStepWithDrive(ctx, sync, firstPaint);
  if (import.meta.env.DEV) setUpMockButton(ctx);
}

function keepInStepWithDrive(ctx: HomeContext, sync: SyncRuntime, firstPaint: Promise<void>) {
  // A tap on the navbar sync button may have brought games from Drive.
  document.addEventListener(SYNC_TAPPED_EVENT, () => void ctx.refreshSafely());
  // Any sync may have changed this device's games (a download, a delete the
  // player agreed to in the conflict dialog): re-read the list when one ends.
  let wasSyncing = false;
  syncStatus.subscribe(({ state }) => {
    if (wasSyncing && state !== "syncing") void ctx.refreshSafely();
    wasSyncing = state === "syncing";
  });

  // Renewing opens a Google window, which needs GIS already loaded when the click lands.
  let gisReady = false;
  loadGis()
    .then(() => (gisReady = true))
    .catch(() => undefined);

  // Without a token this does nothing; the import dialog is where a tap brings Drive's campaigns.
  void firstPaint
    .then(() => sync.engine.syncAll())
    .catch(() => undefined)
    .then(() => ctx.refreshSafely());

  // "Seguir jugando" and "Jugar" renew with that same tap, reconcile the game, then navigate.
  let opening = false;
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href^='/play']") : null;
    if (!link || link.getAttribute("aria-disabled") === "true") return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!gisReady || !sync.auth.needsGesture()) return; // navigate normally
    event.preventDefault();
    if (opening) return;
    opening = true;
    const href = link.href;
    const id = new URL(href).searchParams.get("id");
    // A closed or failed Google window still opens the local copy.
    void withRenewal(sync, () => syncBeforeOpen(sync, id)).finally(() => {
      opening = false;
      location.href = href;
    });
  });
  // Back from /play restores this page from the bfcache with its old state: unlock the links.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) opening = false;
  });
}

/** Development aid: the button only exists under `pnpm dev`. The dynamic
    import sits behind the DEV check so a build doesn't ship the sample game. */
function setUpMockButton(ctx: HomeContext) {
  const button = document.getElementById("load-mock");
  button?.addEventListener("click", async () => {
    try {
      const { loadMockGame } = await import("../persistence/mockGame");
      const game = loadMockGame();
      await ctx.repo.save(game);
      location.href = playHref(game.id);
    } catch {
      ctx.report("No se pudo cargar la partida de ejemplo.", "error");
    }
  });
}
