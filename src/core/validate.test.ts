import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateChange } from "./validate.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
  };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

vi.mock("../utils/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/fs.js")>("../utils/fs.js");
  return {
    ...actual,
    findFiles: vi.fn().mockResolvedValue([]),
  };
});

import { readFile, readdir } from "node:fs/promises";
import { findFiles } from "../utils/fs.js";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockFindFiles = vi.mocked(findFiles);

beforeEach(() => {
  vi.clearAllMocks();
  mockReaddir.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
  mockFindFiles.mockResolvedValue([]);
});

const VALID_MANIFEST = "---\nstatus: draft\n---\n## Why\nBecause.\n## Feature Changes\n- foo";
const VALID_MANIFEST_WITH_DECISIONS = "---\nstatus: draft\n---\n## Why\nBecause.\n## Decisions\n- foo";

describe("feature file validation (via @cucumber/gherkin)", () => {
  it("detects invalid Gherkin syntax", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "This is not a feature file\nJust random text";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/bad.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Invalid Gherkin syntax")))).toBe(true);
  });

  it("detects missing Feature name", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature:\n  Scenario: Test\n    When I do something\n    Then it works\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/unnamed.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Missing Feature name")))).toBe(true);
  });

  it("detects missing scenarios", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature: Empty feature\n  Some description\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/empty.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("No scenarios found")))).toBe(true);
  });

  it("detects scenario missing When step", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature: Test\n  Scenario: No when\n    Given something\n    Then it works\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/no-when.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("missing When step")))).toBe(true);
  });

  it("detects Scenario Outline without Examples", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature: Test\n  Scenario Outline: No examples\n    Given a <thing>\n    When I use it\n    Then it works\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/outline.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("missing Examples table")))).toBe(true);
  });

  it("validates a correct feature file with no errors", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature: Login\n  Scenario: Valid login\n    Given I am on the login page\n    When I enter valid credentials\n    Then I should see the dashboard\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/login.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: false, json: true });
    expect(result.errorCount).toBe(0);
  });

  it("warns about missing user story in strict mode", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature: Login\n  Scenario: Valid login\n    Given I am on the login page\n    When I enter valid credentials\n    Then I should see the dashboard\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/login.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: true, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("user story")))).toBe(true);
  });

  it("warns about implementation details in strict mode", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      return "Feature: Login\n  As a user\n  I want to log in\n  So that I can access my account\n\n  Scenario: Login via API\n    Given I have an account\n    When I POST to the database\n    Then I should be logged in\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test/features/impl.feature"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: true, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("implementation details")))).toBe(true);
  });
});

