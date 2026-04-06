import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHealth } from "./health.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  safePath: vi.fn((_root: string, p: string) => `/fake/root/${p}`),
}));

vi.mock("../utils/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    version: 1,
    project: {},
    features_dir: "features",
    decisions_dir: ".grimoire/decisions",
    tools: {},
    checks: [],
    llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
  }),
}));

vi.mock("../utils/fs.js", () => ({
  readFileOrNull: vi.fn().mockResolvedValue(null),
  findFiles: vi.fn().mockResolvedValue([]),
  escapeRegex: vi.fn((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  const fn = vi.fn();
  const asyncFn = vi.fn(async () => ({ stdout: "", stderr: "" }));
  (fn as any)[promisify.custom] = asyncFn;
  return { execFile: fn, spawn: vi.fn() };
});

import { readFile, readdir, writeFile } from "node:fs/promises";
import { readFileOrNull, findFiles } from "../utils/fs.js";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockWriteFile = vi.mocked(writeFile);
const mockReadFileOrNull = vi.mocked(readFileOrNull);
const mockFindFiles = vi.mocked(findFiles);

beforeEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockRejectedValue(new Error("ENOENT"));
  mockReaddir.mockRejectedValue(new Error("ENOENT"));
  mockReadFileOrNull.mockResolvedValue(null);
  mockFindFiles.mockResolvedValue([]);
});

function captureJson(fn: () => Promise<void>): Promise<any> {
  const logs: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
    logs.push(args.join(" "));
  });
  return fn().then(() => {
    spy.mockRestore();
    return JSON.parse(logs.join(""));
  });
}

