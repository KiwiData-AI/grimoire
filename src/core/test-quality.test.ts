import { describe, it, expect, vi } from "vitest";
import { analyzeTestQuality } from "./test-quality.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

import { readFile } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);

describe("analyzeTestQuality", () => {
  it("detects empty python test body", async () => {
    mockReadFile.mockResolvedValue(`
def test_something():
    pass

def test_another():
    assert 1 == 1
`);

    const report = await analyzeTestQuality(["/fake/test_app.py"]);

    expect(report.functions).toBe(2);
    const empty = report.issues.find((i) => i.rule === "empty-body");
    expect(empty).toBeDefined();
    expect(empty!.message).toContain("test_something");
  });

  it("detects missing assertions in python test", async () => {
    mockReadFile.mockResolvedValue(`
def test_no_assert():
    x = compute_value()
    print(x)
`);

    const report = await analyzeTestQuality(["/fake/test_app.py"]);

    const noAssert = report.issues.find((i) => i.rule === "no-assertion");
    expect(noAssert).toBeDefined();
    expect(noAssert!.severity).toBe("critical");
  });

  it("detects weak python assertions", async () => {
    mockReadFile.mockResolvedValue(`
def test_weak():
    result = get_user()
    assert True
`);

    const report = await analyzeTestQuality(["/fake/test_app.py"]);

    const weak = report.issues.find((i) => i.rule === "weak-assertion");
    expect(weak).toBeDefined();
    expect(weak!.message).toContain("always true");
  });

  it("detects tautological python assertion", async () => {
    mockReadFile.mockResolvedValue(`
def test_tautology():
    x = 42
    assert x == x
`);

    const report = await analyzeTestQuality(["/fake/test_app.py"]);

    const taut = report.issues.find((i) => i.rule === "tautological");
    expect(taut).toBeDefined();
  });

  it("detects empty JS test body", async () => {
    mockReadFile.mockResolvedValue(`
describe("app", () => {
  it("should work", () => {
  });

  it("actually tests", () => {
    expect(add(1, 2)).toBe(3);
  });
});
`);

    const report = await analyzeTestQuality(["/fake/app.test.ts"]);

    const empty = report.issues.find((i) => i.rule === "empty-body");
    expect(empty).toBeDefined();
    expect(empty!.message).toContain("should work");
  });

  it("detects missing assertions in JS test", async () => {
    mockReadFile.mockResolvedValue(`
describe("app", () => {
  it("does something", () => {
    const result = compute();
    console.log(result);
  });
});
`);

    const report = await analyzeTestQuality(["/fake/app.test.ts"]);

    const noAssert = report.issues.find((i) => i.rule === "no-assertion");
    expect(noAssert).toBeDefined();
  });

  it("detects weak JS assertions", async () => {
    mockReadFile.mockResolvedValue(`
describe("app", () => {
  it("checks defined", () => {
    expect(getUser()).toBeDefined();
  });
});
`);

    const report = await analyzeTestQuality(["/fake/app.test.ts"]);

    const weak = report.issues.find((i) => i.rule === "weak-assertion");
    expect(weak).toBeDefined();
    expect(weak!.message).toContain("toBeDefined");
  });

  it("reports clean test with no issues", async () => {
    mockReadFile.mockResolvedValue(`
def test_addition():
    assert add(1, 2) == 3
    assert add(0, 0) == 0
`);

    const report = await analyzeTestQuality(["/fake/test_math.py"]);

    expect(report.issues).toHaveLength(0);
    expect(report.summary.critical).toBe(0);
  });

  it("skips unsupported file extensions", async () => {
    mockReadFile.mockResolvedValue("fn test_rust() { assert!(true); }");

    const report = await analyzeTestQuality(["/fake/test_app.rs"]);

    expect(report.functions).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it("returns correct summary counts", async () => {
    mockReadFile.mockResolvedValue(`
def test_empty():
    pass

def test_weak():
    assert True

def test_no_assert():
    x = 1
    print(x)
`);

    const report = await analyzeTestQuality(["/fake/test_mixed.py"]);

    expect(report.summary.critical).toBeGreaterThanOrEqual(2); // empty + no-assertion
    expect(report.summary.warning).toBeGreaterThanOrEqual(1); // weak
  });
});
