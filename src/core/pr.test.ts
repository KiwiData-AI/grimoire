import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePr } from "./pr.js";

const { mockExecFile, mockGitRaw, mockGitDiff, mockSpawnWithStdin, mockGetLlmArgs } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockGitRaw: vi.fn(),
  mockGitDiff: vi.fn(),
  mockSpawnWithStdin: vi.fn(),
  mockGetLlmArgs: vi.fn((command: string) =>
    /(^|[\\/])codex$/i.test(command) ? ["exec", "-"] : ["--print"]
  ),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn(), readdir: vi.fn() };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

vi.mock("../utils/config.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/config.js")>("../utils/config.js");
  return {
    ...actual,
    getLlmArgs: mockGetLlmArgs,
    loadConfig: vi.fn().mockResolvedValue({
      version: 1,
      project: { commit_style: "conventional" },
      features_dir: "features",
      decisions_dir: ".grimoire/decisions",
      tools: {},
      checks: [],
      llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
    }),
  };
});

vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
  spawn: vi.fn(),
}));

vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => ({ raw: mockGitRaw, diff: mockGitDiff })),
}));

vi.mock("../utils/spawn.js", () => ({
  spawnWithStdin: mockSpawnWithStdin,
}));

import { readFile, readdir } from "node:fs/promises";
import { loadConfig } from "../utils/config.js";
import { spawnWithStdin } from "../utils/spawn.js";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockLoadConfig = vi.mocked(loadConfig);
const mockedSpawnWithStdin = vi.mocked(spawnWithStdin);

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
  mockGitRaw.mockRejectedValue(new Error("no git history"));
  mockGitDiff.mockResolvedValue("");
  mockSpawnWithStdin.mockResolvedValue("PASS\nNo issues.");
  mockExecFile.mockImplementation(((_command: string, _args: string[], options: unknown, callback?: Function) => {
    const done = typeof options === "function" ? options : callback;
    if (!done) throw new Error("missing execFile callback");
    done(null, { stdout: "https://example.test/pull/1\n", stderr: "" });
  }) as any);
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
  it("generates finalized PR content from Git history and live artifacts", async () => {
    mockLoadConfig.mockResolvedValue({
      version: 1,
      project: { commit_style: "conventional" },
      features_dir: "specs",
      decisions_dir: "architecture/decisions",
      tools: {},
      checks: [],
      llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("specs/auth/login.feature")) {
        return "Feature: Login\n  Scenario: User signs in securely\n    Given valid credentials\n" as any;
      }
      if (p.endsWith("architecture/decisions/0007-use-sessions.md")) {
        return "# Use server-side sessions\n" as any;
      }
      if (p.endsWith("specs/billing/invoice.feature")) {
        return "Feature: Billing\n  Scenario: User pays an invoice\n" as any;
      }
      if (p.endsWith("architecture/decisions/0008-use-invoices.md")) {
        return "# Use invoices\n" as any;
      }
      throw new Error("ENOENT");
    });
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    mockGitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === "symbolic-ref") throw new Error("no origin HEAD");
      if (args[0] === "log") {
        return `a\x1ffeat(auth): add login flow\x1fEnable users to sign in securely.\n\nChange: add-login\x1e` +
          `b\x1ffix: unrelated work\x1fOther change.\n\nChange: other-change\x1e`;
      }
      if (args[0] === "show" && args.at(-1) === "a") {
        return "specs/auth/login.feature\narchitecture/decisions/0007-use-sessions.md\n";
      }
      if (args[0] === "show" && args.at(-1) === "b") {
        return "specs/billing/invoice.feature\narchitecture/decisions/0008-use-invoices.md\n";
      }
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    });
    mockGitDiff.mockImplementation(async (args: string[]) =>
      args.includes("--name-only")
        ? "specs/auth/login.feature\narchitecture/decisions/0007-use-sessions.md\nspecs/billing/invoice.feature\narchitecture/decisions/0008-use-invoices.md\nsrc/auth.ts\n"
        : ""
    );

    const result = await captureJson(() =>
      generatePr({ changeId: "add-login", create: false, review: false, json: true })
    );

    expect(result.title).toBe("feat(auth): add login flow");
    expect(result.body).toContain("Enable users to sign in securely.");
    expect(result.body).toContain("- feat(auth): add login flow");
    expect(result.body).toContain("unrelated work");
    expect(result.body).toContain('"User signs in securely"');
    expect(result.body).toContain("Use server-side sessions");
    expect(result.body).toContain("User pays an invoice");
    expect(result.body).toContain("Use invoices");
    expect(result.body).not.toContain("Tasks:");
    expect(result.changeId).toBe("add-login");
    expect(mockGitDiff).toHaveBeenCalledWith(["--name-only", "main...HEAD"]);
    expect(mockGitRaw).toHaveBeenCalledWith(["show", "--format=", "--name-only", "a"]);
    expect(mockGitRaw).toHaveBeenCalledWith(["show", "--format=", "--name-only", "b"]);
  });

  it("requires an explicit change ID when branch trailers are ambiguous", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    mockGitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === "symbolic-ref") throw new Error("no origin HEAD");
      return `a\x1ffeat: first\x1fFirst.\n\nChange: first-change\x1e` +
        `b\x1ffeat: second\x1fSecond.\n\nChange: second-change\x1e`;
    });

    await expect(
      generatePr({ create: false, review: false, json: true })
    ).rejects.toThrow("Multiple changes found in branch history. Specify one");
  });

  it("uses one explicit non-main base for discovery, paths, review, and creation", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).endsWith("features/login.feature")) {
        return "Feature: Login\n  Scenario: User signs in\n" as any;
      }
      throw new Error("ENOENT");
    });
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    mockGitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === "symbolic-ref") throw new Error("explicit base should bypass resolution");
      if (args[0] === "log") {
        return "abc\x1ffeat(auth): add login\x1fAdd login.\n\nChange: add-login\x1e";
      }
      if (args[0] === "show") return "features/login.feature\n";
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    });
    mockGitDiff.mockImplementation(async (args: string[]) =>
      args.includes("--name-only")
        ? "features/login.feature\n"
        : "diff --git a/features/login.feature b/features/login.feature"
    );
    vi.spyOn(console, "log").mockImplementation(() => {});

    await generatePr({
      changeId: "add-login",
      base: "release",
      create: true,
      review: true,
      json: false,
    });

    expect(mockGitRaw).toHaveBeenCalledWith(expect.arrayContaining(["release..HEAD"]));
    expect(mockGitDiff).toHaveBeenCalledWith(["--name-only", "release...HEAD"]);
    expect(mockGitDiff).toHaveBeenCalledWith(["release...HEAD"]);
    expect(mockExecFile).toHaveBeenCalledWith(
      "gh",
      expect.arrayContaining(["--base", "release"]),
      expect.objectContaining({ cwd: "/fake/root" }),
      expect.any(Function)
    );
    expect(mockGitRaw).not.toHaveBeenCalledWith(expect.arrayContaining(["symbolic-ref"]));
  });

  it("uses the repository default branch when no base is explicit", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    mockGitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === "symbolic-ref") return "origin/trunk\n";
      if (args[0] === "log") {
        return "abc\x1ffeat: add login\x1fAdd login.\n\nChange: add-login\x1e";
      }
      if (args[0] === "show") return "";
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    });

    await captureJson(() =>
      generatePr({ changeId: "add-login", create: false, review: false, json: true })
    );

    expect(mockGitRaw).toHaveBeenCalledWith(expect.arrayContaining(["trunk..HEAD"]));
    expect(mockGitDiff).toHaveBeenCalledWith(["--name-only", "trunk...HEAD"]);
  });

  it("uses the last matching production commit for the title and summarizes every selected commit", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    mockGitRaw.mockImplementation(async (args: string[]) => {
      if (args[0] === "symbolic-ref") throw new Error("no origin HEAD");
      if (args[0] === "log") {
        return `a\x1ftest(auth): pin login behavior\x1fCapture the expected login flow.\n\nChange: add-login\x1e` +
          `b\x1ffeat(auth): add login flow\x1fImplement the login flow.\n\nChange: add-login\nChange: auth-platform\x1e` +
          `c\x1ffix(auth): reject expired sessions\x1fReject expired sessions safely.\n\nChange: add-login\x1e`;
      }
      if (args[0] === "show") return "src/auth.ts\n";
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    });
    mockGitDiff.mockResolvedValue("src/auth.ts\n");

    const result = await captureJson(() =>
      generatePr({ changeId: "add-login", create: false, review: false, json: true })
    );

    expect(result.title).toBe("fix(auth): reject expired sessions");
    expect(result.body).toContain("Capture the expected login flow.");
    expect(result.body).toContain("Implement the login flow.");
    expect(result.body).toContain("Reject expired sessions safely.");
    expect(result.body).not.toContain("Final-production-review:");
  });

  it("uses the shared Codex adapter for PR review executable paths", async () => {
    mockLoadConfig.mockResolvedValue({
      version: 1,
      project: { commit_style: "conventional" },
      features_dir: "features",
      decisions_dir: ".grimoire/decisions",
      tools: {},
      checks: [],
      llm: {
        thinking: { command: "/opt/codex/bin/codex" },
        coding: { command: "/opt/codex/bin/codex" },
      },
    });
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return manifest as any;
      throw new Error("ENOENT");
    });
    mockGitDiff.mockImplementation(async (args: string[]) =>
      args.includes("--name-only") ? "" : "diff --git a/src/auth.ts b/src/auth.ts"
    );

    await captureJson(() =>
      generatePr({ changeId: "add-auth", create: false, review: true, json: true })
    );

    expect(mockGetLlmArgs).toHaveBeenCalledOnce();
    expect(mockGetLlmArgs).toHaveBeenCalledWith("/opt/codex/bin/codex");
    expect(mockedSpawnWithStdin).toHaveBeenCalledWith(
      "/opt/codex/bin/codex",
      ["exec", "-"],
      expect.any(String),
      "/fake/root"
    );
  });

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
