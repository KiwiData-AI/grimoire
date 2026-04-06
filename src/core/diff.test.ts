import { describe, it, expect, vi, beforeEach } from "vitest";
import { diffChange } from "./diff.js";

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

vi.mock("../utils/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/fs.js")>("../utils/fs.js");
  return {
    ...actual,
    findFiles: vi.fn().mockResolvedValue([]),
    fileExists: vi.fn().mockResolvedValue(false),
  };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

import { readFile } from "node:fs/promises";
import { findFiles, fileExists } from "../utils/fs.js";

const mockReadFile = vi.mocked(readFile);
const mockFindFiles = vi.mocked(findFiles);
const mockFileExists = vi.mocked(fileExists);

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFiles.mockResolvedValue([]);
  mockFileExists.mockResolvedValue(false);
});

describe("diffChange", () => {
  it("detects added features with scenarios", async () => {
    mockFindFiles.mockImplementation(async (dir: string) => {
      if (dir.includes("changes/add-auth/features")) {
        return ["/fake/root/.grimoire/changes/add-auth/features/auth/login.feature"];
      }
      return [];
    });

    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("login.feature")) {
        return `Feature: Login
  As a user I want to log in So that I can access the app

  Scenario: Successful login
    Given I have valid credentials
    When I submit the login form
    Then I should see the dashboard

  Scenario: Failed login
    Given I have invalid credentials
    When I submit the login form
    Then I should see an error message`;
      }
      if (path.includes("manifest.md")) {
        return "---\nstatus: draft\n---\n## Why\nAuth.\n## Feature Changes\n- added";
      }
      throw new Error("not found");
    });

    // baseline doesn't exist
    mockFileExists.mockResolvedValue(false);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    const result = await diffChange("add-auth", { json: false });

    expect(result.features).toHaveLength(1);
    expect(result.features[0].status).toBe("added");
    expect(result.features[0].scenariosAdded).toContain("Successful login");
    expect(result.features[0].scenariosAdded).toContain("Failed login");
    expect(result.summary.featuresAdded).toBe(1);
    expect(result.summary.scenariosAdded).toBe(2);
  });

  it("detects modified features with added and removed scenarios", async () => {
    mockFindFiles.mockImplementation(async (dir: string) => {
      if (dir.includes("changes/update-auth/features")) {
        return ["/fake/root/.grimoire/changes/update-auth/features/auth/login.feature"];
      }
      return [];
    });

    // Proposed version: adds "2FA login", keeps "Successful login", removes "Failed login"
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("changes/update-auth")) {
        return `Feature: Login
  Scenario: Successful login
    Given credentials
    When submit
    Then dashboard

  Scenario: 2FA login
    Given credentials and 2FA
    When submit with code
    Then dashboard`;
      }
      // Baseline version
      if (path.includes("/features/auth/login.feature")) {
        return `Feature: Login
  Scenario: Successful login
    Given credentials
    When submit
    Then dashboard

  Scenario: Failed login
    Given bad credentials
    When submit
    Then error`;
      }
      if (path.includes("manifest.md")) {
        return "---\nstatus: draft\n---\n## Why\n2FA.\n## Feature Changes\n- mod";
      }
      throw new Error("not found");
    });

    mockFileExists.mockImplementation(async (path: string) => {
      return path.includes("/features/auth/login.feature") && !path.includes("changes");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await diffChange("update-auth", { json: false });

    expect(result.features).toHaveLength(1);
    expect(result.features[0].status).toBe("modified");
    expect(result.features[0].scenariosAdded).toEqual(["2FA login"]);
    expect(result.features[0].scenariosRemoved).toEqual(["Failed login"]);
    expect(result.features[0].scenariosUnchanged).toEqual(["Successful login"]);
  });

  it("outputs JSON when --json is set", async () => {
    mockFindFiles.mockResolvedValue([]);

    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) {
        return "---\nstatus: draft\n---\n## Why\nTest.\n## Feature Changes\n- x";
      }
      throw new Error("not found");
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await diffChange("empty-change", { json: true });

    const parsed = JSON.parse(logs.join(""));
    expect(parsed.changeId).toBe("empty-change");
    expect(parsed.features).toEqual([]);
    expect(parsed.summary.featuresAdded).toBe(0);
  });

  it("detects added decisions", async () => {
    // No features
    mockFindFiles.mockImplementation(async (dir: string) => {
      if (dir.includes("decisions")) {
        return ["/fake/root/.grimoire/changes/add-db/decisions/0001-use-postgres.md"];
      }
      return [];
    });

    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) {
        return "---\nstatus: draft\n---\n## Why\nDB.\n## Decisions\n- added";
      }
      throw new Error("not found");
    });

    mockFileExists.mockResolvedValue(false);

    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await diffChange("add-db", { json: false });

    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].status).toBe("added");
    expect(result.summary.decisionsAdded).toBe(1);
  });
});
