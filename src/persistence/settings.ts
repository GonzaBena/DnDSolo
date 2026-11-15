// User settings live in localStorage (Spec, MVP scope 2): the API key never
// touches the repo or any server other than Google's.

export interface Settings {
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "dnsolo.settings";

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { apiKey, model } = parsed as Record<string, unknown>;
    if (typeof apiKey !== "string" || typeof model !== "string") return null;
    return { apiKey, model };
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
