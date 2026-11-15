import type { LLMClient, StructuredRequest, TextRequest } from "./LLMClient";

type Scripted = string | Error;

/** Scripted client for tests: replies come from a queue, requests are
    recorded so tests can assert on what the engine actually sent. */
export class FakeLLMClient implements LLMClient {
  readonly structuredRequests: StructuredRequest[] = [];
  readonly textRequests: TextRequest[] = [];
  private readonly structuredQueue: Scripted[] = [];
  private readonly textQueue: Scripted[] = [];

  queueStructured(...replies: (object | string | Error)[]): this {
    for (const reply of replies) {
      this.structuredQueue.push(
        typeof reply === "string" || reply instanceof Error ? reply : JSON.stringify(reply),
      );
    }
    return this;
  }

  queueText(...replies: Scripted[]): this {
    this.textQueue.push(...replies);
    return this;
  }

  async generateStructured(request: StructuredRequest): Promise<string> {
    this.structuredRequests.push(request);
    const reply = this.structuredQueue.shift();
    if (reply === undefined) throw new Error("FakeLLMClient: no structured reply queued.");
    if (reply instanceof Error) throw reply;
    // Two fragments, to exercise the streaming path.
    const middle = Math.floor(reply.length / 2);
    request.onChunk?.(reply.slice(0, middle));
    request.onChunk?.(reply.slice(middle));
    return reply;
  }

  async generateText(request: TextRequest): Promise<string> {
    this.textRequests.push(request);
    const reply = this.textQueue.shift();
    if (reply === undefined) throw new Error("FakeLLMClient: no text reply queued.");
    if (reply instanceof Error) throw reply;
    return reply;
  }
}
