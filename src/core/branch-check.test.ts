import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectNewFeatureIntent, suggestBranchName } from "./branch-check.js";

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return { ...actual, execFile: vi.fn() };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readdir: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
  };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn(async () => "/root"),
}));

vi.mock("../utils/fs.js", () => ({
  fileExists: vi.fn(),
}));

import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";

const mockExecFile = vi.mocked(execFile);
const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);
const mockFileExists = vi.mocked(fileExists);

function primeGit(branch: string, dirtyLines: string[]) {
  mockExecFile.mockImplementation(((...args: any[]) => {
    const cmd = args[0];
    const argv = Array.isArray(args[1]) ? args[1] : [];
    const callback = args[args.length - 1];
    if (typeof callback !== "function") return {} as any;
    if (cmd === "git" && argv[0] === "branch") {
      callback(null, { stdout: branch + "\n", stderr: "" });
    } else if (cmd === "git" && argv[0] === "status") {
      callback(null, { stdout: dirtyLines.join("\n"), stderr: "" });
    } else {
      callback(null, { stdout: "", stderr: "" });
    }
    return {} as any;
  }) as any);
}

function primeChanges(
  changes: Array<{ id: string; branch?: string; status?: string }>
) {
  mockFileExists.mockImplementation(async (path: string) => {
    if (path.includes("changes") && !path.endsWith("manifest.md")) return true;
    if (path.endsWith("manifest.md")) {
      const id = path.split("/").slice(-2, -1)[0];
      return changes.some((c) => c.id === id);
    }
    return true;
  });

  mockReaddir.mockImplementation((async () =>
    changes.map((c) => ({
      name: c.id,
      isDirectory: () => true,
      isFile: () => false,
      isSymbolicLink: () => false,
    }))) as any);

  mockReadFile.mockImplementation((async (path: any) => {
    const p = String(path);
    const id = p.split("/").slice(-2, -1)[0];
    const change = changes.find((c) => c.id === id);
    if (!change) throw new Error("ENOENT");
    const frontmatter = [
      "---",
      `status: ${change.status ?? "draft"}`,
      change.branch ? `branch: ${change.branch}` : "branch:",
      "---",
      "",
      "# manifest",
    ].join("\n");
    return frontmatter;
  }) as any);
}

describe("detectNewFeatureIntent", () => {
  it("matches explicit new-feature phrasing", () => {
    expect(detectNewFeatureIntent("let's add a new feature for CSV export")).toBe(true);
    expect(detectNewFeatureIntent("I want to add password reset")).toBe(true);
    expect(detectNewFeatureIntent("build a feature to rate-limit the API")).toBe(true);
    expect(detectNewFeatureIntent("draft a new capability for webhooks")).toBe(true);
    expect(detectNewFeatureIntent("implement a new feature")).toBe(true);
    expect(detectNewFeatureIntent("new feature request: multi-tenant support")).toBe(true);
  });

  it("matches informal phrasing", () => {
    expect(detectNewFeatureIntent("can we implement a new feature for search?")).toBe(true);
    expect(detectNewFeatureIntent("i'd like to build a feature that shows avatars")).toBe(true);
  });

  it("does NOT match bug reports", () => {
    expect(detectNewFeatureIntent("the login is broken")).toBe(false);
    expect(detectNewFeatureIntent("fix the null pointer in auth")).toBe(false);
  });

  it("does NOT match refactors", () => {
    expect(detectNewFeatureIntent("refactor the user service")).toBe(false);
    expect(detectNewFeatureIntent("clean up the router file")).toBe(false);
  });

  it("does NOT match hyphenated feature words", () => {
    expect(detectNewFeatureIntent("add feature-flagged code path")).toBe(false);
    expect(detectNewFeatureIntent("implement feature-gated rollout")).toBe(false);
    expect(detectNewFeatureIntent("build capability-based access control")).toBe(false);
  });

  it("does NOT match clarifying questions", () => {
    expect(detectNewFeatureIntent("what does this function do?")).toBe(false);
    expect(detectNewFeatureIntent("show me the schema for users")).toBe(false);
    expect(detectNewFeatureIntent("where is the login handler?")).toBe(false);
  });

  it("handles empty input", () => {
    expect(detectNewFeatureIntent("")).toBe(false);
    expect(detectNewFeatureIntent("   ")).toBe(false);
  });
});

