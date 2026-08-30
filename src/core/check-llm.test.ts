import { describe, it, expect } from "vitest";
import { buildLlmPrompt, getLlmArgs } from "./check-llm.js";

describe("buildLlmPrompt", () => {
  it("strips newlines, carriage returns, and backticks from filenames", () => {
    const result = buildLlmPrompt("Review", ["a\nb.ts", "c\rd.ts", "e`f.ts"], "");

    expect(result).toContain("`ab.ts`");
    expect(result).toContain("`cd.ts`");
    expect(result).toContain("`ef.ts`");
    expect(result).not.toMatch(/Files changed:[\s\S]*``/);
  });

  it("collapses runs of four or more backticks in the diff", () => {
    const result = buildLlmPrompt("Review", ["a.ts"], "before\n`````\nafter");

    expect(result).not.toContain("````");
    expect(result).toContain("before\n```\nafter");
  });

  it("truncates the diff at 40,000 characters", () => {
    const result = buildLlmPrompt("Review", ["a.ts"], "x".repeat(50_000));

    expect(result).toContain("... [diff truncated]");
    expect(result.length).toBeLessThan(41_000);
  });

  it("instructs a PASS/FAIL verdict on the first line", () => {
    const result = buildLlmPrompt("Review", ["a.ts"], "diff");

    expect(result).toContain(
      "Respond with PASS or FAIL as the very first word on the very first line"
    );
  });
});

describe("getLlmArgs", () => {
  it("uses Codex non-interactive stdin execution", () => {
    expect(getLlmArgs("codex")).toEqual(["exec", "-"]);
    expect(getLlmArgs("/usr/local/bin/codex")).toEqual(["exec", "-"]);
  });

  it("uses print mode for non-Codex commands", () => {
    expect(getLlmArgs("claude")).toEqual(["--print"]);
  });
});
