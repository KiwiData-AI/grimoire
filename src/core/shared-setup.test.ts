import { describe, it, expect } from "vitest";
import { buildSteDirective, buildCommentStyleDirective, SKILL_NAMES } from "./shared-setup.js";
import { pydoclintTool, applyDocStyleTool, buildMinimalConfig } from "./init-config.js";

describe("buildSteDirective", () => {
  it("returns empty string for off", () => {
    expect(buildSteDirective("off")).toBe("");
  });

  it("includes STE grammar rules for ste level", () => {
    const result = buildSteDirective("ste");
    expect(result).toContain("## Response Style (STE)");
    expect(result).toContain("keep articles");
    expect(result).toContain("rhetorical scaffolding");
    expect(result).toContain("ste:ste");
  });

  it("includes fragment rules for caveman level", () => {
    const result = buildSteDirective("caveman");
    expect(result).toContain("Drop articles");
    expect(result).toContain("Fragments OK");
    expect(result).toContain("ste:caveman");
  });

  it("includes auto-clarity exception for all active levels", () => {
    for (const level of ["ste", "caveman"] as const) {
      const result = buildSteDirective(level);
      expect(result).toContain("security warnings");
      expect(result).toContain("irreversible");
    }
  });
});

describe("buildCommentStyleDirective", () => {
  it("returns empty string when no style configured", () => {
    expect(buildCommentStyleDirective(undefined)).toBe("");
    expect(buildCommentStyleDirective("")).toBe("");
  });

  it("names the style and its format for sphinx", () => {
    const result = buildCommentStyleDirective("sphinx");
    expect(result).toContain("## Project Comment Style");
    expect(result).toContain("**sphinx**");
    expect(result).toContain(":param x:");
  });

  it("still names an unknown style without a format hint", () => {
    const result = buildCommentStyleDirective("pep257");
    expect(result).toContain("**pep257**");
  });
});

describe("pydoclintTool", () => {
  it("returns the tool for python with a supported style", () => {
    expect(pydoclintTool("python", "sphinx")).toEqual({
      name: "pydoclint",
      check_command: "pydoclint --style=sphinx .",
    });
  });

  it("returns null for non-python languages", () => {
    expect(pydoclintTool("typescript", "sphinx")).toBeNull();
  });

  it("returns null for styles pydoclint does not support", () => {
    expect(pydoclintTool("python", "pep257")).toBeNull();
    expect(pydoclintTool("python", undefined)).toBeNull();
  });
});

describe("applyDocStyleTool", () => {
  it("sets the pydoclint tool for a python project", () => {
    const config = buildMinimalConfig();
    config.project.language = "python";
    config.project.comment_style = "google";
    applyDocStyleTool(config);
    expect(config.tools.doc_style?.name).toBe("pydoclint");
    expect(config.tools.doc_style?.check_command).toBe("pydoclint --style=google .");
  });

  it("does not overwrite an existing doc_style tool", () => {
    const config = buildMinimalConfig();
    config.project.language = "python";
    config.project.comment_style = "google";
    config.tools.doc_style = { name: "custom", check_command: "my-linter" };
    applyDocStyleTool(config);
    expect(config.tools.doc_style.name).toBe("custom");
  });
});

describe("SKILL_NAMES", () => {
  it("includes grimoire-design and grimoire-design-consult", () => {
    expect(SKILL_NAMES).toContain("grimoire-design");
    expect(SKILL_NAMES).toContain("grimoire-design-consult");
  });

  it("places grimoire-design and grimoire-design-consult adjacently after grimoire-commit", () => {
    const commitIndex = SKILL_NAMES.indexOf("grimoire-commit");
    const designIndex = SKILL_NAMES.indexOf("grimoire-design");
    const consultIndex = SKILL_NAMES.indexOf("grimoire-design-consult");
    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(designIndex).toBe(commitIndex + 1);
    expect(consultIndex).toBe(designIndex + 1);
  });
});
