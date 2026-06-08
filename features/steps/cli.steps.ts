import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Given, When, Then, After } from "@cucumber/cucumber";
import { GrimoireWorld } from "./world.js";

const VALID_FEATURE = `Feature: Example behaviour
  Scenario: It works
    Given a precondition
    When an action happens
    Then an outcome is observed
`;

const MALFORMED_FEATURE = `This file is not valid Gherkin at all.
Scenario without a feature
  Given nonsense
`;

const DECISION = `---
status: accepted
date: 2026-01-01
decision-makers: [Tester]
---

# Use the example approach

## Context and Problem Statement
We needed an example.

## Decision Outcome
Chosen option: "example", because it is illustrative.
`;

function manifest(status: string): string {
  return `---
status: ${status}
branch: feat/add-login
---

# Change: Add login

## Why
Users need to sign in.

## Feature Changes
- **ADDED** login.feature — users can sign in
`;
}

// ── Given: project setup ───────────────────────────────────────────────

Given("a fresh project directory", function (this: GrimoireWorld) {
  this.initGit();
});

Given("a grimoire project", function (this: GrimoireWorld) {
  this.initProject();
});

Given("a grimoire project with a documented feature", function (this: GrimoireWorld) {
  this.initProject();
  this.write(".grimoire/changes/demo/manifest.md", manifest("implementing"));
  this.write(".grimoire/changes/demo/features/example.feature", VALID_FEATURE);
});

Given("a grimoire project with a malformed feature", function (this: GrimoireWorld) {
  this.initProject();
  this.write(".grimoire/changes/demo/manifest.md", manifest("implementing"));
  this.write(".grimoire/changes/demo/features/broken.feature", MALFORMED_FEATURE);
});

Given("a grimoire project with a documented feature and a decision", function (this: GrimoireWorld) {
  this.initProject();
  this.write("features/example.feature", VALID_FEATURE);
  this.write(".grimoire/decisions/0001-use-example.md", DECISION);
});

Given(
  "a grimoire project with a file committed under a change {string}",
  function (this: GrimoireWorld, change: string) {
    this.initProject();
    this.write("src/auth.js", "export function login() { return true; }\n");
    this.git(["add", "."]);
    this.git(["commit", "-q", "-m", `feat: add login\n\nChange: ${change}`]);
  }
);

Given(
  "a grimoire project with an active change {string}",
  function (this: GrimoireWorld, change: string) {
    this.initProject();
    this.write(`.grimoire/changes/${change}/manifest.md`, manifest("implementing"));
  }
);

Given(
  "a grimoire project with an active change {string} that is partly done",
  function (this: GrimoireWorld, change: string) {
    this.initProject();
    this.write(`.grimoire/changes/${change}/manifest.md`, manifest("implementing"));
    this.write(
      `.grimoire/changes/${change}/tasks.md`,
      "# Tasks\n\n- [x] First task\n- [x] Second task\n- [ ] Third task\n"
    );
  }
);

Given(
  "a grimoire project with an active change {string} on its own branch",
  function (this: GrimoireWorld, change: string) {
    this.initProject();
    this.write("README.md", "# Demo\n");
    this.git(["add", "."]);
    this.git(["commit", "-q", "-m", "chore: baseline"]);
    this.git(["checkout", "-q", "-b", "feat/add-login"]);
    this.write(`.grimoire/changes/${change}/manifest.md`, manifest("implementing"));
    this.write("features/login.feature", VALID_FEATURE);
    this.git(["add", "."]);
    this.git(["commit", "-q", "-m", `feat: add login\n\nChange: ${change}`]);
  }
);

Given(
  "a grimoire project with a test that asserts nothing meaningful",
  function (this: GrimoireWorld) {
    this.initProject();
    this.write("weak.test.js", "test('does nothing', () => {});\n");
  }
);

Given(
  "a grimoire project with a test that makes a real assertion",
  function (this: GrimoireWorld) {
    this.initProject();
    this.write(
      "strong.test.js",
      "test('adds', () => {\n  expect(1 + 1).toBe(2);\n});\n"
    );
  }
);

// ── When: actions ──────────────────────────────────────────────────────

When("I set up grimoire in it", function (this: GrimoireWorld) {
  this.run(["init", "--no-detect"]);
});

