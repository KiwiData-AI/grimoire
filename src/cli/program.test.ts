import { describe, expect, it } from "vitest";
import { buildProgram } from "./program.js";

describe("buildProgram", () => {
  it("registers the public commands without the retired diff command", () => {
    const commands = buildProgram().commands.map((command) => command.name());

    expect(commands).toEqual([
      "init",
      "update",
      "validate",
      "list",
      "status",
      "check",
      "trace",
      "docs",
      "health",
      "pr",
      "test-quality",
      "ci",
      "branch-check",
      "lint-comments",
      "configure",
    ]);
    expect(commands).not.toContain("diff");
  });

  it("describes validation of live specifications and optional active coordination", () => {
    const validate = buildProgram().commands.find((command) => command.name() === "validate");

    expect(validate?.description()).toBe("Validate live specifications and active coordination");
    expect(validate?.registeredArguments[0]?.description).toBe(
      "Active change manifest to validate in addition to live specifications"
    );
  });
});