describe("runHealth", () => {
  it("returns metrics array with overall score", async () => {
    const result = await captureJson(() => runHealth({ json: true }));
    expect(result.metrics).toBeDefined();
    expect(Array.isArray(result.metrics)).toBe(true);
    expect(typeof result.overall).toBe("number");
  });

  it("features metric counts scenarios", async () => {
    mockFindFiles.mockImplementation(async (dir: string) => {
      if (dir.includes("features")) return ["/fake/root/features/auth.feature"];
      return [];
    });
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.includes(".feature")) {
        return `Feature: Auth
  Scenario: Login
    Given credentials
  Scenario: Logout
    Given session`;
      }
      return null;
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const features = result.metrics.find((m: any) => m.name === "features");
    expect(features).toBeDefined();
    expect(features.label).toContain("2 scenarios");
    expect(features.score).toBe(100);
  });

  it("decisions metric counts current vs total", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("decisions")) {
        return ["0001-use-jwt.md", "0002-use-pg.md"] as any;
      }
      throw new Error("ENOENT");
    });
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.includes("0001")) {
        return "---\nstatus: accepted\n---\n# Use JWT";
      }
      if (path.includes("0002")) {
        return "---\nstatus: superseded\n---\n# Use PG";
      }
      return null;
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const decisions = result.metrics.find((m: any) => m.name === "decisions");
    expect(decisions).toBeDefined();
    expect(decisions.label).toContain("/2");
  });

  it("unit coverage returns null score when no coverage data", async () => {
    const result = await captureJson(() => runHealth({ json: true }));
    const unitCov = result.metrics.find((m: any) => m.name === "unit_coverage");
    expect(unitCov).toBeDefined();
    expect(unitCov.score).toBeNull();
  });

  it("area_docs metric reports no docs when index missing", async () => {
    const result = await captureJson(() => runHealth({ json: true }));
    const areaDocs = result.metrics.find((m: any) => m.name === "area_docs");
    expect(areaDocs).toBeDefined();
    expect(areaDocs.score).toBe(0);
  });

  it("data_schema returns null score when no schema", async () => {
    const result = await captureJson(() => runHealth({ json: true }));
    const schema = result.metrics.find((m: any) => m.name === "data_schema");
    expect(schema).toBeDefined();
    expect(schema.score).toBeNull();
  });

  it("writes badges when badges option provided", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT")); // badge file doesn't exist
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runHealth({ json: false, badges: "README.md" });

    expect(mockWriteFile).toHaveBeenCalled();
    const writePath = String(mockWriteFile.mock.calls[0][0]);
    expect(writePath).toContain("README.md");
    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("GRIMOIRE:HEALTH:START");
  });

  it("pretty prints health report in non-json mode", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await runHealth({ json: false });

    expect(logs.some((l) => l.includes("grimoire health"))).toBe(true);
    expect(logs.some((l) => l.includes("Overall"))).toBe(true);
  });

  it("reads unit coverage from jest/vitest summary JSON", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("coverage-summary.json")) {
        return JSON.stringify({ total: { lines: { pct: 85.5 } } }) as any;
      }
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const unitCov = result.metrics.find((m: any) => m.name === "unit_coverage");
    expect(unitCov).toBeDefined();
    expect(unitCov.score).toBe(86); // rounded
    expect(unitCov.label).toContain("86% line coverage");
  });

  it("reads unit coverage from pytest-cov format", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("status.json")) {
        return JSON.stringify({ totals: { percent_covered: 72.3 } }) as any;
      }
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const unitCov = result.metrics.find((m: any) => m.name === "unit_coverage");
    expect(unitCov.score).toBe(72);
  });

  it("data_schema reports model count when schema exists", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("schema.yml")) {
        return "User:\n  fields:\n    - name\nOrder:\n  fields:\n    - id\n" as any;
      }
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const schema = result.metrics.find((m: any) => m.name === "data_schema");
    expect(schema.score).toBe(100);
    expect(schema.label).toContain("2 models");
  });

  it("area_docs reports documented count from index.yml", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("index.yml")) {
        return "areas:\n  - directory: src\n  - directory: lib\n" as any;
      }
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const areaDocs = result.metrics.find((m: any) => m.name === "area_docs");
    expect(areaDocs.score).toBe(100);
    expect(areaDocs.label).toContain("2/2");
  });

  it("updates badges in existing file with markers", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("README.md")) {
        return "# My Project\n<!-- GRIMOIRE:HEALTH:START -->\nold badges\n<!-- GRIMOIRE:HEALTH:END -->\nMore content" as any;
      }
      throw new Error("ENOENT");
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runHealth({ json: false, badges: "README.md" });

    const writeCall = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("README.md")
    );
    expect(writeCall).toBeDefined();
    const content = String(writeCall![1]);
    expect(content).toContain("GRIMOIRE:HEALTH:START");
    expect(content).toContain("More content");
    expect(content).not.toContain("old badges");
  });

  it("prepends badges to file without markers", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("README.md")) {
        return "# My Project\nSome content\n" as any;
      }
      throw new Error("ENOENT");
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await runHealth({ json: false, badges: "README.md" });

    const writeCall = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("README.md")
    );
    expect(writeCall).toBeDefined();
    const content = String(writeCall![1]);
    expect(content).toContain("GRIMOIRE:HEALTH:START");
    expect(content).toContain("# My Project");
    // Badges should come before original content
    const badgeIdx = content.indexOf("GRIMOIRE:HEALTH:START");
    const contentIdx = content.indexOf("# My Project");
    expect(badgeIdx).toBeLessThan(contentIdx);
  });

  it("test_coverage reports step definition matches", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("features/steps")) return ["login_steps.py"] as any;
      throw new Error("ENOENT");
    });
    mockFindFiles.mockImplementation(async (dir: string) => {
      if (dir.includes("features") && !dir.includes("steps")) return ["/fake/root/features/login.feature"];
      if (dir.includes("steps")) return ["/fake/root/features/steps/login_steps.py"];
      return [];
    });
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.includes(".feature")) {
        return `Feature: Login
  Scenario: User authenticates
    Given valid credentials
    When user submits login form
    Then user sees dashboard`;
      }
      if (path.includes("login_steps")) {
        return `@given("valid credentials")\ndef step_credentials():\n    pass\n@when("user submits login form")\ndef step_submit():\n    pass`;
      }
      return null;
    });

    const result = await captureJson(() => runHealth({ json: true }));
    const testCov = result.metrics.find((m: any) => m.name === "test_coverage");
    expect(testCov).toBeDefined();
    expect(testCov.score).toBeGreaterThan(0);
  });
});
