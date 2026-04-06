import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateLog } from "./log.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn(), readdir: vi.fn() };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => ({ raw: vi.fn().mockResolvedValue("") })),
}));

import { readFile, readdir } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

beforeEach(() => {
  vi.clearAllMocks();
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

const manifestContent = `# Change: Add authentication

## Why
Security requirement.

## Feature Changes
**ADDED** \`auth/login.feature\`

## Decisions
**ADDED** \`0001-use-jwt.md\`

## Scenarios Added
- "User logs in with valid credentials"
- "User sees error with invalid credentials"

## End
`;

describe("generateLog", () => {
  it("throws when no archive exists", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    await expect(generateLog({ json: true })).rejects.toThrow("No archive found");
  });

  it("logs message for empty archive", async () => {
    mockReaddir.mockResolvedValue([] as any);
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    await generateLog({ json: false });
    expect(logs.some((l) => l.includes("No archived changes"))).toBe(true);
  });

  it("parses archive entry with full manifest", async () => {
    mockReaddir.mockResolvedValue([
      { name: "2026-01-15-add-auth", isDirectory: () => true, isFile: () => false },
    ] as any);
    mockReadFile.mockResolvedValue(manifestContent as any);

    const result = await captureJson(() => generateLog({ json: true }));
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-01-15");
    expect(result[0].changeId).toBe("add-auth");
    expect(result[0].summary).toBe("Add authentication");
    expect(result[0].features).toContain("auth/login.feature");
    expect(result[0].decisions).toContain("0001-use-jwt.md");
    expect(result[0].scenarios).toContain("User logs in with valid credentials");
  });

  it("sorts entries newest first", async () => {
    mockReaddir.mockResolvedValue([
      { name: "2026-01-15-add-auth", isDirectory: () => true, isFile: () => false },
      { name: "2026-03-20-fix-login", isDirectory: () => true, isFile: () => false },
    ] as any);
    mockReadFile.mockResolvedValue("# Change: Some change\n" as any);

    const result = await captureJson(() => generateLog({ json: true }));
    expect(result[0].date).toBe("2026-03-20");
    expect(result[1].date).toBe("2026-01-15");
  });

  it("filters by date range", async () => {
    mockReaddir.mockResolvedValue([
      { name: "2026-01-15-add-auth", isDirectory: () => true, isFile: () => false },
      { name: "2026-03-20-fix-login", isDirectory: () => true, isFile: () => false },
      { name: "2026-06-01-add-dashboard", isDirectory: () => true, isFile: () => false },
    ] as any);
    mockReadFile.mockResolvedValue("# Change: Something\n" as any);

    const result = await captureJson(() =>
      generateLog({ from: "2026-02-01", to: "2026-04-01", json: true })
    );
    expect(result).toHaveLength(1);
    expect(result[0].changeId).toBe("fix-login");
  });

  it("skips non-directory entries and malformed names", async () => {
    mockReaddir.mockResolvedValue([
      { name: "2026-01-15-valid", isDirectory: () => true, isFile: () => false },
      { name: "not-a-date", isDirectory: () => true, isFile: () => false },
      { name: "readme.md", isDirectory: () => false, isFile: () => true },
    ] as any);
    mockReadFile.mockResolvedValue("# Change: Valid\n" as any);

    const result = await captureJson(() => generateLog({ json: true }));
    expect(result).toHaveLength(1);
    expect(result[0].changeId).toBe("valid");
  });

  it("pretty prints with month headers and entry details", async () => {
    mockReaddir.mockResolvedValue([
      { name: "2026-03-15-add-auth", isDirectory: () => true, isFile: () => false },
    ] as any);
    mockReadFile.mockResolvedValue(manifestContent as any);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateLog({ json: false });

    const output = logs.join("\n");
    expect(output).toContain("Grimoire Change Log");
    expect(output).toContain("March 2026");
    expect(output).toContain("add-auth");
    expect(output).toContain("Add authentication");
    expect(output).toContain("Features:");
    expect(output).toContain("Decisions:");
    expect(output).toContain("Scenarios:");
    expect(output).toContain("1 change(s) total");
  });

  it("truncates scenarios when more than 3", async () => {
    const manyScenarios = `# Change: Big feature

## Why
Lots of work.

## Scenarios Added
- "Scenario one"
- "Scenario two"
- "Scenario three"
- "Scenario four"
- "Scenario five"

## End
`;
    mockReaddir.mockResolvedValue([
      { name: "2026-01-10-big-feature", isDirectory: () => true, isFile: () => false },
    ] as any);
    mockReadFile.mockResolvedValue(manyScenarios as any);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateLog({ json: false });

    const output = logs.join("\n");
    expect(output).toContain("+2 more");
  });

});
