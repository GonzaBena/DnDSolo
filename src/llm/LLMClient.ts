// The only door to the model (Spec, architecture rule 4). Nothing outside
// src/llm may import a vendor SDK, so swapping Gemini for a proxy later
// means writing one new class that implements this interface.

export interface StructuredRequest {
  system: string;
  prompt: string;
  /** Plain JSON Schema the response must conform to. */
  jsonSchema: unknown;
  /** Asks for livelier, less repetitive text. The client may ignore it on
      models where changing the default is advised against. */
  creative?: boolean;
  /** Called with each raw text fragment as it streams in. */
  onChunk?: (fragment: string) => void;
  signal?: AbortSignal;
}

export interface TextRequest {
  system?: string;
  prompt: string;
  signal?: AbortSignal;
}

export interface LLMClient {
  /** Returns the raw JSON text; validation belongs to the caller, which
      knows the domain schema and the retry policy. */
  generateStructured(request: StructuredRequest): Promise<string>;
  generateText(request: TextRequest): Promise<string>;
}

export type LLMErrorKind = "auth" | "rate_limit" | "network" | "empty" | "aborted" | "unknown";

/** Vendor errors are translated to this so the UI can explain them
    without knowing which provider is behind the client. */
export class LLMError extends Error {
  readonly kind: LLMErrorKind;

  constructor(kind: LLMErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LLMError";
    this.kind = kind;
  }
}
