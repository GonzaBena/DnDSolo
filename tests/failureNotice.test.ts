import { describe, expect, it } from "vitest";
import { describeFailure } from "../src/game/failureNotice";

describe("describeFailure", () => {
  it("suggests the settings page only for LLM failures", () => {
    expect(describeFailure({ kind: "llm", message: "x", cause: new Error("x") }).suggestSettings).toBe(true);
    expect(describeFailure({ kind: "aborted" }).suggestSettings).toBe(false);
    expect(describeFailure({ kind: "invalid_response", message: "x" }).suggestSettings).toBe(false);
    expect(describeFailure({ kind: "invalid_input", message: "x" }).suggestSettings).toBe(false);
  });
});
