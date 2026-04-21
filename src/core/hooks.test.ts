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

  it("wires UserPromptSubmit branch-check into .claude/settings.json when none exists", async () => {
    setExists("/root/.git");
    await setupHooks("/root");

    const settingsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).endsWith("/.claude/settings.json")
    );
    expect(settingsWrite).toBeDefined();
    const written = JSON.parse(String(settingsWrite![1]));
    expect(written.hooks.UserPromptSubmit).toHaveLength(1);
    expect(written.hooks.UserPromptSubmit[0].hooks[0].command).toContain("grimoire branch-check");
  });

  it("does not duplicate UserPromptSubmit branch-check if already wired", async () => {
    const existing = {
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "grimoire branch-check --hook" }] },
        ],
      },
    };
    setExists("/root/.git", "/root/.claude/settings.json");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).endsWith("/.claude/settings.json")) return JSON.stringify(existing) as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const settingsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).endsWith("/.claude/settings.json")
    );
    expect(settingsWrite).toBeUndefined();
  });

  it("preserves existing UserPromptSubmit hooks and appends branch-check", async () => {
    const existing = {
      permissions: { allow: ["Bash(ls:*)"] },
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "custom-linter" }] },
        ],
      },
    };
    setExists("/root/.git", "/root/.claude/settings.json");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).endsWith("/.claude/settings.json")) return JSON.stringify(existing) as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const settingsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).endsWith("/.claude/settings.json")
    );
    expect(settingsWrite).toBeDefined();
    const written = JSON.parse(String(settingsWrite![1]));
    expect(written.permissions.allow).toEqual(["Bash(ls:*)"]);
    expect(written.hooks.UserPromptSubmit).toHaveLength(2);
    expect(written.hooks.UserPromptSubmit[0].hooks[0].command).toBe("custom-linter");
    expect(written.hooks.UserPromptSubmit[1].hooks[0].command).toContain("grimoire branch-check");
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
