import { describe, it, expect } from "vitest";
import { buildCavemanDirective } from "./shared-setup.js";

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
