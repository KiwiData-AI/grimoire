import { describe, it, expect } from "vitest";
import { buildLlmPrompt } from "./check-llm.js";

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

    const diffBody = result.match(/```diff\n(x+)\n```/)?.[1] ?? "";
    expect(diffBody.length).toBe(40_000);
  });

  it("instructs a PASS/FAIL verdict on the first line", () => {
    const result = buildLlmPrompt("Review", ["a.ts"], "diff");

    expect(result).toContain(
      "Respond with PASS or FAIL as the very first word on the very first line"
    );
  });
});