describe("suggestBranchName", () => {
  it("produces feat/ slug", () => {
    expect(suggestBranchName("add password reset")).toBe("feat/password-reset");
  });

  it("drops filler words and contractions", () => {
    expect(suggestBranchName("let's add a new feature for CSV export")).toBe("feat/csv-export");
  });

  it("truncates to 40 chars", () => {
    const long = "add a feature that " + "supercalifragilistic ".repeat(5);
    const result = suggestBranchName(long);
    expect(result.length).toBeLessThanOrEqual(45); // feat/ + 40
  });

  it("falls back to new-feature when only stop words", () => {
    expect(suggestBranchName("i want to add a new")).toBe("feat/new-feature");
  });
});

describe("evaluateBranchCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not-triggered when prompt is not a new-feature request", async () => {
    const { evaluateBranchCheck } = await import("./branch-check.js");
    const result = await evaluateBranchCheck("what is in auth.ts?", "/root");
    expect(result.triggered).toBe(false);
  });

  it("triggers on dirty tree with new-feature prompt", async () => {
    primeGit("main", [" M src/foo.ts"]);
    primeChanges([]);
    const { evaluateBranchCheck } = await import("./branch-check.js");
    const result = await evaluateBranchCheck("add a new feature for webhooks", "/root");
    expect(result.triggered).toBe(true);
    expect(result.reason).toContain("uncommitted changes");
    expect(result.suggestion).toMatch(/^feat\//);
    expect(result.state?.dirty).toBe(true);
    expect(result.state?.protected).toBe(true);
  });

  it("triggers when current branch matches an active grimoire change", async () => {
    primeGit("feat/password-reset", []);
    primeChanges([
      { id: "2026-04-01-password-reset", branch: "feat/password-reset", status: "draft" },
    ]);
    const { evaluateBranchCheck } = await import("./branch-check.js");
    const result = await evaluateBranchCheck("let's add a new feature for billing", "/root");
    expect(result.triggered).toBe(true);
    expect(result.reason).toContain("tied to active grimoire change");
    expect(result.state?.activeChange?.id).toBe("2026-04-01-password-reset");
  });

  it("triggers on stale feature branch (non-protected, no matching change)", async () => {
    primeGit("feat/old-work", []);
    primeChanges([
      { id: "2026-03-01-other", branch: "feat/something-else", status: "draft" },
    ]);
    const { evaluateBranchCheck } = await import("./branch-check.js");
    const result = await evaluateBranchCheck("implement a new feature for search", "/root");
    expect(result.triggered).toBe(true);
    expect(result.reason).toContain("no active grimoire change matches it");
  });

  it("does not trigger on clean protected branch with no active changes", async () => {
    primeGit("main", []);
    primeChanges([]);
    const { evaluateBranchCheck } = await import("./branch-check.js");
    const result = await evaluateBranchCheck("add a new feature for CSV export", "/root");
    expect(result.triggered).toBe(false);
    expect(result.state?.protected).toBe(true);
    expect(result.state?.dirty).toBe(false);
  });

  it("does not trigger on clean protected branch even with other active changes", async () => {
    primeGit("main", []);
    primeChanges([
      { id: "2026-04-01-other", branch: "feat/other", status: "draft" },
    ]);
    const { evaluateBranchCheck } = await import("./branch-check.js");
    const result = await evaluateBranchCheck("build a new feature for audit logs", "/root");
    expect(result.triggered).toBe(false);
  });
});

describe("runBranchCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("emits JSON when --json + --prompt provided", async () => {
    primeGit("main", []);
    primeChanges([]);
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { runBranchCheck } = await import("./branch-check.js");
    const code = await runBranchCheck({
      hook: false,
      prompt: "what is the schema for users",
      json: true,
    });
    expect(code).toBe(0);
    const written = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(JSON.parse(written.trim())).toEqual({ triggered: false });
    writeSpy.mockRestore();
  });

  it("emits formatted warning on triggered new-feature prompt", async () => {
    primeGit("main", [" M src/foo.ts"]);
    primeChanges([]);
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { runBranchCheck } = await import("./branch-check.js");
    const code = await runBranchCheck({
      hook: false,
      prompt: "add a new feature for webhooks",
      json: false,
    });
    expect(code).toBe(0);
    const written = writeSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(written).toContain("[grimoire-branch-guard]");
    expect(written).toContain("git switch -c feat/");
    writeSpy.mockRestore();
  });

  it("silent on empty prompt in non-json mode", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { runBranchCheck } = await import("./branch-check.js");
    const code = await runBranchCheck({ hook: false, prompt: "   ", json: false });
    expect(code).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
