// "Ver todas" looks like its own page, so it gets a history entry: the
// browser's back button returns to the home instead of leaving it.
import { enterPage } from "../animations/motion";
import { byId } from "./dom";

export const CAMPAIGNS_HASH = "#campanas";

export interface CampaignsView {
  show(): void;
  /** Back to the home: pops our own entry, or rewrites a URL opened directly at #campanas. */
  leave(): void;
}

// Swapping views keeps the scroll offset, so a tall home on a phone would
// open the list already scrolled to its last rows. Each view starts at the top.
const toTop = () => window.scrollTo({ top: 0, behavior: "instant" });

const visibleChildren = (parent: Element) => [...parent.children].filter((el) => el.getClientRects().length > 0);

export function setUpCampaignsView(): CampaignsView {
  const homes = [byId("home-first"), byId("home-returning")];
  const loadPanel = byId("menu-load");
  const savesList = byId<HTMLUListElement>("saves");

  function showMain() {
    loadPanel.hidden = true;
    // CSS shows the active one, and its entrance animation replays as it appears.
    for (const home of homes) home.hidden = false;
    toTop();
  }

  function show() {
    if (!loadPanel.hidden) return;
    for (const home of homes) home.hidden = true;
    loadPanel.hidden = false;
    toTop();
    // The rows rise one by one, not the list as a block.
    enterPage(visibleChildren(loadPanel).flatMap((el) => (el === savesList ? [...savesList.children] : [el])));
  }

  function leave() {
    if ((history.state as { view?: string } | null)?.view === "campaigns") return history.back();
    history.replaceState(null, "", location.pathname + location.search);
    showMain();
  }

  window.addEventListener("popstate", () => {
    if (location.hash === CAMPAIGNS_HASH) show();
    else showMain();
  });
  byId("open-load").addEventListener("click", () => {
    history.pushState({ view: "campaigns" }, "", CAMPAIGNS_HASH);
    show();
  });
  byId("close-load").addEventListener("click", leave);

  return { show, leave };
}
