import { describe, it, expect } from "vitest";
import { buildCavemanDirective, buildCommentStyleDirective, SKILL_NAMES } from "./shared-setup.js";
import { pydoclintTool, applyDocStyleTool, buildMinimalConfig } from "./init-config.js";

describe("buildCavemanDirective", () => {
  it("returns empty string for none", () => {
    expect(buildCavemanDirective("none")).toBe("");
  });

  it("includes lite rules for lite level", () => {
    const result = buildCavemanDirective("lite");
    expect(result).toContain("## Caveman Mode");
    expect(result).toContain("**lite**");
    expect(result).toContain("Keep articles");
    expect(result).toContain("caveman:lite");
  });

  it("includes fragment rules for full level", () => {
    const result = buildCavemanDirective("full");
    expect(result).toContain("**full**");
    expect(result).toContain("Drop articles");
    expect(result).toContain("Fragments OK");
  });

  it("includes abbreviation rules for ultra level", () => {
    const result = buildCavemanDirective("ultra");
    expect(result).toContain("**ultra**");
    expect(result).toContain("Abbreviate");
    expect(result).toContain("arrows for causality");
  });

  it("includes auto-clarity exception for all active levels", () => {
    for (const level of ["lite", "full", "ultra"] as const) {
      const result = buildCavemanDirective(level);
      expect(result).toContain("security warnings");
      expect(result).toContain("irreversible");
    }
  });

  it("includes attribution comment", () => {
    const result = buildCavemanDirective("full");
    expect(result).toContain("github.com/JuliusBrussee/caveman");
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
