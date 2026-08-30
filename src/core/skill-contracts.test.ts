import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const skill = (name: string) =>
  readFile(resolve("skills", name, "SKILL.md"), "utf-8");

const reference = (name: string) =>
  readFile(resolve("skills", "references", name), "utf-8");

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

  it("keeps slice tasks incomplete until approval", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "If `slice-after` is pending, keep every covered support and production task unchecked until the user approves the verified slice.",
      "Approval records `slice-after=approved`, marks the covered tasks `[x]`, and prevents this checkpoint from recurring.",
      "A covered paired task with pending `slice-after` is not eligible until slice approval.",
    ]);
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
