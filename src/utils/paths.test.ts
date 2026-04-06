import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./fs.js", () => ({
  fileExists: vi.fn().mockResolvedValue(false),
}));

import { resolveChangePath, safePath, findProjectRoot } from "./paths.js";
import { fileExists } from "./fs.js";

const mockFileExists = vi.mocked(fileExists);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveChangePath", () => {
  it("returns correct path for valid id", () => {
    expect(resolveChangePath("/root", "add-auth")).toBe(
      "/root/.grimoire/changes/add-auth"
    );
  });

  it("throws for id with forward slash", () => {
    expect(() => resolveChangePath("/root", "bad/id")).toThrow("Invalid change ID");
  });

  it("throws for id with backslash", () => {
    expect(() => resolveChangePath("/root", "bad\\id")).toThrow("Invalid change ID");
  });

  it("throws for id with ..", () => {
    expect(() => resolveChangePath("/root", "..")).toThrow("Invalid change ID");
    expect(() => resolveChangePath("/root", "foo..bar")).toThrow("Invalid change ID");
  });
});

describe("safePath", () => {
  it("returns resolved path for valid relative path", () => {
    const result = safePath("/project", "src/index.ts");
    expect(result).toBe("/project/src/index.ts");
  });

  it("throws for path that escapes root", () => {
    expect(() => safePath("/project", "../../etc/passwd")).toThrow(
      "Path escapes project root"
    );
  });

  it("accepts root itself", () => {
    expect(safePath("/project", ".")).toBe("/project");
  });
});

describe("findProjectRoot", () => {
  it("returns dir with .grimoire", async () => {
    const cwd = process.cwd();
    mockFileExists.mockImplementation(async (path: string) => {
      return path === `${cwd}/.grimoire`;
    });

    const result = await findProjectRoot();
    expect(result).toBe(cwd);
  });

  it("returns dir with features", async () => {
    const cwd = process.cwd();
    mockFileExists.mockImplementation(async (path: string) => {
      return path === `${cwd}/features`;
    });

    const result = await findProjectRoot();
    expect(result).toBe(cwd);
  });

  it("falls back to cwd when nothing found", async () => {
    mockFileExists.mockResolvedValue(false);
    const result = await findProjectRoot();
    expect(result).toBe(process.cwd());
  });
});
