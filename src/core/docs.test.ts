import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateDocs } from "./docs.js";

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
  safePath: vi.fn((_root: string, p: string) => `/fake/root/${p}`),
}));

vi.mock("../utils/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    version: 1,
    project: { commit_style: "conventional", language: "TypeScript" },
    features_dir: "features",
    decisions_dir: ".grimoire/decisions",
    tools: { lint: { name: "eslint", command: "eslint src/" } },
    checks: ["lint"],
    llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
  }),
}));

vi.mock("../utils/fs.js", () => ({
  findFiles: vi.fn().mockResolvedValue([]),
}));

import { readFile, readdir, writeFile } from "node:fs/promises";
import { findFiles } from "../utils/fs.js";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockWriteFile = vi.mocked(writeFile);
const mockFindFiles = vi.mocked(findFiles);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});

  // Default: most reads fail (no optional files)
  mockReadFile.mockImplementation(async (path: any) => {
    const p = String(path);
    if (p.includes("package.json")) return '{"name": "test-project"}' as any;
    throw new Error("ENOENT");
  });
  mockReaddir.mockRejectedValue(new Error("ENOENT"));
  mockFindFiles.mockResolvedValue([]);
});

describe("generateDocs", () => {
  it("generates docs with project name from package.json", async () => {
    await generateDocs({});

    expect(mockWriteFile).toHaveBeenCalled();
    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("# test-project");
  });

  it("includes project summary from config", async () => {
    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## Project Summary");
    expect(content).toContain("TypeScript");
    expect(content).toContain("eslint");
  });

  it("includes features section when feature files exist", async () => {
    mockFindFiles.mockResolvedValue(["/fake/root/features/auth/login.feature"]);
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("package.json")) return '{"name": "test-project"}' as any;
      if (p.endsWith(".feature")) {
        return `Feature: User login
  As a user
  I want to log in
  So that I can access my account

  Scenario: Successful login
    Given valid credentials
    When I submit the form
    Then I am logged in

  Scenario: Failed login
    Given invalid credentials
    When I submit the form
    Then I see an error
` as any;
      }
      throw new Error("ENOENT");
    });

    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## Features");
    expect(content).toContain("User login");
    expect(content).toContain("Successful login");
    expect(content).toContain("Failed login");
  });

  it("includes decisions section when decision files exist", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("decisions")) {
        return ["0001-use-postgresql.md"] as any;
      }
      throw new Error("ENOENT");
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("package.json")) return '{"name": "test-project"}' as any;
      if (p.includes("0001-use-postgresql")) {
        return `---
status: accepted
date: 2026-01-15
---
# Use PostgreSQL for persistence

## Context and Problem Statement
We need a database for storing user data.

## Decision Outcome
Chosen PostgreSQL for its reliability.
` as any;
      }
      throw new Error("ENOENT");
    });

    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## Architecture Decisions");
    expect(content).toContain("Use PostgreSQL");
    expect(content).toContain("accepted");
  });

  it("writes output to OVERVIEW.md by default", async () => {
    await generateDocs({});

    const writePath = String(mockWriteFile.mock.calls[0][0]);
    expect(writePath).toContain("OVERVIEW.md");
  });

  it("writes to custom output path", async () => {
    await generateDocs({ output: "docs/README.md" });

    const writePath = String(mockWriteFile.mock.calls[0][0]);
    expect(writePath).toContain("docs/README.md");
  });

  it("includes architecture section when index.yml exists", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("package.json")) return '{"name": "test-project"}' as any;
      if (p.includes("index.yml")) {
        return `areas:
  - name: Core
    path: .grimoire/docs/core.md
    directory: src/core
    description: Core business logic
` as any;
      }
      if (p.includes("core.md")) {
        return `## Purpose
Handles core business operations.

## Boundaries
Only accessed through the API layer.
` as any;
      }
      throw new Error("ENOENT");
    });

    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## System Architecture");
    expect(content).toContain("Core");
    expect(content).toContain("Core business logic");
  });

  it("includes recent changes from archive", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("archive")) {
        return [
          { name: "2026-01-15-add-auth", isDirectory: () => true, isFile: () => false },
        ] as any;
      }
      throw new Error("ENOENT");
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("package.json")) return '{"name": "test-project"}' as any;
      if (p.includes("manifest.md")) {
        return "# Change: Add authentication\n\n## Why\nSecurity requirement.\n" as any;
      }
      throw new Error("ENOENT");
    });

    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## Recent Changes");
    expect(content).toContain("Add authentication");
  });

  it("includes active work section", async () => {
    mockReaddir.mockImplementation(async (path: any) => {
      if (String(path).includes("changes")) {
        return [
          { name: "add-billing", isDirectory: () => true, isFile: () => false },
        ] as any;
      }
      throw new Error("ENOENT");
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("package.json")) return '{"name": "test-project"}' as any;
      if (p.includes("manifest.md")) {
        return "---\nstatus: implementing\n---\n# Change: Add billing\n" as any;
      }
      if (p.includes("tasks.md")) {
        return "- [x] Create spec\n- [ ] Implement\n" as any;
      }
      throw new Error("ENOENT");
    });

    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## Active Work");
    expect(content).toContain("add-billing");
  });

  it("includes data model section from schema.yml", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("package.json")) return '{"name": "test-project"}' as any;
      if (p.includes("schema.yml")) {
        return `User:
  type: table
  source: users
  fields:
    id:
      type: uuid
      pk: true
    email:
      type: varchar
      unique: true
      not_null: true
StripeAPI:
  type: external_api
  provider: Stripe
  auth: Bearer token
  endpoints:
    createCharge:
      method: POST
      path: /v1/charges
` as any;
      }
      throw new Error("ENOENT");
    });

    await generateDocs({});

    const content = String(mockWriteFile.mock.calls[0][1]);
    expect(content).toContain("## Data Model");
    expect(content).toContain("User");
    expect(content).toContain("email");
    expect(content).toContain("StripeAPI");
    expect(content).toContain("Stripe");
  });
});
