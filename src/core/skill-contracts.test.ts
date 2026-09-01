import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const skill = (name: string) =>
  readFile(resolve("skills", name, "SKILL.md"), "utf-8");

const reference = (name: string) =>
  readFile(resolve("skills", "references", name), "utf-8");

const rootFile = (name: string) => readFile(resolve(name), "utf-8");

const normalize = (content: string) => content.replace(/\s+/g, " ").trim();

function expectOrdered(content: string, clauses: string[]): void {
  let previous = -1;
  for (const clause of clauses) {
    const current = content.indexOf(clause, previous + 1);
    expect(current, `Missing ordered clause: ${clause}`).toBeGreaterThan(previous);
    previous = current;
  }
}

describe("skill contracts", () => {
  it("plans substantial sections with explicit review timing", async () => {
    const [planSkill, reviewSkill] = await Promise.all([
      skill("grimoire-plan").then(normalize),
      skill("grimoire-review").then(normalize),
    ]);

    expect(planSkill).toContain("Default to one substantial implementation section.");
    expect(planSkill).toContain(
      "Use a second section only for a distinct outcome or context boundary.",
    );
    expect(planSkill).toContain(
      "Every section beyond two requires a specific outcome, dependency, or context-boundary justification.",
    );
    expect(planSkill).toContain(
      "Extend an existing feature only for clear actor-visible behavior.",
    );
    expect(planSkill).toContain("A change may require no Gherkin edits.");
    expect(planSkill).toContain(
      "Internal nuances, refactors, and optimizations use unit, characterization, contract, benchmark, constraint, or ADR verification.",
    );
    expect(planSkill).toContain(
      "Every implementation activity checkbox declares `<!-- review: structure-before -->` or `<!-- review: slice-after -->` immediately beneath it.",
    );
    expect(planSkill).toContain(
      "Each checkbox contains the test change, production change, and one exact tactical command used for red and green.",
    );
    expect(planSkill).toContain(
      "The tactical command selects only new or changed tests and uses only a runner accelerator verified from project configuration or existing commands.",
    );
    expect(planSkill).not.toContain("## 5. Verification");
    expect(planSkill).not.toContain("<!-- execution: paired -->");
    expect(planSkill).not.toContain("paired patch");

    expect(reviewSkill).toContain("Validate activity-level review timing");
    expect(reviewSkill).toContain("one or two substantial implementation sections");
    expect(reviewSkill).toContain("exact tactical red-green command");
    expect(reviewSkill).toContain("manufactured Gherkin");
  });

  it("uses tactical red-green tests and adapts user steering", async () => {
    const [applySkill, agents, learnings] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      rootFile("AGENTS.md").then(normalize),
      rootFile("templates/learnings.md").then(normalize),
    ]);

    expectOrdered(applySkill, [
      "Run every configured test suite once before code changes and record `baseline.md`.",
      "Read the task's exact tactical red-green command.",
      "Run that command before production changes.",
      "Run the same command after production changes.",
      "Invoke `grimoire-verify` once after every implementation activity is complete.",
    ]);
    expect(applySkill).toContain(
      "Red is proven only when the selected test fails because the requested behavior is absent.",
    );
    expect(applySkill).toContain(
      "Collection, import, fixture, syntax, and infrastructure failures do not prove red.",
    );
    expect(applySkill).toContain(
      "A `structure-before` activity pauses once for production-shape approval, then proceeds with direct autonomous implementation.",
    );
    expect(applySkill).toContain(
      "A `slice-after` activity proceeds with direct autonomous implementation and no intermediate gate.",
    );
    expect(applySkill).toContain("Start a fresh implementation context for each substantial section.");
    expect(applySkill).toContain("Task checkboxes are the resume state.");
    expect(applySkill).toContain(
      "Record one implementation lesson only when the correction changes remaining work.",
    );
    expect(applySkill).toContain("Update only affected unchecked tasks.");
    expect(applySkill).toContain("Rerun affected tactical tests.");
    expect(applySkill).toContain(
      "Do not add a checkpoint, report, approval, persona rerun, or plan-wide reconciliation.",
    );
    expect(applySkill).not.toContain("checkpoint-state");
    expect(applySkill).not.toContain("exact unified production patch");
    expect(learnings).toContain("## Implementation lessons");
    expect(learnings).not.toContain("## Active-section drift notes");
    expect(agents).toContain("Record one implementation lesson only when remaining work changes.");
    expect(agents).toContain("Update only affected unchecked tasks");
  });

  it("verify invokes precommit review before final suites", async () => {
    const [applySkill, verifySkill, precommitSkill] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      skill("grimoire-verify").then(normalize),
      skill("grimoire-precommit-review").then(normalize),
    ]);

    expectOrdered(applySkill, [
      "Run every configured test suite once before code changes and record `baseline.md`.",
      "Read the task's exact tactical red-green command.",
      "Invoke `grimoire-verify` once after every implementation activity is complete.",
    ]);
    expectOrdered(verifySkill, [
      "Run `grimoire validate`.",
      "Run existing Grimoire-specific static verification.",
      "Run configured deterministic non-test checks by explicit step name.",
      "Invoke `grimoire-precommit-review` once over the complete diff.",
      "Rerun only affected tactical tests and applicable deterministic checks.",
      "Run each configured unit and BDD suite once.",
      "Compare every failure with `baseline.md`.",
    ]);
    expect(verifySkill).toContain(
      "Do not run the LLM-backed `best_practices` check separately.",
    );
    expect(verifySkill).toContain("Select only personas relevant to the change surface.");
    expect(precommitSkill).toContain("single general code and best-practice review");
    expect(precommitSkill).toContain("one accepted correction batch");
    expect(applySkill).not.toContain("Run the BDD test suite");
  });

  it("documents the streamlined implementation lifecycle", async () => {
    const [readme, design, skillsDoc, featuresDoc, oldDecision, newDecision] =
      await Promise.all([
        rootFile("README.md").then(normalize),
        rootFile("docs/design/adaptive-pair-programming.md").then(normalize),
        rootFile(".grimoire/docs/skills.md").then(normalize),
        rootFile(".grimoire/docs/features.md").then(normalize),
        rootFile(".grimoire/decisions/0043-adaptive-pair-programming.md").then(normalize),
        rootFile(".grimoire/decisions/0044-plan-review-timing-and-verification.md").then(normalize),
      ]);

    for (const doc of [readme, design, skillsDoc]) {
      expect(doc).toContain("substantial sections");
      expect(doc).toContain("activity-level review timing");
      expect(doc).toContain("tactical red-green");
      expect(doc).toContain("one `grimoire-verify` procedure");
      expect(doc).toContain("one pre-commit review");
      expect(doc).toContain("one final suite run");
      expect(doc).toContain("harness-level per-file review");
    }

    expect(readme).toContain("Clear actor-visible behavior → Gherkin");
    expect(readme).toContain("Architectural trade-off → MADR decision");
    expect(readme).toContain(
      "Internal optimization, refactor, configuration, or implementation detail → appropriate test or check",
    );
    expect(readme).not.toContain("Your request → Gherkin spec");
    expect(readme).not.toContain("## 1. Data Layer");
    expect(readme).not.toContain("## 3. Error Cases");
    expect(readme).not.toContain("## 4. Verification");

    expect(featuresDoc).toContain("Gherkin is optional");
    expect(featuresDoc).toContain("Prefer extending an existing feature");
    expect(featuresDoc).toContain(
      "Implementation nuances without clear actor-visible behavior do not belong in Gherkin.",
    );
    expect(oldDecision).toContain("status: superseded by 0044");
    expect(newDecision).toContain("This decision supersedes [0043].");
  });

  it("keeps internal changes and review state lightweight", async () => {
    const [planSkill, reviewSkill, applySkill, agents, readme, skillsDoc] =
      await Promise.all([
        skill("grimoire-plan").then(normalize),
        skill("grimoire-review").then(normalize),
        skill("grimoire-apply").then(normalize),
        rootFile("AGENTS.md").then(normalize),
        rootFile("README.md").then(normalize),
        rootFile(".grimoire/docs/skills.md").then(normalize),
      ]);

    for (const workflowSkill of [reviewSkill, applySkill]) {
      expect(workflowSkill).toContain("`manifest.md`");
      expect(workflowSkill).toContain("`tasks.md`");
      expect(workflowSkill).toContain(
        "Feature, constraint, and decision artifacts are optional.",
      );
    }
    expect(reviewSkill).toContain(
      "User has a planned Grimoire change with an approved manifest and tasks",
    );

    for (const gate of [
      "An external actor initiates or participates in the behavior.",
      "The outcome is observable outside the implementation.",
      "The scenario uses domain language instead of code structure.",
      "The behavior survives a reimplementation.",
    ]) {
      expect(agents).toContain(gate);
    }
    expect(agents).toContain(
      "Internal optimization, refactoring, configuration, and implementation work use appropriate tests or checks and may have no Gherkin.",
    );
    expect(agents).not.toContain(
      "If the request is expressible as Given/When/Then, it's a Gherkin feature.",
    );
    expect(agents).not.toContain("plan projects the .feature");

    expect(readme).toContain(
      "→ /grimoire:apply Implements tactically, then runs verification once",
    );
    expect(readme).not.toContain("→ /grimoire:verify");
    expect(skillsDoc).not.toContain("apply → verify → precommit-review");
    expect(skillsDoc).toContain(
      "`grimoire-precommit-review` remains available standalone and is invoked inside `grimoire-verify` during apply.",
    );

    expect(applySkill).toContain(
      "Record `<!-- review-status: approved -->` immediately below the activity's review marker after approval.",
    );
    expect(applySkill).toContain(
      "When that approval marker already exists, skip the structure review on resume.",
    );
    expect(planSkill).not.toContain("review-status: approved");
  });

  it("requires only the Change trailer for ordinary mid-process commits", async () => {
    const [applySkill, commitSkill] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      skill("grimoire-commit").then(normalize),
    ]);

    expect(commitSkill).toContain(
      "Ordinary mid-process commits require only `Change:` among review-related trailers.",
    );
    expect(applySkill).toContain(
      "Each requires `Change: <change-id>` and does not require final production review or its trailer.",
    );
  });

  it("requires a durable current-identity commit before cleanup", async () => {
    const [applySkill, commitSkill] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      skill("grimoire-commit").then(normalize),
    ]);

    expectOrdered(applySkill, [
      "Verify branch history contains at least one ordinary commit whose body has `Change: <change-id>`.",
      "The qualifying commit must contain durable verified work only and must contain no path under `.grimoire/changes/<change-id>/`.",
      "Remove `.grimoire/changes/<change-id>/`, including its design, manifest, tasks, baseline, data delta, and working-memory files.",
    ]);
    expect(commitSkill).toContain(
      "That commit contains durable verified work only and no active change-folder scaffolding.",
    );
  });

  it("deletes ephemeral state before documentation and stages one durable index", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "Record every deferred task in `.grimoire/docs/debt-register.yml`.",
      "Remove `.grimoire/changes/<change-id>/`, including its design, manifest, tasks, baseline, data delta, and working-memory files.",
      "Run `grimoire docs` after removal.",
      "Stage the complete intended durable final state in the ordinary Git index.",
      "Run the applicable post-cleanup health checks",
      "Run §6a once.",
      "Immediately create one final commit from the reviewed index",
    ]);
  });

  it("reviews the complete index immediately before one final commit", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      'git diff --cached --name-status "$(git merge-base <target-branch> HEAD)"',
      "Group every listed path under `Production` or `Support`.",
      "Exclude nothing from approval.",
      'git diff --cached "$(git merge-base <target-branch> HEAD)"',
      "Require explicit user approval of the complete staged path list and full merge-base-to-index diff.",
      "Approval covers both production and support paths.",
      "On approval, immediately create one final commit from the reviewed index.",
      "Do not edit or restage between approval and commit.",
    ]);
    expect(applySkill).toContain("Unrelated pre-staged work blocks finalization");
  });

  it("accepts related change IDs while requiring a Change line per commit", async () => {
    const [healthCheck, prSkill] = await Promise.all([
      reference("health-check.md").then(normalize),
      skill("grimoire-pr").then(normalize),
    ]);

    expect(healthCheck).toContain(
      "Every non-merge branch commit body contains at least one `Change:` line; related change IDs may differ between commits",
    );
    expect(prSkill).toContain(
      "If multiple IDs are candidates, require the user to select the PR change ID explicitly.",
    );
  });

  it("uses no synthetic final-review state", async () => {
    const skills = await Promise.all([
      skill("grimoire-apply"),
      skill("grimoire-commit"),
      skill("grimoire-pr"),
    ]);
    const workflow = skills.join("\n");

    for (const obsoleteState of [
      "final-production-review.diff",
      "final-production-review.md",
      "SHA-256 digest",
      "approval_ref",
      "refs/grimoire",
      "git worktree",
    ]) {
      expect(workflow).not.toContain(obsoleteState);
    }
    expect(normalize(workflow)).toContain(
      "Use no review snapshot, digest, synthetic ref, synthetic index, review worktree, or cleanup-only commit.",
    );
  });

  it("generates PR content after cleanup from Git and live artifacts", async () => {
    const prSkill = normalize(await skill("grimoire-pr"));

    expectOrdered(prSkill, [
      "If the selected change folder exists, execute `grimoire-apply` §7.",
      "After cleanup and the final commit, run the post-cleanup and finalized-change checks",
      "Run `grimoire pr <change-id>` after cleanup.",
      "It derives the title, summary, scenarios, decisions, test plan, and trace footer from branch commits, trailers, and changed live features and decisions.",
    ]);
  });

  it("runs one review and one accepted correction batch", async () => {
    const [reviewPolicy, designReview, precommitReview] = await Promise.all([
      reference("review-personas.md").then(normalize),
      skill("grimoire-review").then(normalize),
      skill("grimoire-precommit-review").then(normalize),
    ]);

    expect(reviewPolicy).toContain("Run the selected personas once against one complete candidate.");
    expect(reviewPolicy).toContain("Apply all accepted blockers in one correction batch.");
    expect(reviewPolicy).toContain("Do not rerun the persona review merely because its findings were corrected.");
    expect(designReview).toContain("Run one persona review and one accepted correction batch.");
    expect(precommitReview).toContain("Do not rerun this review unless §2e's material-change trigger applies.");
  });

  it("uses deterministic gates after review corrections", async () => {
    const reviewPolicy = normalize(await reference("review-personas.md"));

    expect(reviewPolicy).toContain("deterministic gates are the final readiness authority");
    expect(reviewPolicy).toContain("Fix a failing deterministic gate and rerun that gate.");
    expect(reviewPolicy).toContain("Do not convert that retry into another open-ended LLM review.");
  });

  it("allows user-directed test corrections without weakening red-green", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "When the user corrects an implementation-specific test expectation, update the test before changing production code.",
      "Run the corrected test against the current production code and confirm it fails.",
      "Only then change production code to make the corrected test pass.",
    ]);
    expect(applySkill).toContain(
      "An agent must never weaken or delete a test without explicit user direction.",
    );
    expect(applySkill).not.toContain(
      "If a test genuinely encodes the wrong expectation, that is a spec problem — STOP and go back to draft",
    );
  });

  it("keeps data-schema changes material with a narrow mechanics exception", async () => {
    const [reviewSkill, reviewPolicy] = await Promise.all([
      skill("grimoire-review").then(normalize),
      reference("review-personas.md").then(normalize),
    ]);
    const mechanicsException =
      "User-directed data-schema, model, persistence, or migration implementation mechanics alone do not trigger another persona review when no reviewed boundary, including the data schema, materially changes.";

    expect(reviewSkill).toContain(
      "Do not rerun personas unless scope, architecture, trust boundaries, data schemas, public APIs, acceptance criteria, or production entry points materially changed.",
    );
    expect(reviewPolicy).toContain(
      "Run a new persona review only when the correction batch materially changes at least one reviewed boundary: scope, architecture, trust boundary, data schema, public API, user-visible acceptance criteria, or production entry point.",
    );
    expect(reviewSkill).toContain(mechanicsException);
    expect(reviewPolicy).toContain(mechanicsException);
    expect(reviewPolicy).not.toContain(
      "User-directed data-schema, model, persistence, or migration mechanics alone are not material changes.",
    );
  });

  it("derives and topologically orders executable section dependencies", async () => {
    const planSkill = await skill("grimoire-plan");
    const normalizedPlan = normalize(planSkill);

    expectOrdered(normalizedPlan, [
      "derive the actual section dependency graph",
      "Topologically sort the sections.",
      "Use the technical spine only as a tie-breaker among independent sections.",
      "Within each section, order tasks so no task requires a later task.",
    ]);
    expect(normalizedPlan).toContain(
      "referenced symbols, imports, schema and migration prerequisites, generated artifacts, fixtures, routes, and context files",
    );
    expect(normalizedPlan).toContain("<!-- depends-on: none | <earlier section IDs> -->");
    expect(normalizedPlan).toContain(
      "| Section | Depends on | Activities | Review timing | Section justification |",
    );
    expect(planSkill).toMatch(
      /## 1\. <Capability outcome>[\s\S]*?<!-- depends-on: none -->/,
    );
  });

  it("blocks approval for invalid dependency graphs in one report", async () => {
    const planSkill = normalize(await skill("grimoire-plan"));

    expect(planSkill).toContain("A dependency may reference only an earlier section ID.");
    expect(planSkill).toContain("unknown section IDs, forward dependencies, and cycles");
    expect(planSkill).toContain("Report all dependency errors together and block plan approval.");
  });

  it("keeps autonomous implementation free of human gates", async () => {
    const planSkill = normalize(await skill("grimoire-plan"));

    expect(planSkill).toContain(
      "Autonomous sections contain no human approval, manual inspection, ask-the-user, or wait tasks.",
    );
    expect(planSkill).toContain(
      "Convert verification to deterministic commands or agent-executable tools.",
    );
    expectOrdered(planSkill, [
      "one terminal `External acceptance` section",
      "after all implementation and verification sections",
      "state that the plan is not autonomous end-to-end",
      "obtain agreement during plan approval",
    ]);
    expect(planSkill).toContain("No human gate may interrupt implementation.");
  });

  it("validates dependencies before substantial-section dispatch", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "Validate every section dependency before dispatch.",
      "Confirm every dependency section is complete before starting the next section.",
      "Report all dependency errors together and stop without rewriting the approved plan.",
    ]);
  });

  it("checks executable ordering during the initial design-review pass", async () => {
    const reviewSkill = normalize(await skill("grimoire-review"));

    expect(reviewSkill).toContain(
      "When multiple sections exist, check dependency completeness, backward-only order, cycle freedom, and task order.",
    );
    expect(reviewSkill).toContain(
      "Treat an invalid dependency graph or an intermediate human gate in implementation work as a blocker.",
    );
  });
});
