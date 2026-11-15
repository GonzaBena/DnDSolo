import { ApiError, GoogleGenAI } from "@google/genai";
import { LLMError, type LLMClient, type StructuredRequest, type TextRequest } from "./LLMClient";

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (error instanceof ApiError) {
    // An invalid key comes back as 400 (API_KEY_INVALID), not 401.
    const isKeyProblem =
      error.status === 401 || error.status === 403 || /api[_ ]key/i.test(error.message);
    if (isKeyProblem) return new LLMError("auth", error.message, { cause: error });
    if (error.status === 429) return new LLMError("rate_limit", error.message, { cause: error });
    return new LLMError("unknown", error.message, { cause: error });
  }
  if (error instanceof TypeError) {
    // fetch() rejects with TypeError when the request never reached the server.
    return new LLMError("network", error.message, { cause: error });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new LLMError("unknown", message, { cause: error });
}

export class GeminiClient implements LLMClient {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateStructured(request: StructuredRequest): Promise<string> {
    try {
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
          abortSignal: request.signal,
        },
      });
      let full = "";
      for await (const chunk of stream) {
        const fragment = chunk.text;
        if (!fragment) continue;
        full += fragment;
        request.onChunk?.(fragment);
      }
      if (!full) throw new LLMError("empty", "The model returned no text.");
      return full;
    } catch (error) {
      throw toLLMError(error);
    }
  }

  async generateText(request: TextRequest): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: request.prompt,
        config: { systemInstruction: request.system, abortSignal: request.signal },
      });
      const text = response.text;
      if (!text) throw new LLMError("empty", "The model returned no text.");
      return text;
    } catch (error) {
      throw toLLMError(error);
    }
  }
}

export interface ModelOption {
  id: string;
  label: string;
}

/** Model names are asked to the API instead of being hardcoded: they change
    often and each key has access to a different set. */
export async function listGeminiModels(apiKey: string): Promise<ModelOption[]> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    const options: ModelOption[] = [];
    for await (const model of pager) {
      if (!model.name) continue;
      if (!model.supportedActions?.includes("generateContent")) continue;
      options.push({ id: model.name, label: model.displayName ?? model.name });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    throw toLLMError(error);
  }
}
