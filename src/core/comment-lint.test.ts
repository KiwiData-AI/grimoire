import { describe, it, expect } from "vitest";
import { lintComments, isSourceFile, addedLineNumbers } from "./comment-lint.js";

const rules = (text: string, file = "a.ts"): string[] =>
  lintComments(text, file).map((i) => i.rule);

describe("lintComments — multi-line comment runs", () => {
  it("does not flag a long line-comment run (verbosity is policy, not lint)", () => {
    const text = ["// first line of explanation", "// second line", "// third line", "const x = 1;"].join("\n");
    expect(rules(text)).toEqual([]);
  });

  it("does not treat a TS private field as a comment", () => {
    const text = ["#count = 0;", "#total = 0;", "#name = '';"].join("\n");
    expect(rules(text, "a.ts")).toEqual([]);
  });
});

describe("lintComments — external refs", () => {
  it("flags a comment naming a feature file", () => {
    expect(rules("// see login.feature for the spec")).toContain("external_ref");
  });

  it("flags a comment naming a decision id", () => {
    expect(rules("// per ADR-12 we retry")).toContain("external_ref");
  });
});

describe("lintComments — placeholder stubs", () => {
  it("flags a truncation marker comment", () => {
    expect(rules("// ... rest of code unchanged")).toContain("placeholder_stub");
  });

  it("flags a not-implemented comment", () => {
    expect(rules("// not implemented yet")).toContain("placeholder_stub");
  });

  it("flags an ellipsis-only comment", () => {
    expect(rules("// ...")).toContain("placeholder_stub");
  });

  it("does not flag a JS spread in real code", () => {
    expect(rules("  return { ...existing, total };")).toEqual([]);
    expect(rules("  const merged = { ...rest };")).toEqual([]);
  });

  it("does not flag a not-implemented thrower in real code", () => {
    expect(rules("    throw new Error('not implemented');")).toEqual([]);
    expect(rules("    raise NotImplementedError('abstract')", "a.py")).toEqual([]);
  });
});

describe("lintComments — override pragma", () => {
  it("suppresses an external ref on a pragma line", () => {
    expect(rules("// see login.feature grimoire-lint-ok")).not.toContain("external_ref");
  });
});

describe("lintComments — line numbers", () => {
  it("reports the exact line of an inline issue", () => {
    const text = ["const a = 1;", "const b = 2;", "// see login.feature"].join("\n");
    const ref = lintComments(text, "a.ts").find((i) => i.rule === "external_ref");
    expect(ref?.line).toBe(3);
  });
});

describe("addedLineNumbers", () => {
  it("marks every line of a new file as added", () => {
    expect(addedLineNumbers("", "a\nb\nc")).toEqual(new Set([1, 2, 3]));
  });
  it("excludes lines already present on disk", () => {
    expect(addedLineNumbers("a\nb\nc", "a\nb\nNEW\nc")).toEqual(new Set([3]));
  });
  it("treats a duplicate line as added when it exceeds the on-disk count", () => {
    expect(addedLineNumbers("x\n", "x\nx")).toEqual(new Set([2]));
  });
  it("ignores leading/trailing whitespace differences", () => {
    expect(addedLineNumbers("  a", "a")).toEqual(new Set());
  });
});

describe("isSourceFile", () => {
  it("accepts code files", () => {
    expect(isSourceFile("src/x.ts")).toBe(true);
    expect(isSourceFile("a.py")).toBe(true);
  });
  it("accepts uppercase extensions (case-insensitive filesystems)", () => {
    expect(isSourceFile("Component.TS")).toBe(true);
    expect(isSourceFile("main.PY")).toBe(true);
  });
  it("rejects docs and config", () => {
    expect(isSourceFile("README.md")).toBe(false);
    expect(isSourceFile(".grimoire/config.yaml")).toBe(false);
  });
});
