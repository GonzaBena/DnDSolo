// "Gemini" section: the API key, the model and the narration options.
import { GeminiClient, listGeminiModels } from "../llm/GeminiClient";
import { describeLLMError } from "../llm/errorMessages";
import { loadSettings, saveSettings, type SuggestionsMode } from "../persistence/settings";

type RequiredField = HTMLInputElement | HTMLSelectElement;

/**
 * Marks the empty required fields (aria-invalid) and focuses the first one,
 * or `fallback` when that one is disabled; true when nothing is missing.
 */
export function markMissing(fields: RequiredField[], fallback: HTMLElement): boolean {
  const missing = fields.filter((field) => !field.value.trim());
  for (const field of fields) {
    if (missing.includes(field)) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }
  const first = missing[0];
  if (first) (first.disabled ? fallback : first).focus();
  return missing.length === 0;
}

export function setUpApiSection(): void {
  const form = document.querySelector<HTMLFormElement>("#settings-form")!;
  const keyInput = document.querySelector<HTMLInputElement>("#api-key")!;
  const modelSelect = document.querySelector<HTMLSelectElement>("#model")!;
  const auxModelSelect = document.querySelector<HTMLSelectElement>("#aux-model")!;
  const fastInput = document.querySelector<HTMLInputElement>("#fast-narration")!;
  const suggestionsSelect = document.querySelector<HTMLSelectElement>("#suggestions-mode")!;
  const loadButton = document.querySelector<HTMLButtonElement>("#load-models")!;
  const testButton = document.querySelector<HTMLButtonElement>("#test")!;
  const status = document.querySelector<HTMLParagraphElement>("#status")!;
  const notice = document.querySelector<HTMLParagraphElement>("#missing-notice")!;

  const toggleKeyButton = document.querySelector<HTMLButtonElement>("#toggle-key")!;

  function setStatus(text: string, tone: "info" | "ok" | "error" = "info") {
    status.textContent = text;
    status.dataset.tone = tone;
  }

  // A model list that was never loaded can't take focus: its "Cargar modelos" button can.
  const requireFilled = (fields: RequiredField[]) => markMissing(fields, loadButton);

  for (const field of [keyInput, modelSelect]) {
    const clear = () => field.value.trim() && field.removeAttribute("aria-invalid");
    field.addEventListener("input", clear);
    field.addEventListener("change", clear);
  }

  toggleKeyButton.addEventListener("click", () => {
    const show = keyInput.type === "password";
    keyInput.type = show ? "text" : "password";
    toggleKeyButton.setAttribute("aria-pressed", String(show));
    toggleKeyButton.textContent = show ? "Ocultar" : "Mostrar";
  });

  async function loadModels(preferred: string, preferredAux: string) {
    const apiKey = keyInput.value.trim();
    if (!requireFilled([keyInput])) {
      setStatus("Primero pegá tu API key.", "error");
      return;
    }
    setStatus("Cargando modelos…");
    loadButton.disabled = true;
    try {
      const models = await listGeminiModels(apiKey);
      modelSelect.replaceChildren(
        new Option("Elegí un modelo", ""),
        ...models.map((m) => new Option(m.label, m.id)),
      );
      modelSelect.disabled = false;
      auxModelSelect.replaceChildren(
        new Option("El mismo que el principal", ""),
        ...models.map((m) => new Option(m.label, m.id)),
      );
      auxModelSelect.disabled = false;
      // Keep the saved choice only if this key can still use it.
      if (models.some((m) => m.id === preferred)) modelSelect.value = preferred;
      if (models.some((m) => m.id === preferredAux)) auxModelSelect.value = preferredAux;
      setStatus(`${models.length} modelos disponibles.`, "ok");
    } catch (error) {
      setStatus(describeLLMError(error), "error");
    } finally {
      loadButton.disabled = false;
    }
  }

  loadButton.addEventListener("click", () => void loadModels(modelSelect.value, auxModelSelect.value));

  testButton.addEventListener("click", async () => {
    const apiKey = keyInput.value.trim();
    const model = modelSelect.value;
    if (!requireFilled([keyInput, modelSelect])) {
      setStatus("Necesitás una API key y un modelo para probar.", "error");
      return;
    }
    setStatus("Probando…");
    testButton.disabled = true;
    try {
      const reply = await new GeminiClient(apiKey, model).generateText({
        prompt: "Saludá en una sola oración corta, como un Dungeon Master que da la bienvenida.",
      });
      setStatus(`Funciona. El modelo respondió: «${reply.trim()}»`, "ok");
    } catch (error) {
      setStatus(describeLLMError(error), "error");
    } finally {
      testButton.disabled = false;
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const apiKey = keyInput.value.trim();
    const model = modelSelect.value;
    if (!requireFilled([keyInput, modelSelect])) {
      setStatus("Necesitás una API key y un modelo para guardar.", "error");
      return;
    }
    const suggestionsMode = suggestionsSelect.value as SuggestionsMode;
    saveSettings({
      apiKey,
      model,
      auxiliaryModel: auxModelSelect.value,
      fastNarration: fastInput.checked,
      showSuggestions: suggestionsMode !== "off",
      suggestionsMode,
    });
    notice.hidden = true;
    setStatus("Configuración guardada.", "ok");
  });

  const saved = loadSettings();
  notice.hidden = !new URLSearchParams(location.search).has("missing");
  if (saved) {
    keyInput.value = saved.apiKey;
    fastInput.checked = saved.fastNarration;
    suggestionsSelect.value = saved.suggestionsMode;
    void loadModels(saved.model, saved.auxiliaryModel);
  }
}
