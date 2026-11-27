import { LLMError } from "./LLMClient";

/** User-facing (Spanish) explanation of a failed model call. */
export function describeLLMError(error: unknown): string {
  if (error instanceof LLMError) {
    switch (error.kind) {
      case "auth":
        return "La API key no es válida o no tiene permiso para usar este modelo.";
      case "rate_limit":
        return "Llegaste al límite de uso de la API. Esperá un rato y probá de nuevo.";
      case "network":
        return "No se pudo conectar con Gemini. Revisá tu conexión a internet.";
      case "timeout":
        return "La respuesta tardó demasiado. Probá de nuevo.";
      case "empty":
        return "El modelo no devolvió ninguna respuesta. Probá de nuevo.";
      case "aborted":
        return "Cortaste la respuesta del DM.";
      case "unknown":
        return `Gemini devolvió un error: ${error.message}`;
    }
  }
  return "Ocurrió un error inesperado.";
}
