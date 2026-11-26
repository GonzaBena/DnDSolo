// Gemini over its REST API with plain fetch. The official SDK weighed ~400 KB
// in the browser for the three calls used here (stream a turn, write the
// summary, list models).
import { temperatureFor, thinkingConfigFor } from "./thinking";
import { LLMError, type LLMClient, type StructuredRequest, type TextRequest } from "./LLMClient";

const API = "https://generativelanguage.googleapis.com/v1beta";

/** Google's error body: `{ error: { code, message, status } }`. */
class GeminiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  // Raised when the AbortSignal passed in the request fires.
  if ((error instanceof Error || error instanceof DOMException) && error.name === "AbortError") {
    return new LLMError("aborted", error.message, { cause: error });
  }
  if (error instanceof GeminiHttpError) {
    // An invalid key comes back as 400 (API_KEY_INVALID), not 401.
    const isKeyProblem = error.status === 401 || error.status === 403 || /api[_ ]key/i.test(error.message);
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

function abortedError(): LLMError {
  return new LLMError("aborted", "The request was aborted.");
}

/** "gemini-2.5-flash" and "models/gemini-2.5-flash" name the same model. */
const modelPath = (model: string) => (model.startsWith("models/") ? model : `models/${model}`);

interface Part {
  text?: string;
  /** The model's reasoning, when it shares it: never part of the answer. */
  thought?: boolean;
}

interface GenerateResponse {
  candidates?: { content?: { parts?: Part[] } }[];
  error?: { code?: number; message?: string };
}

/** The answer's text, as the SDK's `response.text` read it. */
function textOf(response: GenerateResponse): string {
  if (response.error) throw new GeminiHttpError(response.error.code ?? 500, response.error.message ?? "Gemini error");
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
}

async function send(fetchFn: typeof fetch, url: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetchFn(url, {
    ...init,
    // In a header, not the URL, so the key stays out of logs and history.
    headers: { "x-goog-api-key": apiKey, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as GenerateResponse | null;
    throw new GeminiHttpError(response.status, body?.error?.message ?? `Gemini answered ${response.status}`);
  }
  return response;
}

/** Each server-sent event's JSON, as it arrives. */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<GenerateResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (event: string): GenerateResponse | null => {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    return data ? (JSON.parse(data) as GenerateResponse) : null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // stream: a multi-byte letter (á, ñ) can be split between two reads.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const event = parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (event) yield event;
      }
    }
    const last = parse(buffer + decoder.decode());
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

export class GeminiClient implements LLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fastNarration: boolean;
  private readonly fetchFn: typeof fetch;

  constructor(
    apiKey: string,
    model: string,
    options: { fastNarration?: boolean; fetchFn?: typeof fetch } = {},
  ) {
    this.apiKey = apiKey;
    this.model = modelPath(model);
    this.fastNarration = options.fastNarration ?? false;
    // Bound: a bare `fetch` stored on an object loses its window receiver.
    this.fetchFn = options.fetchFn ?? ((...args) => fetch(...args));
  }

  async generateStructured(request: StructuredRequest): Promise<string> {
    try {
      // Only the turn call: the summary keeps the model's default thinking.
      const thinkingConfig = thinkingConfigFor(this.model, this.fastNarration);
      const temperature = temperatureFor(this.model, request.creative ?? false);
      const response = await send(this.fetchFn, `${API}/${this.model}:streamGenerateContent?alt=sse`, this.apiKey, {
        method: "POST",
        signal: request.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          systemInstruction: { parts: [{ text: request.system }] },
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: request.jsonSchema,
            ...(thinkingConfig ? { thinkingConfig } : {}),
            ...(temperature !== undefined ? { temperature } : {}),
          },
        }),
      });
      if (!response.body) throw new LLMError("empty", "The model returned no text.");
      let full = "";
      for await (const event of sseEvents(response.body)) {
        if (request.signal?.aborted) throw abortedError();
        const fragment = textOf(event);
        if (!fragment) continue;
        full += fragment;
        request.onChunk?.(fragment);
      }
      // The stream can end quietly when cut: don't return the partial text.
      if (request.signal?.aborted) throw abortedError();
      if (!full) throw new LLMError("empty", "The model returned no text.");
      return full;
    } catch (error) {
      throw toLLMError(error);
    }
  }

  async generateText(request: TextRequest): Promise<string> {
    try {
      const response = await send(this.fetchFn, `${API}/${this.model}:generateContent`, this.apiKey, {
        method: "POST",
        signal: request.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
        }),
      });
      const text = textOf((await response.json()) as GenerateResponse);
      if (request.signal?.aborted) throw abortedError();
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

interface ModelsPage {
  models?: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  nextPageToken?: string;
}

/** Model names are asked to the API instead of being hardcoded: they change
    often and each key has access to a different set. */
export async function listGeminiModels(
  apiKey: string,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<ModelOption[]> {
  try {
    const options: ModelOption[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: "100", ...(pageToken ? { pageToken } : {}) });
      const page = (await (await send(fetchFn, `${API}/models?${query}`, apiKey)).json()) as ModelsPage;
      for (const model of page.models ?? []) {
        if (!model.name) continue;
        if (!model.supportedGenerationMethods?.includes("generateContent")) continue;
        options.push({ id: model.name, label: model.displayName ?? model.name });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return options.sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    throw toLLMError(error);
  }
}
