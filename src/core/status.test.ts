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

import { readFile } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

const missingFile = () => Object.assign(new Error("not found"), { code: "ENOENT" });

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
    mockReadFile.mockRejectedValue(missingFile());
    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.status).toBe("draft");
    expect(result.stage).toBe("draft");
    expect(result.artifacts.manifest).toBe(false);
  });

  it("does not report missing coordination when a file cannot be read", async () => {
    const failure = Object.assign(new Error("permission denied"), { code: "EACCES" });
    mockReadFile.mockRejectedValue(failure);

    await expect(getChangeStatus("test", { json: true })).rejects.toBe(failure);
  });

  it("parses status and branch from manifest frontmatter", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) {
        return "---\nstatus: implementing\nbranch: feat/auth\n---\n# Change";
      }
      throw missingFile();
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
      throw missingFile();
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
      throw missingFile();
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.stage).toBe("applying");
  });

  it("detects ready stage when all tasks are done", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "---\nstatus: draft\n---\n";
      if (String(path).includes("tasks.md")) return "- [x] Task one\n- [x] Task two";
      throw missingFile();
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.stage).toBe("ready");
    expect(result.artifacts.tasks.completed).toBe(2);
  });

  it("reports only manifest and task coordination artifacts", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "---\nstatus: draft\n---\n";
      throw missingFile();
    });
    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.artifacts).toEqual({ manifest: true, tasks: null });
    expect(result.artifacts).not.toHaveProperty("features");
    expect(result.artifacts).not.toHaveProperty("decisions");
  });

  it("pretty prints status with all details", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return "---\nstatus: implementing\nbranch: feat/auth\n---\n# Change";
      if (p.includes("tasks.md")) return "- [x] Task A\n- [ ] Task B\n- [ ] Task C";
      throw missingFile();
    });
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await getChangeStatus("test-change", { json: false });

    const output = logs.join("\n");
    expect(output).toContain("Change: test-change");
    expect(output).toContain("feat/auth");
    expect(output).toContain("Artifacts:");
    expect(output).toContain("1/3 complete");
    expect(output).toContain("Pending tasks:");
    expect(output).toContain("Task B");
    expect(output).toContain("Task C");
  });

  it("pretty prints draft stage with no tasks", async () => {
    mockReadFile.mockRejectedValue(missingFile());

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await getChangeStatus("empty-change", { json: false });

    const output = logs.join("\n");
    expect(output).toContain("Change: empty-change");
    expect(output).toContain("not yet planned");
    expect(output).toContain("missing");
  });

  it("lists pending tasks in JSON output", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("manifest.md")) return "---\nstatus: draft\n---\n";
      if (p.includes("tasks.md")) return "- [x] Done task\n- [ ] Pending one\n- [ ] Pending two";
      throw missingFile();
    });

    const result = await captureJson(() => getChangeStatus("test", { json: true }));
    expect(result.artifacts.tasks.pending).toEqual(["Pending one", "Pending two"]);
  });
});
