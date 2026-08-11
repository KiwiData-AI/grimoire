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
    expect(written.hooks.PreCommit[1].command).toBe(
      "grimoire check --changed --json --skip best_practices",
    );
  });

  it("replaces a stale grimoire check entry instead of stacking a second one", async () => {
    const existingHooks = {
      hooks: {
        PreCommit: [
          { matcher: "*.py", command: "black --check ." },
          { matcher: "*", command: "grimoire check --changed --json" },
        ],
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
    expect(written.hooks.PreCommit).toHaveLength(2);
    expect(written.hooks.PreCommit[0].command).toBe("black --check .");
    expect(written.hooks.PreCommit[1].command).toBe(
      "grimoire check --changed --json --skip best_practices",
    );
  });

  it("removes a stale entry even when the current command is already present", async () => {
    const existingHooks = {
      hooks: {
        PreCommit: [
          { matcher: "*", command: "grimoire check --changed --json" },
          { matcher: "*", command: "grimoire check --changed --json --skip best_practices" },
        ],
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
    expect(written.hooks.PreCommit).toHaveLength(1);
    expect(written.hooks.PreCommit[0].command).toBe(
      "grimoire check --changed --json --skip best_practices",
    );
  });

  it("keeps a user-customized grimoire check variant untouched", async () => {
    const existingHooks = {
      hooks: {
        PreCommit: [
          { matcher: "*", command: "grimoire check --changed --json --skip best_practices,secrets" },
        ],
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
    expect(written.hooks.PreCommit).toHaveLength(1);
    expect(written.hooks.PreCommit[0].command).toBe(
      "grimoire check --changed --json --skip best_practices,secrets",
    );
  });

  it("preserves a user matcher when upgrading a stale grimoire entry", async () => {
    const existingHooks = {
      hooks: {
        PreCommit: [{ matcher: "*.py", command: "grimoire check --changed --json" }],
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
    expect(written.hooks.PreCommit).toHaveLength(1);
    expect(written.hooks.PreCommit[0]).toEqual({
      matcher: "*.py",
      command: "grimoire check --changed --json --skip best_practices",
    });
  });

  it("passes foreign phases through untouched, even malformed ones", async () => {
    const existingHooks = {
      hooks: {
        Notification: { not: "an array" },
        PreToolUse: [{ matcher: "*", command: "my-lint" }],
      },
    };
    setExists("/root/.git", "/root/.claude/hooks.json");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("hooks.json")) return JSON.stringify(existingHooks) as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const bakWrite = mockWriteFile.mock.calls.find((c) => String(c[0]).endsWith(".bak"));
    expect(bakWrite).toBeUndefined();
    const hooksWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("hooks.json")
    );
    expect(hooksWrite).toBeDefined();
    const written = JSON.parse(String(hooksWrite![1]));
    expect(written.hooks.Notification).toEqual({ not: "an array" });
    expect(written.hooks.PreToolUse).toEqual([{ matcher: "*", command: "my-lint" }]);
    expect(written.hooks.PreCommit).toHaveLength(1);
  });

  it("skips git hooks when .git doesn't exist", async () => {
    setExists(); // nothing exists
    await setupHooks("/root");

    const writeArgs = mockWriteFile.mock.calls.map((c) => String(c[0]));
    expect(writeArgs.some((p) => p.includes("pre-commit"))).toBe(false);
  });

  it("skips pre-commit when it already has the current grimoire check", async () => {
    setExists("/root/.git", "/root/.git/hooks/pre-commit");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("pre-commit"))
        return "#!/bin/sh\ngrimoire check --changed --skip best_practices\n" as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const writeArgs = mockWriteFile.mock.calls.map((c) => String(c[0]));
    expect(writeArgs.some((p) => p.includes("pre-commit"))).toBe(false);
  });

  it("removes a stale pre-commit line when the current command is also present", async () => {
    setExists("/root/.git", "/root/.git/hooks/pre-commit");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("pre-commit"))
        return "#!/bin/sh\ngrimoire check --changed\ngrimoire check --changed --skip best_practices\n" as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const preCommitWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("pre-commit")
    );
    expect(preCommitWrite).toBeDefined();
    const written = String(preCommitWrite![1]);
    expect(written).not.toMatch(/grimoire check --changed\n/);
    expect(written.match(/grimoire check --changed --skip best_practices/g)?.length).toBe(1);
  });

  it("upgrades a stale grimoire check line in pre-commit", async () => {
    setExists("/root/.git", "/root/.git/hooks/pre-commit");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("pre-commit"))
        return "#!/bin/sh\nif command -v grimoire >/dev/null 2>&1; then\n  grimoire check --changed\nfi\n" as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const preCommitWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("pre-commit")
    );
    expect(preCommitWrite).toBeDefined();
    const written = String(preCommitWrite![1]);
    expect(written).toContain("  grimoire check --changed --skip best_practices\n");
    expect(written).not.toMatch(/grimoire check --changed\n/);
  });

  it("merges into a hooks.json that has no hooks key without replacing it", async () => {
    setExists("/root/.git", "/root/.claude/hooks.json");
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("hooks.json")) return "{}" as any;
      throw new Error("ENOENT");
    });

    await setupHooks("/root");

    const bakWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).endsWith(".bak")
    );
    expect(bakWrite).toBeUndefined();
    const hooksWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("hooks.json")
    );
    expect(hooksWrite).toBeDefined();
    const written = JSON.parse(String(hooksWrite![1]));
    expect(written.hooks.PreCommit).toHaveLength(1);
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

  it("does not rewrite settings when both hooks are already wired", async () => {
    const existing = {
      hooks: {
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "grimoire branch-check --hook" }] },
        ],
        PreToolUse: [
          { matcher: "Write|Edit", hooks: [{ type: "command", command: "grimoire lint-comments --hook" }] },
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

  it("adds the comment-lint PreToolUse hook when only branch-check is wired", async () => {
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
    expect(settingsWrite).toBeDefined();
    const written = JSON.parse(String(settingsWrite![1]));
    expect(written.hooks.UserPromptSubmit).toHaveLength(1);
    expect(written.hooks.PreToolUse[0].matcher).toBe("Write|Edit");
    expect(written.hooks.PreToolUse[0].hooks[0].command).toContain("grimoire lint-comments");
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
