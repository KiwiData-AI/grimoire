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
  it("keeps paired dispatch patch-only", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expect(applySkill).toContain("may edit support files only");
    expect(applySkill).toContain("must not edit production files");
    expect(applySkill).toContain("exact unified production patch");
  });

  it("limits checkpoints to paired sections in planning and execution", async () => {
    const [applySkill, planSkill] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      skill("grimoire-plan").then(normalize),
    ]);

    expect(planSkill).toContain(
      "Only paired sections may declare `structure-before` or `slice-after`.",
    );
    expect(planSkill).toContain(
      "Autonomous sections always declare `checkpoints: none`.",
    );
    expect(applySkill).toContain(
      "Only a section whose approved execution is `paired` may declare checkpoints.",
    );
    expect(applySkill).toContain(
      "An approved autonomous section must declare `checkpoints: none`; stop, report invalid approved metadata, and await user direction before changing `tasks.md` or dispatching.",
    );
  });

  it("includes valid execution metadata in every planner example", async () => {
    const planSkill = await skill("grimoire-plan");

    for (const section of [
      "1\\. <Capability\\/Area>",
      "2\\. Constraints",
      "3\\. Shared Steps",
      "4\\. Architecture",
    ]) {
      expect(planSkill).toMatch(
        new RegExp(
          `## ${section}[\\s\\S]*?<!-- execution: (paired|autonomous) -->\\s*<!-- checkpoints: (none|structure-before|slice-after|structure-before,slice-after) -->`,
        ),
      );
    }
  });

  it("records eligible task progress before section reconciliation", async () => {
    const [agents, applySkill, planSkill, design, decision] = await Promise.all([
      rootFile("AGENTS.md").then(normalize),
      skill("grimoire-apply").then(normalize),
      skill("grimoire-plan").then(normalize),
      rootFile("docs/design/adaptive-pair-programming.md").then(normalize),
      rootFile(".grimoire/decisions/0043-adaptive-pair-programming.md").then(normalize),
    ]);

    for (const policy of [agents, applySkill, planSkill, design, decision]) {
      expect(policy).toContain(
        "Mark each task `[x]` as soon as focused verification passes and every pending checkpoint requirement for that task is approved or waived.",
      );
      expect(policy).toContain(
        "Keep task descriptions and affected later sections unchanged until every task in the section is complete and every declared checkpoint is approved or waived.",
      );
    }

    for (const staleGuidance of [
      "keep the section tasks unchecked until section reconciliation",
      "Keep every task in the active section unchecked until all tasks are verified",
      "keeps section tasks unchecked until reconciliation",
      "mark every section task complete",
      "keep the task unchecked until section reconciliation",
      "mark the section tasks complete",
      "mark the section's tasks complete",
    ]) {
      expect(applySkill).not.toContain(staleGuidance);
    }
    expect(applySkill).toContain("Size one section to one context.");
    expect(applySkill).not.toContain("Size one task to one context.");
    expect(applySkill).toContain(
      "Mark each task [x] only after focused verification passes and every pending checkpoint requirement for that task is approved or waived.",
    );
  });

  it("revises rejected paired work at the correct boundary", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "A rejected patch leaves production files unchanged and retains the failing test as revision evidence.",
      "Give the rejection feedback to a fresh section agent and redispatch the same increment.",
      "Rejection keeps the provisional production slice applied and keeps its tasks unchecked.",
      "Do not roll back the slice or require the paired agent to edit production files.",
      "The agent may revise support files.",
      "Run revised or retained support evidence against the current provisional production slice and confirm it fails before returning an unapplied corrective production patch.",
      "present the corrected slice at the same pending checkpoint.",
    ]);
    expect(
      applySkill.match(
        /Run revised or retained support evidence against the current provisional production slice and confirm it fails before returning an unapplied corrective production patch\./g,
      ),
    ).toHaveLength(2);
  });

  it("defines the structure-before lifecycle once", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expect(applySkill.match(/Approval records `structure-before=approved`/g)).toHaveLength(1);
    expect(applySkill.match(/Keep it pending when rejected/g)).toHaveLength(1);
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

  it("applies only user-directed drift and reconciles it after the section", async () => {
    const [agents, applySkill, planSkill] = await Promise.all([
      rootFile("AGENTS.md").then(normalize),
      skill("grimoire-apply").then(normalize),
      skill("grimoire-plan").then(normalize),
    ]);

    for (const policy of [agents, applySkill, planSkill]) {
      expect(policy).toContain(
        "The approved section outcome and source artifacts remain authoritative; implementation mechanics are correctable details.",
      );
      expect(policy).toContain(
        "Apply user-directed active-section corrections without evaluating the guidance or updating planning artifacts after each correction.",
      );
      expect(policy).toContain(
        "An agent must ask for user direction before changing implementation direction; agents never create active-section drift autonomously.",
      );
    }

    expectOrdered(applySkill, [
      "Keep only short drift notes needed by later work.",
      "Keep task descriptions and affected later sections unchanged until every task in the section is complete and every declared checkpoint is approved or waived.",
      "After the whole section is final",
      "update the completed section's task descriptions and every affected later section once",
      "identify remaining planning gaps without relitigating applied user guidance",
      "clear the section's drift notes",
      "continue to the next section",
    ]);
  });

  it("gives paired and autonomous dispatch the same drift rule", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));
    const dispatchRule =
      "Only user direction may create active-section implementation drift. Apply that direction without evaluating it or maintaining planning artifacts mid-section; otherwise ask the user before changing implementation direction.";

    expect(applySkill.match(new RegExp(dispatchRule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(
      2,
    );
    expect(applySkill).toContain(
      "Do not stop merely because user-directed implementation mechanics differ from the task details.",
    );
  });

  it("keeps drift reconciliation lightweight and persistence corrections ordinary", async () => {
    const [applySkill, learnings, reviewSkill, reviewPolicy, design] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      rootFile("templates/learnings.md").then(normalize),
      skill("grimoire-review").then(normalize),
      reference("review-personas.md").then(normalize),
      rootFile("docs/design/adaptive-pair-programming.md").then(normalize),
    ]);

    expect(learnings).toContain("## Active-section drift notes");
    expect(learnings).toContain("Clear these notes after post-section reconciliation.");
    expect(applySkill).toContain(
      "User-directed model, persistence, and migration mechanics are ordinary implementation corrections.",
    );
    expect(reviewSkill).toContain(
      "User-directed data-schema, model, persistence, or migration implementation mechanics alone do not trigger another persona review when no reviewed boundary, including the data schema, materially changes.",
    );
    expect(reviewPolicy).toContain(
      "User-directed data-schema, model, persistence, or migration implementation mechanics alone do not trigger another persona review when no reviewed boundary, including the data schema, materially changes.",
    );
    expect(design).toContain(
      "Reconcile once after the whole section is final.",
    );
    expect(design).toContain(
      "Post-section gap review may identify remaining gaps but must not reopen applied user guidance.",
    );
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

  it("adds no drift checkpoint, report, approval, or persona rerun", async () => {
    const [applySkill, planSkill, reviewPolicy] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      skill("grimoire-plan").then(normalize),
      reference("review-personas.md").then(normalize),
    ]);

    for (const policy of [applySkill, planSkill]) {
      expect(policy).toContain(
        "Section reconciliation adds no drift checkpoint, report, reconciliation approval, or persona rerun.",
      );
    }
    expect(reviewPolicy).toContain(
      "Post-section drift reconciliation never requires a persona rerun or reconciliation approval.",
    );
  });

  it("derives and topologically orders executable section dependencies", async () => {
    const planSkill = await skill("grimoire-plan");
    const normalizedPlan = normalize(planSkill);

    expectOrdered(normalizedPlan, [
      "Derive the actual section dependency graph",
      "Topologically sort the sections",
      "Use the technical spine only as a tie-breaker among independent sections.",
      "Within each section, order tasks so no task requires a later task.",
    ]);
    expect(normalizedPlan).toContain(
      "referenced symbols, imports, schema and migration prerequisites, generated artifacts, fixtures, routes, and context files",
    );
    expect(normalizedPlan).toContain("<!-- depends-on: none | <earlier section IDs> -->");
    expect(normalizedPlan).toContain("| Section | Depends on | Execution | Checkpoints | Reason |");

    for (const section of [
      "1\\. <Capability\\/Area>",
      "2\\. Constraints",
      "3\\. Shared Steps",
      "4\\. Architecture",
    ]) {
      expect(planSkill).toMatch(
        new RegExp(`## ${section}[\\s\\S]*?<!-- depends-on: (none|<earlier section IDs>) -->`),
      );
    }
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

  it("validates dependencies and autonomous compatibility before dispatch", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "Before dispatching any section, validate the complete plan",
      "every declared dependency section is complete",
      "dispatch the section",
    ]);
    expect(applySkill).toContain(
      "missing dependency metadata, unknown or forward dependencies, cycles, incomplete dependencies, or human-gate tasks in autonomous sections",
    );
    expect(applySkill).toContain(
      "Report every plan error together and stop without editing, reordering, or repairing `tasks.md`.",
    );
  });

  it("checks executable ordering during the initial design-review pass", async () => {
    const reviewSkill = normalize(await skill("grimoire-review"));

    expect(reviewSkill).toContain(
      "In the initial single pass, check dependency completeness, backward-only order, cycle freedom, and autonomous compatibility.",
    );
    expect(reviewSkill).toContain(
      "Treat an invalid dependency graph or an intermediate human gate in autonomous work as a blocker.",
    );
  });
});
