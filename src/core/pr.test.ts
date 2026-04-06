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

  it("warns about incomplete tasks in pretty print mode", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return manifest as any;
      if (p.includes("tasks.md")) return "- [x] Done\n- [ ] Not done" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockResolvedValue([] as any);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generatePr({ changeId: "add-auth", create: false, review: false, json: false });

    const output = logs.join("\n");
    expect(output).toContain("PR Preview");
    expect(output).toContain("1 task(s) still incomplete");
  });

  it("generates body with empty why section", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change: Minimal\n" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockResolvedValue([] as any);

    const result = await captureJson(() =>
      generatePr({ changeId: "add-minimal", create: false, review: false, json: true })
    );

    expect(result.body).toContain("No summary provided");
  });

  it("includes decision titles in body", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return manifest as any;
      if (p.endsWith(".md") && p.includes("decisions")) return "# Use JWT for auth\n" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockImplementation(async (path: any, opts?: any) => {
      const p = String(path);
      if (p.includes("decisions")) {
        return [{ name: "0001-use-jwt.md", isFile: () => true, isDirectory: () => false, parentPath: `/fake/root/.grimoire/changes/add-auth/decisions` }] as any;
      }
      return [] as any;
    });

    const result = await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: false, json: true })
    );

    expect(result.body).toContain("Decisions");
    expect(result.body).toContain("Use JWT for auth");
    expect(result.body).toContain("ADR confirmation criteria met");
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

  it("includes Scenario Outline in scenarios", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return manifest as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockImplementation(async (path: any, opts?: any) => {
      const p = String(path);
      if (p.includes("features")) {
        return [{ name: "auth.feature", isFile: () => true, isDirectory: () => false, parentPath: `/fake/root/.grimoire/changes/add-auth/features` }] as any;
      }
      return [] as any;
    });
    const origImpl2 = mockReadFile.getMockImplementation()!;
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith(".feature")) return "Feature: Auth\n  Scenario Outline: Login with <role>\n    Given a <role> user\n" as any;
      return origImpl2(path);
    });

    const result = await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: false, json: true })
    );

    expect(result.body).toContain("Login with <role>");
  });

  it("detects single active change automatically", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change: Auto detected\n## Why\nTest.\n" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockImplementation(async (path: any, opts?: any) => {
      const p = String(path);
      if (p.includes("changes") && !p.includes("auto-change")) {
        return [{ name: "auto-change", isDirectory: () => true }] as any;
      }
      return [] as any;
    });

    const result = await captureJson(() =>
      generatePr({ create: false, review: false, json: true })
    );

    expect(result.changeId).toBe("auto-change");
  });

  it("counts complete and incomplete tasks correctly", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return manifest as any;
      if (p.includes("tasks.md")) return "- [x] Task A\n- [x] Task B\n- [ ] Task C\n- [ ] Task D\n- [ ] Task E" as any;
      throw new Error("ENOENT");
    });
    mockReaddir.mockResolvedValue([] as any);

    const result = await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: false, json: true })
    );

    expect(result.body).toContain("Tasks: 2/5 complete");
  });
});
