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
  this.run(["check", "--json"]);
});

When("I validate the specifications", function (this: GrimoireWorld) {
  this.run(["validate", "--json"]);
});

When("I check the project's health", function (this: GrimoireWorld) {
  this.run(["health", "--json"]);
});

When("I generate the project overview", function (this: GrimoireWorld) {
  this.run(["docs"]);
});

When("I trace that file", function (this: GrimoireWorld) {
  this.run(["trace", "src/auth.js", "--json"]);
});

When("I list the active work", function (this: GrimoireWorld) {
  this.run(["list", "--json"]);
});

When("I check the status of {string}", function (this: GrimoireWorld, change: string) {
  this.run(["status", change, "--json"]);
});

When("I assess test quality", function (this: GrimoireWorld) {
  this.run(["test-quality", "--json"]);
});

When("I prepare a pull request", function (this: GrimoireWorld) {
  this.run(["pr", "add-login", "--json"]);
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
  const { results, summary } = this.json<{
    results: Array<{ step: string; status: string }>;
    summary: { passed: number; failed: number; skipped: number; errored: number };
  }>();
  assert.ok(Array.isArray(results) && results.length > 0, "no checks were reported");
  for (const r of results) {
    assert.match(r.status, /^(pass|fail|skip|error)$/, `unexpected status: ${r.status}`);
  }
  // Every reported check is accounted for in exactly one summary bucket.
  const counted = summary.passed + summary.failed + summary.skipped + summary.errored;
  assert.equal(counted, results.length, "summary counts do not match reported checks");
});

Then("I am given an overall result", function (this: GrimoireWorld) {
  const { summary } = this.json<{
    summary: { passed: number; failed: number; skipped: number; errored: number };
  }>();
  for (const k of ["passed", "failed", "skipped", "errored"] as const) {
    assert.equal(typeof summary[k], "number", `summary.${k} is not a number`);
  }
  // Exit code agrees with the failure count.
  assert.equal(this.result.code === 0, summary.failed + summary.errored === 0);
});

Then("I am told the specifications are well-formed", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `validate should pass:\n${this.out}`);
  // validate only emits an entry for a file that has problems, so a clean
  // project reports none. Assert nothing was flagged as malformed.
  const results = this.json<Array<{ file: string; errors: string[] }>>();
  const flagged = results.filter((r) => r.errors.length > 0);
  assert.equal(flagged.length, 0, `unexpected errors: ${flagged.map((r) => r.file).join(", ")}`);
});

Then("I am told which specification is malformed", function (this: GrimoireWorld) {
  const results = this.json<Array<{ file: string; errors: string[] }>>();
  const bad = results.find((r) => r.errors.length > 0);
  assert.ok(bad, "no malformed specification was reported");
  assert.match(bad.file, /broken\.feature$/, `wrong file flagged: ${bad.file}`);
});

Then("the validation does not pass", function (this: GrimoireWorld) {
  assert.notEqual(this.result.code, 0, `validate should have failed:\n${this.out}`);
});

Then("I see how well specs and decisions are covered", function (this: GrimoireWorld) {
  const { metrics } = this.json<{ metrics: Array<{ name: string; score: number | null }> }>();
  const names = metrics.map((m) => m.name.toLowerCase());
  assert.ok(names.some((n) => n.includes("feature")), "no feature coverage metric");
  assert.ok(names.some((n) => n.includes("decision")), "no decision coverage metric");
});

Then("I am given an overall health score", function (this: GrimoireWorld) {
  const { overall } = this.json<{ overall: number }>();
  assert.equal(typeof overall, "number", "overall score is not a number");
  assert.ok(overall >= 0 && overall <= 100, `overall score out of range: ${overall}`);
});

Then("a browsable overview of the project is produced", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `docs failed:\n${this.out}`);
  assert.ok(
    existsSync(join(this.dir, ".grimoire", "docs", "OVERVIEW.md")),
    "OVERVIEW.md was not created"
  );
});

Then("I am shown the change that introduced it", function (this: GrimoireWorld) {
  const { changes, commits } = this.json<{
    changes: Array<{ changeId: string }>;
    commits: Array<{ changeId?: string }>;
  }>();
  const ids = [...changes.map((c) => c.changeId), ...commits.map((c) => c.changeId)];
  assert.ok(ids.includes("add-login"), `change add-login not traced; got ${ids.join(", ")}`);
});

Then("I see the change {string} among the work in progress", function (this: GrimoireWorld, change: string) {
  const { changes } = this.json<{ changes: Array<{ id: string }> }>();
  assert.ok(
    changes.some((c) => c.id === change),
    `change ${change} not listed; got ${changes.map((c) => c.id).join(", ")}`
  );
});

Then("I am shown how much of the change is complete", function (this: GrimoireWorld) {
  const { artifacts } = this.json<{
    artifacts: { tasks: { total: number; completed: number } | null };
  }>();
  assert.ok(artifacts.tasks, "no task progress reported");
  // Fixture has 2 of 3 tasks checked off.
  assert.equal(artifacts.tasks.total, 3, "wrong task total");
  assert.equal(artifacts.tasks.completed, 2, "wrong completed count");
});

Then("I am warned that the test is weak", function (this: GrimoireWorld) {
  const { issues, summary } = this.json<{
    issues: Array<{ file: string; severity: string }>;
    summary: { critical: number; warning: number };
  }>();
  assert.ok(summary.critical + summary.warning > 0, "no weak-test issue was raised");
  assert.ok(
    issues.some((i) => /weak\.test\.js$/.test(i.file)),
    "the weak test file was not among the issues"
  );
});

Then("the assessment does not pass", function (this: GrimoireWorld) {
  assert.notEqual(this.result.code, 0, `test-quality should have failed:\n${this.out}`);
});

Then("I am told the tests look sound", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `test-quality should pass:\n${this.out}`);
  const { summary } = this.json<{ summary: { critical: number } }>();
  assert.equal(summary.critical, 0, "a sound suite should report no critical issues");
});

Then("a pull request description summarising the change is produced", function (this: GrimoireWorld) {
  assert.equal(this.result.code, 0, `pr failed:\n${this.out}`);
  const { title, body, changeId } = this.json<{ title: string; body: string; changeId: string }>();
  assert.equal(changeId, "add-login", "wrong change id on the PR");
  assert.ok(title.trim().length > 0, "PR has no title");
  assert.match(body, /login/i, "PR body does not mention the change");
});

After(function (this: GrimoireWorld) {
  this.cleanup();
});
