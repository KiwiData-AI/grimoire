import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMap } from "./map.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  const fn = vi.fn();
  const asyncFn = vi.fn(async () => ({ stdout: "", stderr: "" }));
  (fn as any)[promisify.custom] = asyncFn;
  return { execFile: fn, spawn: vi.fn() };
});

import { readFile, readdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockWriteFile = vi.mocked(writeFile);
const mockExecFileAsync = (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});

  // Default mapignore, mapkeys, and dupignore templates
  mockReadFile.mockImplementation(async (path: any) => {
    const p = String(path);
    if (p.includes("mapignore")) return "node_modules\ndist\n.git\n" as any;
    if (p.includes("mapkeys")) return "package.json = manifest\nREADME.md = docs\n" as any;
    if (p.includes("dupignore")) return "" as any;
    if (p.includes("index.yml")) throw new Error("ENOENT");
    throw new Error("ENOENT");
  });
});

function makeDirEntries(names: string[], type: "file" | "dir" = "file") {
  return names.map((name) => ({
    name,
    isFile: () => type === "file",
    isDirectory: () => type === "dir",
  }));
}

describe("generateMap", () => {
  it("outputs JSON with directory structure", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/root") {
        return [
          ...makeDirEntries(["src"], "dir"),
          ...makeDirEntries(["package.json", "README.md"]),
        ] as any;
      }
      if (p.includes("src")) {
        return [
          ...makeDirEntries(["index.ts", "utils.ts"]),
        ] as any;
      }
      return [] as any;
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    expect(output.directories).toBeDefined();
    expect(output.directories.length).toBeGreaterThan(0);
    expect(output.keyFiles).toBeDefined();
  });

  it("detects key files from mapkeys config", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/root") {
        return [
          ...makeDirEntries(["package.json", "README.md"]),
        ] as any;
      }
      return [] as any;
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    expect(output.keyFiles.length).toBe(2);
    expect(output.keyFiles.some((kf: any) => kf.path === "package.json")).toBe(true);
    expect(output.keyFiles.some((kf: any) => kf.type === "manifest")).toBe(true);
  });

  it("ignores directories listed in mapignore", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/root") {
        return [
          ...makeDirEntries(["src", "node_modules", "dist"], "dir"),
          ...makeDirEntries(["index.ts"]),
        ] as any;
      }
      if (p.includes("src")) return makeDirEntries(["app.ts"]) as any;
      if (p.includes("node_modules")) return makeDirEntries(["lodash"], "dir") as any;
      return [] as any;
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    const dirPaths = output.directories.map((d: any) => d.path);
    expect(dirPaths).not.toContain("node_modules");
    expect(dirPaths).not.toContain("dist");
    expect(dirPaths).toContain("src");
  });

  it("skips hidden directories except .grimoire", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/root") {
        return [
          ...makeDirEntries(["src", ".grimoire", ".git", ".vscode"], "dir"),
        ] as any;
      }
      if (p.includes(".grimoire")) return makeDirEntries(["config.yaml"]) as any;
      if (p.includes("src")) return makeDirEntries(["app.ts"]) as any;
      return [] as any;
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    const dirPaths = output.directories.map((d: any) => d.path);
    expect(dirPaths).toContain(".grimoire");
    expect(dirPaths).not.toContain(".git");
    expect(dirPaths).not.toContain(".vscode");
  });

  it("counts file extensions per directory", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/root") {
        return [
          ...makeDirEntries(["src"], "dir"),
          ...makeDirEntries(["readme.md"]),
        ] as any;
      }
      if (p.includes("src")) {
        return makeDirEntries(["a.ts", "b.ts", "c.js"]) as any;
      }
      return [] as any;
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    const srcDir = output.directories.find((d: any) => d.path === "src");
    expect(srcDir).toBeDefined();
    expect(srcDir.extensions[".ts"]).toBe(2);
    expect(srcDir.extensions[".js"]).toBe(1);
  });

  it("refresh mode detects undocumented areas", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p === "/fake/root") {
        return [
          ...makeDirEntries(["src", "lib"], "dir"),
          ...makeDirEntries(["index.ts"]),
        ] as any;
      }
      if (p.includes("src")) return makeDirEntries(["app.ts"]) as any;
      if (p.includes("lib")) return makeDirEntries(["util.ts"]) as any;
      return [] as any;
    });

    // index.yml only documents "src"
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("mapignore")) return "" as any;
      if (p.includes("mapkeys")) return "" as any;
      if (p.includes("dupignore")) return "" as any;
      if (p.includes("index.yml")) return "areas:\n  - directory: src\n" as any;
      throw new Error("ENOENT");
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: true,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    expect(output.undocumented).toContain("lib");
  });

  it("snapshot has no symbols field", async () => {
    mockReaddir.mockImplementation(async () => [] as any);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const output = JSON.parse(logs.join(""));
    expect(output.symbols).toBeUndefined();
    expect(output.directories).toBeDefined();
    expect(output.keyFiles).toBeDefined();
  });

  it("pretty prints directory tree in non-json mode", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path) === "/fake/root") {
        return [...makeDirEntries(["src"], "dir"), ...makeDirEntries(["app.ts"])] as any;
      }
      if (String(path).includes("src")) return makeDirEntries(["index.ts"]) as any;
      return [] as any;
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: false,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    expect(logs.some((l) => l.includes("Project Map"))).toBe(true);
    expect(logs.some((l) => l.includes("src/"))).toBe(true);
  });

  it("passes dupignore globs to jscpd --ignore (not mapignore)", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("mapignore")) return "some_structure_dir\n" as any;
      if (p.includes("dupignore"))
        return "**/node_modules/**\n**/*_pb2.py\n**/generated/**\n# comment\n" as any;
      if (p.includes("mapkeys")) return "" as any;
      if (p.includes("jscpd-report.json"))
        return JSON.stringify({ duplicates: [], statistics: { total: { lines: 100, duplicatedLines: 0 } } }) as any;
      if (p.includes("index.yml")) throw new Error("ENOENT");
      throw new Error("ENOENT");
    });

    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path) === "/fake/root") return makeDirEntries(["app.ts"]) as any;
      return [] as any;
    });

    await generateMap({
      json: false,
      refresh: false,
      maxDepth: 3,
      duplicates: true,
    });

    const jscpdRun = mockExecFileAsync.mock.calls.find((c: any) => {
      const args = c[1] as string[];
      return Array.isArray(args) && args[0] === "jscpd" && args.includes("--ignore");
    });
    expect(jscpdRun).toBeDefined();
    const args = jscpdRun![1] as string[];
    const ignoreValue = args[args.indexOf("--ignore") + 1];
    expect(ignoreValue).toContain("**/node_modules/**");
    expect(ignoreValue).toContain("**/*_pb2.py");
    expect(ignoreValue).toContain("**/generated/**");
    // mapignore entries must NOT leak into jscpd args
    expect(ignoreValue).not.toContain("some_structure_dir");
  });

  it("uses bundled dupignore template when project has no .grimoire/dupignore", async () => {
    const projectDupignorePaths: string[] = [];
    const templateDupignorePaths: string[] = [];

    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("dupignore")) {
        if (p.includes("/.grimoire/")) {
          projectDupignorePaths.push(p);
          throw new Error("ENOENT");
        }
        if (p.includes("/templates/")) {
          templateDupignorePaths.push(p);
          return "**/vendor/**\n" as any;
        }
      }
      if (p.includes("mapignore")) return "node_modules\n" as any;
      if (p.includes("mapkeys")) return "" as any;
      if (p.includes("jscpd-report.json"))
        return JSON.stringify({ duplicates: [], statistics: { total: { lines: 100, duplicatedLines: 0 } } }) as any;
      if (p.includes("index.yml")) throw new Error("ENOENT");
      throw new Error("ENOENT");
    });

    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path) === "/fake/root") return makeDirEntries(["app.ts"]) as any;
      return [] as any;
    });

    await generateMap({
      json: false,
      refresh: false,
      maxDepth: 3,
      duplicates: true,
    });

    expect(projectDupignorePaths.length).toBeGreaterThan(0);
    expect(templateDupignorePaths.length).toBeGreaterThan(0);

    const jscpdRun = mockExecFileAsync.mock.calls.find((c: any) => {
      const args = c[1] as string[];
      return Array.isArray(args) && args[0] === "jscpd" && args.includes("--ignore");
    });
    expect(jscpdRun).toBeDefined();
    const args = jscpdRun![1] as string[];
    const ignoreValue = args[args.indexOf("--ignore") + 1];
    expect(ignoreValue).toContain("**/vendor/**");
  });

  it("omits --ignore when dupignore is empty", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("mapignore")) return "node_modules\n" as any;
      if (p.includes("dupignore")) return "# only comments\n" as any;
      if (p.includes("mapkeys")) return "" as any;
      if (p.includes("jscpd-report.json"))
        return JSON.stringify({ duplicates: [], statistics: { total: { lines: 100, duplicatedLines: 0 } } }) as any;
      if (p.includes("index.yml")) throw new Error("ENOENT");
      throw new Error("ENOENT");
    });

    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path) === "/fake/root") return makeDirEntries(["app.ts"]) as any;
      return [] as any;
    });

    await generateMap({
      json: false,
      refresh: false,
      maxDepth: 3,
      duplicates: true,
    });

    const jscpdRun = mockExecFileAsync.mock.calls.find((c: any) => {
      const args = c[1] as string[];
      return Array.isArray(args) && args[0] === "jscpd";
    });
    expect(jscpdRun).toBeDefined();
    const args = jscpdRun![1] as string[];
    expect(args).not.toContain("--ignore");
  });

  it("writes snapshot to .grimoire/docs/.snapshot.json", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path) === "/fake/root") {
        return makeDirEntries(["app.ts"]) as any;
      }
      return [] as any;
    });

    vi.spyOn(console, "log").mockImplementation(() => {});

    await generateMap({
      json: false,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
    });

    const snapshotWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes(".snapshot.json")
    );
    expect(snapshotWrite).toBeDefined();
    const written = JSON.parse(snapshotWrite![1] as string);
    expect(written.directories).toBeDefined();
    expect(written.keyFiles).toBeDefined();
    expect(written.symbols).toBeUndefined();
  });
});
