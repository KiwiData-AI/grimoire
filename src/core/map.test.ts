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

vi.mock("./symbols.js", () => ({
  extractSymbols: vi.fn().mockResolvedValue({ symbols: [], fileCount: 0 }),
  generateCompressedMap: vi.fn().mockReturnValue("# Symbols"),
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  const fn = vi.fn();
  const asyncFn = vi.fn(async () => ({ stdout: "", stderr: "" }));
  (fn as any)[promisify.custom] = asyncFn;
  return { execFile: fn, spawn: vi.fn() };
});

import { readFile, readdir, writeFile } from "node:fs/promises";
import { extractSymbols, generateCompressedMap } from "./symbols.js";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockWriteFile = vi.mocked(writeFile);
const mockExtractSymbols = vi.mocked(extractSymbols);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});

  // Default mapignore and mapkeys templates
  mockReadFile.mockImplementation(async (path: any) => {
    const p = String(path);
    if (p.includes("mapignore")) return "node_modules\ndist\n.git\n" as any;
    if (p.includes("mapkeys")) return "package.json = manifest\nREADME.md = docs\n" as any;
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
      symbols: false,
      compress: false,
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
      symbols: false,
      compress: false,
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
      symbols: false,
      compress: false,
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
      symbols: false,
      compress: false,
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
      symbols: false,
      compress: false,
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
      symbols: false,
      compress: false,
    });

    const output = JSON.parse(logs.join(""));
    expect(output.undocumented).toContain("lib");
  });

  it("extracts symbols when symbols option is true", async () => {
    mockReaddir.mockImplementation(async () => [] as any);
    mockExtractSymbols.mockResolvedValue({
      symbols: [{ file: "src/a.ts", name: "foo", kind: "function", line: 1, exported: true }],
      fileCount: 1,
    } as any);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await generateMap({
      json: true,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
      symbols: true,
      compress: false,
    });

    // Filter out non-JSON log lines (e.g., "Extracting symbols...")
    const jsonLine = logs.find((l) => l.startsWith("{"));
    expect(jsonLine).toBeDefined();
    const output = JSON.parse(jsonLine!);
    expect(output.symbols).toHaveLength(1);
    expect(output.symbols[0].name).toBe("foo");
  });

  it("writes compressed symbol map when compress is true", async () => {
    mockReaddir.mockImplementation(async () => [] as any);
    mockExtractSymbols.mockResolvedValue({
      symbols: [{ file: "src/a.ts", name: "foo", kind: "function", line: 1, exported: true }],
      fileCount: 1,
    } as any);

    vi.spyOn(console, "log").mockImplementation(() => {});

    await generateMap({
      json: false,
      refresh: false,
      maxDepth: 3,
      duplicates: false,
      symbols: true,
      compress: true,
    });

    const symbolsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes(".symbols.md")
    );
    expect(symbolsWrite).toBeDefined();
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
      symbols: false,
      compress: false,
    });

    expect(logs.some((l) => l.includes("Project Map"))).toBe(true);
    expect(logs.some((l) => l.includes("src/"))).toBe(true);
  });
});
