import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChangeStatus } from "./status.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn(), readdir: vi.fn() };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

vi.mock("fast-glob", () => ({ default: vi.fn().mockResolvedValue([]) }));

import { readFile } from "node:fs/promises";
import fg from "fast-glob";

const mockReadFile = vi.mocked(readFile);
const mockGlob = vi.mocked(fg);

beforeEach(() => {
  vi.clearAllMocks();
  mockGlob.mockResolvedValue([]);
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

describe("getChangeStatus", () => {
  it("returns draft status when no manifest exists", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.status).toBe("draft");
    expect(result.stage).toBe("draft");
    expect(result.artifacts.manifest).toBe(false);
  });

  it("parses status and branch from manifest frontmatter", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) {
        return "---\nstatus: implementing\nbranch: feat/auth\n---\n# Change";
      }
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.status).toBe("implementing");
    expect(result.branch).toBe("feat/auth");
    expect(result.artifacts.manifest).toBe(true);
  });

  it("detects planned stage when tasks exist but none complete", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "---\nstatus: draft\n---\n";
      if (String(path).includes("tasks.md")) return "- [ ] Task one\n- [ ] Task two";
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.stage).toBe("planned");
    expect(result.artifacts.tasks.total).toBe(2);
    expect(result.artifacts.tasks.completed).toBe(0);
  });

  it("detects applying stage when some tasks complete", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "---\nstatus: draft\n---\n";
      if (String(path).includes("tasks.md")) return "- [x] Task one\n- [ ] Task two";
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.stage).toBe("applying");
  });

  it("detects complete stage when all tasks done", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "---\nstatus: draft\n---\n";
      if (String(path).includes("tasks.md")) return "- [x] Task one\n- [x] Task two";
      throw new Error("ENOENT");
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.stage).toBe("complete");
    expect(result.artifacts.tasks.completed).toBe(2);
  });

  it("includes features and decisions from glob", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "---\nstatus: draft\n---\n";
      throw new Error("ENOENT");
    });
    mockGlob.mockImplementation(async (pattern: any) => {
      if (String(pattern).includes(".feature")) return ["features/auth.feature"] as any;
      if (String(pattern).includes(".md")) return ["decisions/001.md"] as any;
      return [] as any;
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.artifacts.features).toEqual(["features/auth.feature"]);
    expect(result.artifacts.decisions).toEqual(["decisions/001.md"]);
  });
});
