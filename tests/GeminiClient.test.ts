import { describe, expect, it, vi } from "vitest";
import { GeminiClient, listGeminiModels } from "../src/llm/GeminiClient";
import { LLMError } from "../src/llm/LLMClient";

const encoder = new TextEncoder();

/** A streamGenerateContent answer: one SSE event per text, delivered in
    `pieces` network reads so events can be split across them. */
function sseResponse(texts: string[], pieces = 1): Response {
  const body = texts
    .map((text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\r\n\r\n`)
    .join("");
  const size = Math.ceil(body.length / pieces);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < body.length; i += size) controller.enqueue(encoder.encode(body.slice(i, i + size)));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const apiError = (status: number, message: string) => jsonResponse(status, { error: { code: status, message } });

function fakeFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  return fn;
}

const requestOf = (fn: ReturnType<typeof fakeFetch>, call = 0) => {
  const [url, init] = fn.mock.calls[call]!;
  return { url: String(url), init: init!, body: JSON.parse(String(init!.body ?? "null")) };
};

const structured = { system: "s", prompt: "p", jsonSchema: { type: "object" } };

describe("GeminiClient.generateStructured", () => {
  it("streams the narration and returns the whole text", async () => {
    const fetchFn = fakeFetch(sseResponse(['{"narr', 'ation":"hola"}'], 3));
    const chunks: string[] = [];
    const text = await new GeminiClient("k", "models/gemini-2.5-flash", { fetchFn }).generateStructured({
      ...structured,
      onChunk: (fragment) => chunks.push(fragment),
    });
    expect(text).toBe('{"narration":"hola"}');
    expect(chunks).toEqual(['{"narr', 'ation":"hola"}']);
  });

  it("sends the key in a header, the schema and the system prompt", async () => {
    const fetchFn = fakeFetch(sseResponse(["{}"]));
    await new GeminiClient("secret", "gemini-2.5-flash", { fetchFn }).generateStructured(structured);
    const { url, init, body } = requestOf(fetchFn);
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
    expect(url).not.toContain("secret");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("secret");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "p" }] }]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "s" }] });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema).toEqual({ type: "object" });
  });

  it("keeps accented letters split between two network reads", async () => {
    const bytes = encoder.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "año" }] } }] })}\n\n`);
    const cut = bytes.indexOf(0xc3) + 1; // inside the two bytes of "ñ"
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    const fetchFn = fakeFetch(new Response(stream, { status: 200 }));
    expect(await new GeminiClient("k", "m", { fetchFn }).generateStructured(structured)).toBe("año");
  });

  it("skips the model's thought parts", async () => {
    const event = { candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: "{}" }] } }] };
    const fetchFn = fakeFetch(
      new Response(`data: ${JSON.stringify(event)}\n\n`, { status: 200 }),
    );
    expect(await new GeminiClient("k", "m", { fetchFn }).generateStructured(structured)).toBe("{}");
  });

  it("passes thinkingConfig to the turn call when fast", async () => {
    const fetchFn = fakeFetch(sseResponse(["{}"]));
    await new GeminiClient("k", "gemini-2.5-flash", { fastNarration: true, fetchFn }).generateStructured(structured);
    expect(requestOf(fetchFn).body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("omits thinkingConfig when not fast", async () => {
    const fetchFn = fakeFetch(sseResponse(["{}"]));
    await new GeminiClient("k", "gemini-2.5-flash", { fetchFn }).generateStructured(structured);
    expect(requestOf(fetchFn).body.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("raises the temperature only for creative calls", async () => {
    const creative = fakeFetch(sseResponse(["{}"]));
    await new GeminiClient("k", "gemini-2.5-flash", { fetchFn: creative }).generateStructured({ ...structured, creative: true });
    expect(requestOf(creative).body.generationConfig.temperature).toBe(1.05);
    const plain = fakeFetch(sseResponse(["{}"]));
    await new GeminiClient("k", "gemini-2.5-flash", { fetchFn: plain }).generateStructured(structured);
    expect(requestOf(plain).body.generationConfig).not.toHaveProperty("temperature");
  });

  it("fails as empty when the stream brings no text", async () => {
    const fetchFn = fakeFetch(sseResponse([]));
    await expect(new GeminiClient("k", "m", { fetchFn }).generateStructured(structured)).rejects.toMatchObject({
      kind: "empty",
    });
  });

  it("times out when a stream stalls before delivering a chunk", async () => {
    const stalledStream = new ReadableStream<Uint8Array>({
      start() {
        // Never enqueues or closes.
      },
    });
    const fetchFn = fakeFetch(new Response(stalledStream, { status: 200 }));
    await expect(
      new GeminiClient("k", "m", { fetchFn, requestTimeoutMs: 500, streamIdleTimeoutMs: 25 }).generateStructured(structured),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("keeps user aborts as aborted rather than timeout", async () => {
    const controller = new AbortController();
    const stalledStream = new ReadableStream<Uint8Array>({ start() {} });
    const fetchFn = fakeFetch(new Response(stalledStream, { status: 200 }));
    const promise = new GeminiClient("k", "m", { fetchFn, streamIdleTimeoutMs: 200 }).generateStructured({
      ...structured,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ kind: "aborted" });
  });
});

describe("GeminiClient.generateText", () => {
  it("returns the text and never sends thinkingConfig", async () => {
    const fetchFn = fakeFetch(jsonResponse(200, { candidates: [{ content: { parts: [{ text: "hola" }] } }] }));
    const text = await new GeminiClient("k", "gemini-2.5-flash", { fastNarration: true, fetchFn }).generateText({
      prompt: "p",
    });
    expect(text).toBe("hola");
    const { url, body } = requestOf(fetchFn);
    expect(url).toMatch(/models\/gemini-2\.5-flash:generateContent$/);
    expect(body).not.toHaveProperty("generationConfig");
    expect(body).not.toHaveProperty("systemInstruction");
  });
});

describe("error translation", () => {
  const fail = (response: Response | Error) => {
    const fetchFn = vi.fn<typeof fetch>();
    if (response instanceof Error) fetchFn.mockRejectedValue(response);
    else fetchFn.mockResolvedValue(response);
    return new GeminiClient("k", "m", { fetchFn }).generateText({ prompt: "p" });
  };

  it("an invalid key (400) is an auth problem", async () => {
    await expect(fail(apiError(400, "API key not valid. Please pass a valid API key."))).rejects.toMatchObject({
      kind: "auth",
    });
  });
  it("403 is an auth problem", async () => {
    await expect(fail(apiError(403, "Permission denied"))).rejects.toMatchObject({ kind: "auth" });
  });
  it("429 is the rate limit", async () => {
    await expect(fail(apiError(429, "Resource exhausted"))).rejects.toMatchObject({ kind: "rate_limit" });
  });
  it("other statuses are unknown and keep Google's message", async () => {
    const error = await fail(apiError(500, "Internal error")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LLMError);
    expect(error).toMatchObject({ kind: "unknown", message: "Internal error" });
  });
  it("a request that never reached the server is a network problem", async () => {
    await expect(fail(new TypeError("Failed to fetch"))).rejects.toMatchObject({ kind: "network" });
  });
  it("an aborted request is aborted", async () => {
    await expect(fail(new DOMException("The operation was aborted.", "AbortError"))).rejects.toMatchObject({
      kind: "aborted",
    });
  });
});

describe("listGeminiModels", () => {
  it("follows the pages and keeps only models that generate content, sorted", async () => {
    const fetchFn = fakeFetch(
      jsonResponse(200, {
        models: [
          { name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", supportedGenerationMethods: ["generateContent"] },
          { name: "models/embedding-001", displayName: "Embedding", supportedGenerationMethods: ["embedContent"] },
        ],
        nextPageToken: "next",
      }),
      jsonResponse(200, {
        models: [{ name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] }],
      }),
    );
    expect(await listGeminiModels("k", fetchFn)).toEqual([
      { id: "models/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "models/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ]);
    expect(requestOf(fetchFn, 1).url).toContain("pageToken=next");
  });

  it("translates an invalid key", async () => {
    await expect(listGeminiModels("bad", fakeFetch(apiError(400, "API key not valid.")))).rejects.toMatchObject({
      kind: "auth",
    });
  });
});