describe("decision file validation", () => {
  it("detects missing frontmatter", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST_WITH_DECISIONS;
      return "# Use PostgreSQL\n\n## Context and Problem Statement\nNeed a DB.\n\n## Considered Options\n1. PG\n\n## Decision Outcome\nPG.\n";
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".md") return ["/fake/root/.grimoire/changes/test/decisions/001.md"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Missing YAML frontmatter")))).toBe(true);
  });

  it("validates decision file with all required sections", async () => {
    const decisionContent = `---
status: accepted
date: 2026-01-15
---
# Use PostgreSQL

## Context and Problem Statement
Need a database.

## Considered Options
1. PostgreSQL
2. MySQL

## Decision Outcome
PostgreSQL.
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST_WITH_DECISIONS;
      return decisionContent;
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".md") return ["/fake/root/.grimoire/changes/test/decisions/001.md"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: false, json: true });
    expect(result.errorCount).toBe(0);
  });

  it("warns about missing Cost of Ownership in strict mode", async () => {
    const decision = `---
status: proposed
date: 2026-04-05
---

# Use PostgreSQL

## Context and Problem Statement
Need a DB.

## Decision Drivers
- Performance

## Considered Options
1. PG
2. MySQL

## Decision Outcome
Chosen option: PG.

### Consequences
- Good: fast

### Confirmation
Load test it.
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST_WITH_DECISIONS;
      return decision;
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".md") return ["/fake/root/.grimoire/changes/test/decisions/001.md"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: true, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("Cost of Ownership")))).toBe(true);
  });

  it("warns about missing Decision Drivers, Consequences, Confirmation in strict mode", async () => {
    const decisionContent = `---
status: accepted
date: 2026-01-15
---
# Use PostgreSQL

## Context and Problem Statement
Need a database.

## Considered Options
1. PostgreSQL

## Decision Outcome
PostgreSQL.
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST_WITH_DECISIONS;
      return decisionContent;
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".md") return ["/fake/root/.grimoire/changes/test/decisions/001.md"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: true, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("Decision Drivers")))).toBe(true);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("Consequences")))).toBe(true);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("Confirmation")))).toBe(true);
  });

  it("detects decision missing required sections", async () => {
    const decisionContent = `---
status: accepted
date: 2026-01-15
---
# Incomplete Decision
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST_WITH_DECISIONS;
      return decisionContent;
    });
    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".md") return ["/fake/root/.grimoire/changes/test/decisions/001.md"];
      return [];
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Context and Problem Statement")))).toBe(true);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Considered Options")))).toBe(true);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Decision Outcome")))).toBe(true);
  });
});