When("I run the quality checks", function (this: GrimoireWorld) {
  this.run(["check"]);
});

When("I validate the specifications", function (this: GrimoireWorld) {
  this.run(["validate"]);
});

When("I check the project's health", function (this: GrimoireWorld) {
  this.run(["health"]);
});

When("I generate the project overview", function (this: GrimoireWorld) {
  this.run(["docs"]);
});

When("I trace that file", function (this: GrimoireWorld) {
  this.run(["trace", "src/auth.js"]);
});

When("I list the active work", function (this: GrimoireWorld) {
  this.run(["list"]);
});

When("I check the status of {string}", function (this: GrimoireWorld, change: string) {
  this.run(["status", change]);
});

When("I assess test quality", function (this: GrimoireWorld) {
  this.run(["test-quality"]);
});

When("I prepare a pull request", function (this: GrimoireWorld) {
  this.run(["pr", "add-login"]);
});

// ── Then: assertions (loose — domain outcomes, not exact output) ────────

function ran(world: GrimoireWorld, label: string): void {
  assert.ok(world.result.code !== undefined, `${label}: command did not run`);
}

Then("the project is ready for spec-driven development", function (this: GrimoireWorld) {
  ran(this, "init");
  assert.equal(this.result.code, 0, `init failed:\n${this.out}`);
  assert.ok(existsSync(join(this.dir, ".grimoire", "config.yaml")), "no config.yaml");
  assert.ok(existsSync(join(this.dir, "features")), "no features/ dir");
});

Then("it tells me what to do next", function (this: GrimoireWorld) {
  assert.match(this.out, /next step|run .*draft|getting started/i);
});

Then("I am shown which checks passed and which did not", function (this: GrimoireWorld) {
  assert.match(this.out, /pass|fail|skip/i);
});

Then("I am given an overall result", function (this: GrimoireWorld) {
  assert.match(this.out, /\d+ passed|\d+ failed|overall/i);
});

Then("I am told the specifications are well-formed", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `validate should pass:\n${this.out}`);
  assert.match(this.out, /valid|well-formed|pass|✓|no (issues|errors)/i);
});

Then("I am told which specification is malformed", function (this: GrimoireWorld) {
  assert.match(this.out, /broken\.feature|invalid|error|malformed|fail/i);
});

Then("the validation does not pass", function (this: GrimoireWorld) {
  assert.notEqual(this.result.code, 0, `validate should have failed:\n${this.out}`);
});

Then("I see how well specs and decisions are covered", function (this: GrimoireWorld) {
  assert.match(this.out, /feature/i);
  assert.match(this.out, /decision/i);
});

Then("I am given an overall health score", function (this: GrimoireWorld) {
  assert.match(this.out, /overall/i);
  assert.match(this.out, /%/);
});

Then("a browsable overview of the project is produced", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `docs failed:\n${this.out}`);
  assert.ok(
    existsSync(join(this.dir, ".grimoire", "docs", "OVERVIEW.md")),
    "OVERVIEW.md was not created"
  );
});

Then("I am shown the change that introduced it", function (this: GrimoireWorld) {
  assert.match(this.out, /add-login/);
});

Then("I see the change {string} among the work in progress", function (this: GrimoireWorld, change: string) {
  assert.match(this.out, new RegExp(change));
});

Then("I am shown how much of the change is complete", function (this: GrimoireWorld) {
  assert.match(this.out, /\d+\s*\/\s*\d+|\d+%|task/i);
});

Then("I am warned that the test is weak", function (this: GrimoireWorld) {
  assert.match(this.out, /weak|empty|no assertion|assert|issue|warn/i);
});

Then("the assessment does not pass", function (this: GrimoireWorld) {
  assert.notEqual(this.result.code, 0, `test-quality should have failed:\n${this.out}`);
});

Then("I am told the tests look sound", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `test-quality should pass:\n${this.out}`);
});

Then("a pull request description summarising the change is produced", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `pr failed:\n${this.out}`);
  assert.ok(this.out.trim().length > 20, "pr produced no description");
  assert.match(this.out, /add-login|login|summary|##/i);
});

After(function (this: GrimoireWorld) {
  this.cleanup();
});
