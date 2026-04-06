import { describe, it, expect, vi, beforeEach } from "vitest";
import { listChanges, listFeatures, listDecisions } from "./list.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn(), readdir: vi.fn() };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("../utils/fs.js", () => ({
  fileExists: vi.fn().mockResolvedValue(false),
}));

vi.mock("fast-glob", () => ({ default: vi.fn().mockResolvedValue([]) }));

import { readFile, readdir } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";
import fg from "fast-glob";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockFileExists = vi.mocked(fileExists);
const mockGlob = vi.mocked(fg);

beforeEach(() => {
  vi.clearAllMocks();
  mockGlob.mockResolvedValue([] as any);
  mockFileExists.mockResolvedValue(false);
});

function captureOutput(fn: () => Promise<void>): Promise<string[]> {
  const logs: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
    logs.push(args.join(" "));
  });
  return fn().then(() => {
    spy.mockRestore();
    return logs;
  });
}

describe("listChanges", () => {
  it("reports empty when no changes dir", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const logs = await captureOutput(() => listChanges(true));
    const parsed = JSON.parse(logs.join(""));
    expect(parsed.changes).toEqual([]);
  });

  it("reports no active changes when dir is empty", async () => {
    mockReaddir.mockResolvedValue([] as any);
    const logs = await captureOutput(() => listChanges(true));
    expect(logs.join("")).toBe("[]");
  });

  it("lists changes with manifest info in json mode", async () => {
    mockReaddir.mockImplementation(async (path: any, opts?: any) => {
      const p = String(path);
      if (p.includes("changes")) {
        return [{ name: "add-auth", isDirectory: () => true }] as any;
      }
      return [] as any;
    });
    mockFileExists.mockImplementation(async (path: string) => {
      return path.includes("manifest.md");
    });
    mockReadFile.mockResolvedValue("---\nstatus: implementing\nbranch: feat/auth\n---\n" as any);

    const logs = await captureOutput(() => listChanges(true));
    const parsed = JSON.parse(logs.join(""));
    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0].id).toBe("add-auth");
    expect(parsed.changes[0].status).toBe("implementing");
    expect(parsed.changes[0].branch).toBe("feat/auth");
  });

  it("detects conflicts when multiple changes touch same feature", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("changes")) {
        return [
          { name: "change-a", isDirectory: () => true },
          { name: "change-b", isDirectory: () => true },
        ] as any;
      }
      return [] as any;
    });
    mockFileExists.mockResolvedValue(false);
    mockGlob.mockResolvedValue(["features/shared.feature"] as any);

    const logs = await captureOutput(() => listChanges(true));
    const parsed = JSON.parse(logs.join(""));
    expect(parsed.conflicts).toHaveLength(1);
    expect(parsed.conflicts[0].file).toBe("features/shared.feature");
    expect(parsed.conflicts[0].changes).toContain("change-a");
    expect(parsed.conflicts[0].changes).toContain("change-b");
  });
});

describe("listFeatures", () => {
  it("lists feature files in json mode", async () => {
    mockGlob.mockResolvedValue(["features/auth.feature", "features/billing.feature"] as any);
    const logs = await captureOutput(() => listFeatures(true));
    const parsed = JSON.parse(logs.join(""));
    expect(parsed).toHaveLength(2);
  });

  it("reports empty when no features", async () => {
    mockGlob.mockResolvedValue([] as any);
    const logs = await captureOutput(() => listFeatures(true));
    expect(JSON.parse(logs.join(""))).toEqual([]);
  });
});

describe("listDecisions", () => {
  it("lists decision records in json mode", async () => {
    mockGlob.mockResolvedValue([".grimoire/decisions/0001-use-jwt.md"] as any);
    const logs = await captureOutput(() => listDecisions(true));
    const parsed = JSON.parse(logs.join(""));
    expect(parsed).toHaveLength(1);
  });
});
