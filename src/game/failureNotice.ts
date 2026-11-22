import type { TurnFailure } from "../engine/TurnEngine";
import { describeLLMError } from "../llm/errorMessages";

export interface FailureNotice {
  message: string;
  /** Only LLM failures can be fixed from the settings page. */
  suggestSettings: boolean;
}

export function describeFailure(failure: TurnFailure): FailureNotice {
  switch (failure.kind) {
    case "llm":
      return { message: describeLLMError(failure.cause), suggestSettings: true };
    case "invalid_response":
      return {
        message:
          "El DM respondió algo que no se pudo interpretar. Tu partida está intacta: probá de nuevo.",
        suggestSettings: false,
      };
    case "invalid_input":
      return { message: "Esa acción no se puede hacer en este momento.", suggestSettings: false };
    case "aborted":
      return { message: "Cortaste la respuesta del DM.", suggestSettings: false };
  }
}
