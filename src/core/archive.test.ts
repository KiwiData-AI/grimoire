import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveChange, ArchiveError } from "./archive.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    cp: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

import { readFile, mkdir, cp, rm } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockCp = vi.mocked(cp);
const mockRm = vi.mocked(rm);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("archiveChange", () => {
  it("throws ArchiveError when manifest doesn't exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(archiveChange("missing", { yes: true })).rejects.toThrow(ArchiveError);
    await expect(archiveChange("missing", { yes: true })).rejects.toThrow("not found or missing manifest");
  });

  it("throws ArchiveError when tasks pending and --yes not set", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change" as any;
      if (String(path).includes("tasks.md")) return "- [ ] Pending task\n- [x] Done task" as any;
      throw new Error("ENOENT");
    });

    await expect(archiveChange("test", { yes: false })).rejects.toThrow(ArchiveError);
    await expect(archiveChange("test", { yes: false })).rejects.toThrow("--yes");
  });

  it("archives successfully with --yes when tasks pending", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change" as any;
      if (String(path).includes("tasks.md")) return "- [ ] Pending\n- [x] Done" as any;
      throw new Error("ENOENT");
    });

    await archiveChange("test-change", { yes: true });

    // Should copy manifest to archive
    expect(mockCp).toHaveBeenCalled();
    // Should remove change directory
    expect(mockRm).toHaveBeenCalledWith(
      "/fake/root/.grimoire/changes/test-change",
      { recursive: true }
    );
  });

  it("archives change with no tasks file", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return "# Change" as any;
      throw new Error("ENOENT");
    });

    await archiveChange("simple", { yes: true });
    expect(mockRm).toHaveBeenCalled();
  });
});