describe("manifest validation", () => {
  it.each(["draft", "approved", "implementing"])("accepts the %s manifest status", async (status) => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) {
        return VALID_MANIFEST.replace("status: draft", `status: ${status}`);
      }
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: false, json: true });
    expect(result.errorCount).toBe(0);
  });

  it.each(["complete", "accepted"])("rejects the retired %s manifest status", async (status) => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) {
        return VALID_MANIFEST.replace("status: draft", `status: ${status}`);
      }
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: false, json: true });
    expect(result.results[0].errors).toEqual([
      'Invalid status "' + status + '" — must be one of: draft, approved, implementing',
    ]);
  });

  it("detects invalid manifest status", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return "---\nstatus: yolo\n---\n## Why\nBecause.\n## Feature Changes\n- something";
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Invalid status")))).toBe(true);
  });

  it("validates a correct manifest with no errors", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: false, json: true });
    expect(result.errorCount).toBe(0);
  });

  it("warns about missing Assumptions in strict mode", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: true, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("Assumptions")))).toBe(true);
  });

  it("warns about missing Pre-Mortem in strict mode", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: true, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.warnings.some((w: string) => w.includes("Pre-Mortem")))).toBe(true);
  });

  it("detects missing manifest", async () => {
    mockReadFile.mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOENT" }));

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: false, json: true });
    expect(result.errorCount).toBe(1);
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Manifest file missing")))).toBe(true);
  });

  it("detects missing frontmatter status field", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return "---\nbranch: main\n---\n## Why\nBecause.\n## Feature Changes\n- foo";
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("missing 'status'")))).toBe(true);
  });

  it("detects manifest missing both Feature Changes and Decisions", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return "---\nstatus: draft\n---\n## Why\nBecause.";
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("test", { strict: false, json: true });
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
    expect(output.some((r: any) => r.errors.some((e: string) => e.includes("Must have at least one")))).toBe(true);
  });

  it("returns error count for programmatic use", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return "no frontmatter\n## Why\nYes.\n## Feature Changes\n- x";
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange("test", { strict: true, json: true });
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("pretty prints results in non-json mode", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return VALID_MANIFEST;
      throw new Error("not found");
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await validateChange("test", { strict: false, json: false });
    expect(logs.some((l) => l.includes("Validation passed"))).toBe(true);
  });

  it("validates all changes when no changeId provided", async () => {
    mockReaddir.mockResolvedValue([
      { name: "change-a", isDirectory: () => true },
    ] as any);

    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).includes("manifest.md")) return VALID_MANIFEST;
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange(undefined, { strict: false, json: true });
    expect(result.errorCount).toBe(0);
  });

  it("validates malformed live specifications without an active change", async () => {
    mockFindFiles.mockImplementation(async (dir: string, ext: string) => {
      if (dir === "/fake/root/features" && ext === ".feature") {
        return ["/fake/root/features/broken.feature"];
      }
      return [];
    });
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).endsWith("broken.feature")) return "not gherkin";
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange(undefined, { strict: false, json: true });

    expect(result.errorCount).toBe(1);
    expect(result.results[0].file).toBe("/fake/root/features/broken.feature");
  });

  it("does not suppress active coordination read failures", async () => {
    const failure = Object.assign(new Error("permission denied"), { code: "EACCES" });
    mockReaddir.mockRejectedValue(failure);

    await expect(validateChange(undefined, { strict: false, json: true })).rejects.toBe(failure);
  });

  it.each([
    ["features", "/fake/root/features"],
    ["decisions", "/fake/root/.grimoire/decisions"],
  ])("does not suppress live %s read failures", async (_kind, failingPath) => {
    const failure = Object.assign(new Error("permission denied"), { code: "EACCES" });
    mockFindFiles.mockImplementation(async (path: string) => {
      if (path === failingPath) throw failure;
      return [];
    });

    await expect(validateChange(undefined, { strict: false, json: true })).rejects.toBe(failure);
  });

  it("does not report an unreadable manifest as missing", async () => {
    const failure = Object.assign(new Error("permission denied"), { code: "EACCES" });
    mockReadFile.mockRejectedValue(failure);

    await expect(validateChange("change-a", { strict: false, json: true })).rejects.toBe(failure);
  });

  it("validates every active manifest and both live specification homes", async () => {
    mockReaddir.mockResolvedValue([
      { name: "change-a", isDirectory: () => true },
      { name: "change-b", isDirectory: () => true },
    ] as any);
    mockFindFiles.mockImplementation(async (dir: string, ext: string) => {
      if (dir === "/fake/root/features" && ext === ".feature") {
        return ["/fake/root/features/example.feature"];
      }
      if (dir === "/fake/root/.grimoire/decisions" && ext === ".md") {
        return ["/fake/root/.grimoire/decisions/0001-example.md"];
      }
      return [];
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const file = String(path);
      if (file.endsWith("manifest.md")) return VALID_MANIFEST;
      if (file.endsWith(".feature")) {
        return "Feature: Valid\n  Scenario: Works\n    When it runs\n    Then it passes\n";
      }
      if (file.endsWith(".md")) {
        return "---\nstatus: accepted\ndate: 2026-01-01\n---\n## Context and Problem Statement\nX\n## Considered Options\nX\n## Decision Outcome\nX";
      }
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await validateChange(undefined, { strict: false, json: true });

    expect(result.errorCount).toBe(0);
    expect(mockReadFile).toHaveBeenCalledWith("/fake/root/.grimoire/changes/change-a/manifest.md", "utf-8");
    expect(mockReadFile).toHaveBeenCalledWith("/fake/root/.grimoire/changes/change-b/manifest.md", "utf-8");
    expect(mockFindFiles).toHaveBeenCalledWith("/fake/root/features", ".feature");
    expect(mockFindFiles).toHaveBeenCalledWith("/fake/root/.grimoire/decisions", ".md");
  });

  it("validates a selected manifest with the same live specifications", async () => {
    mockFindFiles.mockResolvedValue([]);
    mockReadFile.mockImplementation(async (path: any) => {
      if (String(path).endsWith("manifest.md")) return VALID_MANIFEST;
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    await validateChange("change-a", { strict: false, json: true });

    expect(mockFindFiles).toHaveBeenCalledWith("/fake/root/features", ".feature");
    expect(mockFindFiles).toHaveBeenCalledWith("/fake/root/.grimoire/decisions", ".md");
  });
});
