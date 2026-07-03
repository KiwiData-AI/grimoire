import assert from "node:assert/strict";
import { Given, When, Then, After } from "@cucumber/cucumber";
import { GrimoireWorld } from "./world.js";

type LintWorld = GrimoireWorld;

function setMode(world: LintWorld, mode: string): void {
  world.write(".grimoire/config.yaml", `version: 1\nproject:\n  comment_lint: ${mode}\n`);
}

function writeHook(world: LintWorld, toolName: string, input: Record<string, unknown>): void {
  const payload = JSON.stringify({ tool_name: toolName, tool_input: input, cwd: world.dir });
  world.run(["lint-comments", "--hook"], payload);
}

const MULTI_LINE = ["// first line of rationale", "// second line", "// third line", "const x = 1;"].join("\n");
const REF_COMMENT = "// see login.feature for the spec";

Given("a grimoire project with comment linting set to block", function (this: LintWorld) {
  this.initProject();
  setMode(this, "block");
});

Given("comment linting is set to warn", function (this: LintWorld) {
  setMode(this, "warn");
});

Given("comment linting is off", function (this: LintWorld) {
  setMode(this, "off");
});

Given("the file already contains a comment naming a feature file", function (this: LintWorld) {
  this.write("src/widget.ts", `${REF_COMMENT}\nconst y = 2;\n`);
});

When("an agent writes a multi-line comment block", function (this: LintWorld) {
  writeHook(this, "Edit", { file_path: "src/widget.ts", new_string: MULTI_LINE });
});

When("an agent writes a comment naming a feature file or decision id", function (this: LintWorld) {
  writeHook(this, "Edit", { file_path: "src/widget.ts", new_string: `${REF_COMMENT}\nconst x = 1;` });
});

When("an agent writes a truncated marker such as {string}", function (this: LintWorld, marker: string) {
  writeHook(this, "Edit", { file_path: "src/widget.ts", new_string: `// ... ${marker}\n` });
});

When("an agent edits an unrelated line in that file", function (this: LintWorld) {
  writeHook(this, "Edit", { file_path: "src/widget.ts", new_string: "const y = 3;" });
});

When("an agent rewrites the whole file keeping that comment and adding a clean line", function (this: LintWorld) {
  writeHook(this, "Write", { file_path: "src/widget.ts", content: `${REF_COMMENT}\nconst y = 2;\nconst z = 9;\n` });
});

When("an agent inserts a comment naming a feature file via a multi-edit", function (this: LintWorld) {
  writeHook(this, "MultiEdit", { file_path: "src/widget.ts", edits: [{ new_string: REF_COMMENT }] });
});

When("an agent writes an external-artifact comment marked with the override pragma", function (this: LintWorld) {
  writeHook(this, "Edit", { file_path: "src/widget.ts", new_string: `${REF_COMMENT} grimoire-lint-ok\nconst x = 1;` });
});

Then("the write is rejected", function (this: LintWorld) {
  assert.equal(this.result.code, 2, `expected denial (exit 2), got ${this.result.code}\n${this.out}`);
});

Then("the write is accepted", function (this: LintWorld) {
  assert.equal(this.result.code, 0, `expected acceptance (exit 0), got ${this.result.code}\n${this.out}`);
});

Then("the agent is shown the offending line", function (this: LintWorld) {
  assert.match(this.result.stderr, /(external_ref|placeholder_stub)/, `expected a named rule finding, got:\n${this.out}`);
  assert.match(this.result.stderr, /(L\d+|inserted line \d+)/, `expected an offending line reference, got:\n${this.out}`);
});

Then("nothing is reported", function (this: LintWorld) {
  assert.equal(this.result.stderr.trim(), "", `expected no report, got:\n${this.out}`);
});

After(function (this: LintWorld) {
  this.cleanup();
});
