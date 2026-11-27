// "Importar campaña": a file from this device, or the campaigns in Drive.
import type { GameState } from "../domain/types";
import { describeSummary, showSyncToast } from "../sync/firstConnect";
import { driveRows, pendingCount } from "../sync/driveImport";
import { withRenewal } from "../sync/runtime";
import { driveRow } from "./campaignRows";
import { summarizeCampaign } from "./campaignSummary";
import type { HomeContext } from "./context";
import { byId } from "./dom";
import { conflictQuestion, decideImport } from "./importFile";

/** How long a message in the drop zone (or the page's status line) stays. */
const MESSAGE_MS = 4000;

export function setUpImportDialog(ctx: HomeContext): void {
  const dialog = byId<HTMLDialogElement>("import-dialog");
  const fileInput = byId<HTMLInputElement>("import-file");
  const dropZone = byId<HTMLButtonElement>("drop-zone");
  const openDrive = setUpDriveHalf(ctx);

  const open = () => {
    if (!dialog.open) dialog.showModal();
    openDrive();
  };
  for (const id of ["import-save", "import-save-first", "import-save-returning"]) byId(id).addEventListener("click", open);
  byId("import-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // backdrop
  });

  // A bad file keeps the dialog open: the zone turns red with the reason for a
  // few seconds, or until the next try, so the player can pick another one.
  const dropTitle = byId("drop-title");
  const dropHint = byId("drop-hint");
  const dropDefaults = [dropTitle.textContent, dropHint.textContent];
  let dropTimer: ReturnType<typeof setTimeout> | undefined;
  function clearDrop() {
    clearTimeout(dropTimer);
    delete dropZone.dataset.error;
    delete dropZone.dataset.notice;
    [dropTitle.textContent, dropHint.textContent] = dropDefaults;
  }
  /** "error" turns the zone red; "notice" only tells (the file was fine). */
  function showDrop(message: string, hint = "Probá con otro archivo.", tone: "error" | "notice" = "error") {
    clearDrop();
    dropZone.dataset[tone] = "";
    dropTitle.textContent = message;
    dropHint.textContent = hint;
    dropTimer = setTimeout(clearDrop, MESSAGE_MS);
  }

  // Importing a campaign this device already has: identical saves are
  // skipped; a different version asks whether to replace it or keep both.
  const conflictBox = byId("import-conflict");
  let conflictGame: GameState | null = null;
  function clearConflict() {
    conflictGame = null;
    conflictBox.hidden = true;
  }
  function askConflict(game: GameState, newer: boolean) {
    conflictGame = game;
    byId("import-conflict-text").textContent = conflictQuestion(summarizeCampaign(game).name, newer);
    conflictBox.hidden = false;
    byId(newer ? "import-replace" : "import-copy").focus();
  }
  const reset = () => {
    clearDrop();
    clearConflict();
  };

  // Replacing keeps the id, so it overwrites (and syncs) the campaign already here.
  // `restore`: the file keeps its id, and the player wants it back even if it
  // was deleted from Drive before (otherwise sync would ask to delete it again).
  async function save(game: GameState, message: string, restore = false) {
    if (restore) ctx.sync?.engine.allowRestore(game.id);
    try {
      await ctx.repo.save(game);
      await ctx.refresh();
      dialog.close();
      ctx.report(message, "ok");
      const status = byId("save-info");
      setTimeout(() => {
        if (status.textContent === message) status.textContent = "";
      }, MESSAGE_MS);
    } catch {
      clearConflict();
      showDrop("No se pudo guardar la campaña.");
    }
  }

  async function importFile(file: File) {
    reset();
    const decision = await decideImport(await file.text().catch(() => ""), (id) => ctx.repo.load(id));
    switch (decision.kind) {
      case "invalid":
        return showDrop("Ese archivo no es una campaña válida.");
      case "unreadable":
        return showDrop("No se pudo leer tus campañas guardadas.");
      case "same":
        return showDrop("Ya tenés esta campaña.", "No hacía falta importarla.", "notice");
      case "new":
        return save(decision.game, "Campaña importada.", true);
      case "conflict":
        return askConflict(decision.game, decision.newer);
    }
  }

  byId("import-replace").addEventListener("click", () => {
    if (conflictGame) void save(conflictGame, "Campaña importada.", true);
  });
  byId("import-copy").addEventListener("click", () => {
    if (conflictGame) void save({ ...conflictGame, id: crypto.randomUUID() }, "Se guardó como una campaña aparte.");
  });
  dialog.addEventListener("close", reset);

  dropZone.addEventListener("click", () => {
    reset();
    fileInput.click();
  });
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    reset();
    dropZone.dataset.over = "";
  });
  dropZone.addEventListener("dragleave", () => delete dropZone.dataset.over);
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    delete dropZone.dataset.over;
    const file = event.dataTransfer?.files[0];
    if (file) void importFile(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void importFile(file);
  });
}

/**
 * The Drive half of the dialog; returns what to run each time the dialog
 * opens. Listing needs a token: with one it loads on open; without one, a tap
 * renews (the Google window needs that tap). Absent in builds without sync.
 */
function setUpDriveHalf(ctx: HomeContext): () => void {
  const note = document.getElementById("drive-note");
  const list = document.getElementById("drive-list") as HTMLUListElement | null;
  const action = document.getElementById("drive-action") as HTMLButtonElement | null;
  const connect = document.getElementById("drive-connect");
  if (!note || !list || !action || !connect) return () => undefined;
  const { sync } = ctx;

  type Step = "list" | "bring";
  let step: Step = "list";
  let busy = false;

  function show(text: string, label: string | null, next: Step = "list") {
    note!.textContent = text;
    action!.hidden = !label;
    action!.textContent = label ?? "";
    action!.classList.toggle("button--primary", next === "bring");
    step = next;
  }

  async function load() {
    if (!sync) return;
    busy = true;
    show("Buscando en tu Drive…", null);
    list!.hidden = true;
    try {
      const [remote, local] = await Promise.all([sync.listRemote(), ctx.repo.listSummaries()]);
      const rows = driveRows(remote, local);
      list!.replaceChildren(...rows.map(driveRow));
      list!.hidden = rows.length === 0;
      const pending = pendingCount(rows);
      if (!rows.length) show("Todavía no hay campañas en tu Drive.", null);
      else if (!pending) show("Tenés todo al día.", null);
      else show("", pending === 1 ? "Traer 1 campaña" : `Traer ${pending} campañas`, "bring");
    } catch {
      show(
        sync.auth.needsGesture() ? "Hace falta volver a dar permiso a Google Drive." : "No se pudo leer tu Drive.",
        "Reintentar",
      );
    } finally {
      busy = false;
    }
  }

  action.addEventListener("click", () => {
    if (!sync || busy) return;
    action.disabled = true;
    // withRenewal runs synchronously in the click: the Google window needs the live gesture.
    const run =
      step === "bring"
        ? async () => {
            const summary = await sync.engine.syncAll();
            if (summary) showSyncToast(describeSummary(summary));
            await ctx.refreshSafely();
            await load();
          }
        : load;
    void withRenewal(sync, run).finally(() => (action.disabled = false));
  });

  return () => {
    connect.hidden = Boolean(sync);
    if (!sync) {
      list.hidden = true;
      return show("Conectá tu Google Drive para traer las campañas de tus otros dispositivos.", null);
    }
    if (busy) return;
    if (sync.auth.needsGesture()) {
      list.hidden = true;
      return show("Tocá para ver las campañas que tenés guardadas en Drive.", "Ver campañas de Drive");
    }
    void load();
  };
}
