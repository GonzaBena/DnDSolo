import { useCallback, useEffect, useRef, useState } from "react";
import type { Character } from "../domain/types";
import { GeminiClient } from "../llm/GeminiClient";
import { describeLLMError } from "../llm/errorMessages";
import { LLMError } from "../llm/LLMClient";
import { isConfigured, loadSettings } from "../persistence/settings";
import type { CharacterChoices } from "../rules/buildSheet";
import { formatSheetText } from "../rules/formatSheet";
import { generateChoicesFor } from "../rules/generateOptions";
import type { CharacterSheet } from "../rules/types";

/** Shown on opening an old save; "Cancelar" hides it until the game is opened again. */
export function UpgradeNotice({ onUpgrade, onCancel }: { onUpgrade: () => void; onCancel: () => void }) {
  return (
    <div className="upgrade-notice" role="status">
      <p>Esta partida usa una ficha antigua. Actualizala para que suba de nivel con sus PG y elecciones.</p>
      <div className="upgrade-notice__actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="button button--primary" onClick={onUpgrade}>
          Actualizar
        </button>
      </div>
    </div>
  );
}

export type UpgradePhase =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "proposal"; choices: CharacterChoices; sheet: CharacterSheet };

interface BodyProps {
  name: string;
  story: string;
  phase: UpgradePhase;
  onUse: (choices: CharacterChoices, sheet: CharacterSheet) => void;
  onRetry: () => void;
  onCancel: () => void;
}

/** What the upgrade dialog shows: the proposed sheet, or why there is none. */
export function SheetUpgradeBody({ name, story, phase, onUse, onRetry, onCancel }: BodyProps) {
  return (
    <div className="sheet-upgrade__content">
      <h2 id="sheet-upgrade-title" className="sheet-upgrade__title">
        Ficha nueva de {name}
      </h2>
      {phase.status === "loading" && <p className="sheet-upgrade__status">Armando la ficha…</p>}
      {phase.status === "failed" && <p className="sheet-upgrade__status">{phase.message}</p>}
      {phase.status === "proposal" && (
        <pre className="sheet-upgrade__sheet">{formatSheetText(phase.sheet, name, story)}</pre>
      )}
      <div className="sheet-upgrade__actions">
        <button type="button" className="button" onClick={onCancel}>
          Cancelar
        </button>
        {phase.status !== "loading" && (
          <button type="button" className="button" onClick={onRetry}>
            Otra propuesta
          </button>
        )}
        {phase.status === "proposal" && (
          <button type="button" className="button button--primary" onClick={() => onUse(phase.choices, phase.sheet)}>
            Usar esta
          </button>
        )}
      </div>
    </div>
  );
}

/** Asks the generator for a valid sheet for this same character and lets the player take it or ask again. */
export function SheetUpgradeDialog({
  player,
  onUse,
  onClose,
}: {
  player: Character;
  onUse: (choices: CharacterChoices, sheet: CharacterSheet) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<UpgradePhase>({ status: "loading" });
  const story = player.background ?? "";

  const propose = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ status: "loading" });
    try {
      const settings = loadSettings();
      if (!isConfigured(settings)) {
        setPhase({ status: "failed", message: "Falta configurar la clave del modelo en Ajustes." });
        return;
      }
      const llm = new GeminiClient(settings.apiKey, settings.model, { fastNarration: settings.fastNarration });
      const result = await generateChoicesFor(
        llm,
        {
          name: player.name,
          story,
          speciesId: player.speciesId!,
          classId: player.classId!,
          backgroundId: player.srdBackgroundId!,
          level: player.level,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setPhase(result.ok ? { status: "proposal", ...result } : { status: "failed", message: result.failure });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof LLMError ? describeLLMError(error) : error instanceof Error ? error.message : "Ocurrió un error inesperado.";
      setPhase({ status: "failed", message });
    }
  }, [player, story]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    void propose();
    return () => abortRef.current?.abort();
    // Only on opening: "Otra propuesta" asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog ref={dialogRef} className="sheet-upgrade" aria-labelledby="sheet-upgrade-title" onClose={onClose}>
      <SheetUpgradeBody
        name={player.name}
        story={story}
        phase={phase}
        onUse={(choices, sheet) => void onUse(choices, sheet).then(() => dialogRef.current?.close())}
        onRetry={() => void propose()}
        onCancel={() => dialogRef.current?.close()}
      />
    </dialog>
  );
}
