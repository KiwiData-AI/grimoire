import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePr } from "./pr.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn(), readdir: vi.fn() };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

vi.mock("../utils/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    version: 1,
    project: { commit_style: "conventional" },
    features_dir: "features",
    decisions_dir: ".grimoire/decisions",
    tools: {},
    checks: [],
    llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
  }),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

import { readFile, readdir } from "node:fs/promises";
import { loadConfig } from "../utils/config.js";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockLoadConfig = vi.mocked(loadConfig);

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadConfig.mockResolvedValue({
    version: 1,
    project: { commit_style: "conventional" },
    features_dir: "features",
    decisions_dir: ".grimoire/decisions",
    tools: {},
    checks: [],
    llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
  });
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

const manifest = `---
status: implementing
---
# Change: Add user authentication

## Why
Security requirement from compliance team.

## Feature Changes
**ADDED** \`auth/login.feature\`
`;

describe("generatePr", () => {
  it("generates PR title and body from manifest", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return manifest as any;
      if (p.includes("tasks.md")) return "- [x] Create spec\n- [x] Implement" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockImplementation(async (path: any, opts?: any) => {
      const p = String(path);
      if (p.includes("changes") && !p.includes("add-auth")) {
        return [{ name: "add-auth", isDirectory: () => true }] as any;
      }
      return [] as any;
    });

    const result = await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: false, json: true })
    );

    expect(result.title).toContain("feat:");
    expect(result.title).toContain("add user authentication");
    expect(result.body).toContain("Security requirement");
    expect(result.changeId).toBe("add-auth");
  });

  it("uses fix type for fix- prefix change IDs", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change: Fix login bug\n## Why\nBroken.\n" as any;
      throw new Error("ENOENT");
    });

    const result = await captureJson(() =>
      generatePr({ changeId: "fix-login", create: false, review: false, json: true })
    );

    expect(result.title).toContain("fix:");
  });

  it("uses angular style with scope when configured", async () => {
    mockLoadConfig.mockResolvedValue({
      version: 1,
      project: { commit_style: "angular" },
      features_dir: "features",
      decisions_dir: ".grimoire/decisions",
      tools: {},
      checks: [],
      llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
    });
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change: Add auth flow\n## Why\nNeeded.\n" as any;
      throw new Error("ENOENT");
    });

    const result = await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: false, json: true })
    );

    expect(result.title).toMatch(/^feat\(auth\):/);
  });

  it("throws when no active change found", async () => {
    mockReaddir.mockResolvedValue([] as any);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      generatePr({ create: false, review: false, json: true })
    ).rejects.toThrow("No active change");
  });

  it("includes scenarios from feature files", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return manifest as any;
      if (p.includes("tasks.md")) return "- [x] Done" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockImplementation(async (path: any, opts?: any) => {
      const p = String(path);
      if (p.includes("features")) {
        return [{ name: "login.feature", isFile: () => true, isDirectory: () => false, parentPath: `/fake/root/.grimoire/changes/add-auth/features` }] as any;
      }
      if (p.includes("decisions")) throw new Error("ENOENT");
      return [] as any;
    });
    // Override readFile for feature file
    const origImpl = mockReadFile.getMockImplementation()!;
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith(".feature")) return "Feature: Login\n  Scenario: User logs in\n    Given credentials\n" as any;
      return origImpl(path);
    });

    const result = await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: false, json: true })
    );

    expect(result.body).toContain("User logs in");
  });
});
