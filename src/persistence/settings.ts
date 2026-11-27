// User settings live in localStorage (Spec, MVP scope 2): the API key never
// touches the repo or any server other than Google's.

export type SuggestionsMode = "auto" | "on_demand" | "off";

export interface Settings {
  apiKey: string;
  model: string;
  /** Optional lighter model for summaries and on-demand suggestions; "" uses `model`. */
  auxiliaryModel: string;
  /** Lower the model's thinking to answer sooner. */
  fastNarration: boolean;
  /** Kept for compatibility; true when suggestionsMode !== "off". */
  showSuggestions: boolean;
  /** Whether the DM includes suggestions every turn, only on demand, or never. */
  suggestionsMode: SuggestionsMode;
}

const STORAGE_KEY = "dnsolo.settings";

function parseSuggestionsMode(mode: unknown, showSuggestions: unknown): SuggestionsMode {
  if (mode === "auto" || mode === "on_demand" || mode === "off") return mode;
  return showSuggestions === false ? "off" : "auto";
}

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { apiKey, model, auxiliaryModel, fastNarration, showSuggestions, suggestionsMode } = parsed as Record<
      string,
      unknown
    >;
    if (typeof apiKey !== "string" || typeof model !== "string") return null;
    const mode = parseSuggestionsMode(suggestionsMode, showSuggestions);
    return {
      apiKey,
      model,
      auxiliaryModel: typeof auxiliaryModel === "string" ? auxiliaryModel : "",
      fastNarration: fastNarration === true,
      showSuggestions: mode !== "off",
      suggestionsMode: mode,
    };
  } catch {
    // Blocked storage or corrupt JSON both mean "not configured".
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isConfigured(settings: Settings | null): settings is Settings {
  return settings !== null && settings.apiKey.trim() !== "" && settings.model.trim() !== "";
}
