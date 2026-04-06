import { describe, it, expect, vi, beforeEach } from "vitest";
import { traceFile } from "./trace.js";

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn(), readdir: vi.fn() };
});

const mockGitRaw = vi.fn();
vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => ({ raw: mockGitRaw })),
}));

import { readFile, readdir } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

beforeEach(() => {
  vi.clearAllMocks();
  mockReaddir.mockRejectedValue(new Error("ENOENT"));
  mockGitRaw.mockRejectedValue(new Error("no history"));
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

const commitHash = "a".repeat(40);
const gitLogOutput = `${commitHash}\x1f2026-01-15\x1fFred\x1fAdd authentication\x1fadd-auth`;

describe("traceFile", () => {
  it("handles file with no git history", async () => {
    mockGitRaw.mockRejectedValue(new Error("no history"));

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    await traceFile("nonexistent.ts", { json: false });
    expect(logs.some((l) => l.includes("No git history"))).toBe(true);
  });

  it("outputs commits in json mode", async () => {
    mockGitRaw.mockResolvedValue(gitLogOutput);

    const result = await captureJson(() => traceFile("src/auth.ts", { json: true }));
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].hash).toBe(commitHash);
    expect(result.commits[0].date).toBe("2026-01-15");
    expect(result.commits[0].author).toBe("Fred");
    expect(result.commits[0].subject).toBe("Add authentication");
    expect(result.commits[0].changeId).toBe("add-auth");
  });

  it("links change IDs to archive entries", async () => {
    mockGitRaw.mockResolvedValue(gitLogOutput);

    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("archive")) return ["2026-01-15-add-auth"] as any;
      throw new Error("ENOENT");
    });

    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) {
        return "# Change: Add authentication\n\n## Why\nSecurity.\n" as any;
      }
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => traceFile("src/auth.ts", { json: true }));
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].changeId).toBe("add-auth");
    expect(result.changes[0].archived).toBe(true);
    expect(result.changes[0].summary).toBe("Add authentication");
  });

  it("parses file:line target format", async () => {
    mockGitRaw.mockResolvedValue(gitLogOutput);

    const result = await captureJson(() => traceFile("src/auth.ts:42", { json: true }));
    expect(result.file).toContain("auth.ts");
    expect(result.line).toBe(42);
  });

  it("deduplicates commits by hash", async () => {
    const dupeOutput = `${commitHash}\x1f2026-01-15\x1fFred\x1fAdd auth\x1f\n${commitHash}\x1f2026-01-15\x1fFred\x1fAdd auth\x1f`;
    mockGitRaw.mockResolvedValue(dupeOutput);

    const result = await captureJson(() => traceFile("src/auth.ts", { json: true }));
    expect(result.commits).toHaveLength(1);
  });
});
