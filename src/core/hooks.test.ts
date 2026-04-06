import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupHooks } from "./hooks.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn(),
    chmod: vi.fn().mockResolvedValue(undefined),
  };
});

import { readFile, writeFile, mkdir, access, chmod } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockAccess = vi.mocked(access);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function setExists(...paths: string[]) {
  const pathSet = new Set(paths);
  mockAccess.mockImplementation(async (path: any) => {
    if (pathSet.has(String(path))) return undefined as any;
    throw new Error("ENOENT");
  });
}

describe("setupHooks", () => {
  it("creates hooks.json and pre-commit when nothing exists", async () => {
    setExists("/root/.git");
    await setupHooks("/root");

    // Should create .claude/hooks.json
    const writeArgs = mockWriteFile.mock.calls.map((c) => String(c[0]));
    expect(writeArgs.some((p) => p.includes("hooks.json"))).toBe(true);

    // Should create pre-commit hook
    expect(writeArgs.some((p) => p.includes("pre-commit"))).toBe(true);
  });

  it("merges with existing hooks.json without duplicating", async () => {
    const existingHooks = {
      hooks: {
        PreCommit: [{ matcher: "*.py", command: "black --check ." }],
      },
    };
    setExists("/root/.git", "/root/.claude/hooks.json");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("hooks.json")) return JSON.stringify(existingHooks) as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const hooksWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("hooks.json")
    );
    expect(hooksWrite).toBeDefined();
    const written = JSON.parse(String(hooksWrite![1]));
    // Should keep existing entry and add grimoire entries
    expect(written.hooks.PreCommit).toHaveLength(2);
    expect(written.hooks.PreCommit[0].command).toBe("black --check .");
    expect(written.hooks.PreCommit[1].command).toBe("grimoire check --changed --json");
  });

  it("skips git hooks when .git doesn't exist", async () => {
    setExists(); // nothing exists
    await setupHooks("/root");

    const writeArgs = mockWriteFile.mock.calls.map((c) => String(c[0]));
    expect(writeArgs.some((p) => p.includes("pre-commit"))).toBe(false);
  });

  it("skips pre-commit when it already has grimoire", async () => {
    setExists("/root/.git", "/root/.git/hooks/pre-commit");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("pre-commit")) return "#!/bin/sh\ngrimoire check --changed\n" as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const writeArgs = mockWriteFile.mock.calls.map((c) => String(c[0]));
    expect(writeArgs.some((p) => p.includes("pre-commit"))).toBe(false);
  });

  it("appends to existing pre-commit without grimoire", async () => {
    setExists("/root/.git", "/root/.git/hooks/pre-commit");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("pre-commit")) return "#!/bin/sh\neslint .\n" as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const preCommitWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("pre-commit")
    );
    expect(preCommitWrite).toBeDefined();
    expect(String(preCommitWrite![1])).toContain("grimoire check --changed");
    expect(String(preCommitWrite![1])).toContain("eslint");
  });
});
