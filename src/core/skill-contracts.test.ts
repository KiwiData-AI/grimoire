import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

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
  const activeWorkflowFiles = [
    "AGENTS.md",
    "README.md",
    "skills/grimoire-draft/SKILL.md",
    "skills/grimoire-plan/SKILL.md",
    "skills/grimoire-review/SKILL.md",
    "skills/grimoire-apply/SKILL.md",
    "skills/grimoire-verify/SKILL.md",
    "skills/grimoire-pr/SKILL.md",
    "skills/grimoire-remove/SKILL.md",
    "skills/grimoire-audit/SKILL.md",
    "skills/grimoire-refactor/SKILL.md",
    "skills/grimoire-bug/SKILL.md",
    "skills/grimoire-bug-triage/SKILL.md",
    "skills/grimoire-pr-review/SKILL.md",
    "skills/grimoire-precommit-review/SKILL.md",
    "skills/grimoire-discover/SKILL.md",
    "skills/references/artifact-map.md",
    "skills/references/health-check.md",
    "skills/references/pattern-guard.md",
    "skills/references/review-personas.md",
    "skills/references/refactor-scan-categories.md",
    "skills/references/testing-lifecycle.md",
    "skills/references/testing-contracts.md",
    "templates/constraints.md",
    "templates/learnings.md",
  ];

  const readActiveWorkflow = () =>
    Promise.all(activeWorkflowFiles.map((name) => rootFile(name).then(normalize)));

  it("keeps active workflow guidance on one live-artifact lifecycle", async () => {
    const [files, draftSkill, planSkill, applySkill, verifySkill, prSkill] =
      await Promise.all([
        readActiveWorkflow(),
        skill("grimoire-draft").then(normalize),
        skill("grimoire-plan").then(normalize),
        skill("grimoire-apply").then(normalize),
        skill("grimoire-verify").then(normalize),
        skill("grimoire-pr").then(normalize),
      ]);

    for (const content of files) {
      expect(content).not.toMatch(
        /\.grimoire\/changes\/(?:<change-id>|<id>)\/(?:features|decisions|data\.yml)/,
      );
      expect(content).not.toContain("manifest status to `accepted`");
      expect(content).not.toContain("manifest status to `complete`");
    }

    expect(draftSkill).toContain("draft itself does not write them");
    expect(draftSkill).not.toContain("record a minimal `manifest.md`");
    expect(planSkill).toContain("directly into their durable live homes");
    expect(planSkill).toContain("status `approved`");
    expect(applySkill).toContain("Set the manifest status to `implementing`");
    expect(verifySkill).toContain("owns Grimoire alignment, deterministic checks, pre-commit review, and final suites");
    expect(prSkill).toContain("execute `grimoire-apply` §7");
  });

  it("routes alternate workflows through their stage owners", async () => {
    const [auditSkill, refactorSkill, triageSkill, removeSkill] = await Promise.all([
      skill("grimoire-audit").then(normalize),
      skill("grimoire-refactor").then(normalize),
      skill("grimoire-bug-triage").then(normalize),
      skill("grimoire-remove").then(normalize),
    ]);

    for (const findingsSkill of [auditSkill, refactorSkill]) {
      expect(findingsSkill).toContain("grimoire-draft");
      expect(findingsSkill).toContain("grimoire-plan");
      expect(findingsSkill).not.toContain("Draft `.feature` files");
    }
    expect(triageSkill).toContain("Triage produces evidence, not planned-change artifacts.");
    expect(triageSkill).not.toContain("Generate a draft manifest stub");
    expect(removeSkill).toContain("Block removal while active dependents remain");
    expect(removeSkill).toContain("Obtain explicit approval for the deletion scope");
    expect(removeSkill).toContain("route the approved removal through `grimoire-draft` and `grimoire-plan`");
    expect(removeSkill).not.toContain("Proposed feature files");
    expect(removeSkill).not.toContain("Create `tasks.md`");
  });

  it("keeps testing, spikes, and provider mechanics in their authoritative references", async () => {
    const files = await readActiveWorkflow();
    const [lifecycle, contracts] = await Promise.all([
      reference("testing-lifecycle.md").then(normalize),
      reference("testing-contracts.md").then(normalize),
    ]);

    expect(lifecycle).toContain("unknown");
    expect(lifecycle).toContain("findings-only spike");
    expect(contracts).toContain("authoritative observed provider response");
    for (const content of files) {
      expect(content).not.toContain("Every task follows the same cycle");
      expect(content).not.toContain("Run the full suite after every");
    }
  });

  it("keeps intent docs semantic and health checks historical", async () => {
    const [artifactMap, discoverSkill, precommitSkill, health, categories, refactorSkill, constraints, learnings] =
      await Promise.all([
        reference("artifact-map.md").then(normalize),
        skill("grimoire-discover").then(normalize),
        skill("grimoire-precommit-review").then(normalize),
        reference("health-check.md").then(normalize),
        reference("refactor-scan-categories.md").then(normalize),
        skill("grimoire-refactor").then(normalize),
        rootFile("templates/constraints.md").then(normalize),
        rootFile("templates/learnings.md").then(normalize),
      ]);

    for (const content of [artifactMap, discoverSkill, precommitSkill]) {
      expect(content).not.toContain("git log -1 --format=%ci");
      expect(content).not.toContain("staleness gate");
    }
    expect(health).toContain("Preserve superseded and deprecated decisions");
    expect(health).toContain("two-way supersession links");
    expect(health).toContain("§A#4");
    expect(health).toContain("§A#5");
    for (const category of [
      "hotspot",
      "structural_bloat",
      "data_structure",
      "circular_dependency",
      "dependency_staleness",
      "broken_promise",
      "duplication",
      "reinvented_platform",
      "dead_code",
      "test_debt",
      "pattern_divergence",
      "comment_noise",
      "deferred_task",
    ]) {
      expect(categories).toContain(`\`${category}\``);
      expect(refactorSkill).toContain(`\`${category}\``);
    }
    expect(constraints).toContain("A row may be added only when its verification already passes.");
    expect(constraints).not.toContain("TODO: unit-invariant test");
    expect(learnings).toContain("section confirmation passes");
    expect(learnings).not.toContain("moment that task goes green");
  });

  it("aligns narrative, generated guidance, repository data, and release metadata", async () => {
    const [readme, setup, context, debt, features, marketplace, packageJson, packageLock] =
      await Promise.all([
        rootFile("README.md").then(normalize),
        rootFile("docs/guide/setup.md").then(normalize),
        rootFile(".grimoire/docs/context.yml").then(normalize),
        rootFile(".grimoire/docs/debt-register.yml"),
        rootFile(".grimoire/docs/features.md").then(normalize),
        rootFile(".claude-plugin/marketplace.json").then(normalize),
        rootFile("package.json").then(JSON.parse),
        rootFile("package-lock.json").then(JSON.parse),
      ]);

    expect(readme).not.toContain("`grimoire diff <id>`");
    expect(readme).not.toContain("`data.yml`");
    expect(readme).toContain("pre-commit hook runs the configured lint, format, and doc-style steps");
    expect(setup).toContain(".grimoire/config.yaml");
    expect(setup).not.toContain(".grimoire/config.yml");
    expect(context).not.toContain("used_by: [map, health]");
    const debtItems = parseYaml(debt).items;
    const openLocations = debtItems
      .filter((item: { status: string }) => item.status === "open")
      .map((item: { location: string }) => item.location);
    for (const removed of ["src/core/archive.ts", "src/core/map.ts", "src/core/diff.ts"]) {
      expect(openLocations.some((location: string) => location.startsWith(removed))).toBe(false);
    }
    expect(features).toContain("Executable specifications run through the configured BDD runner.");
    expect(features).toContain(
      "`@manual` specifications use declared characterization or unit contracts",
    );
    expect(marketplace).toContain("question-driven spikes");
    expect(marketplace).toContain("verification-boundary delivery");
    expect(marketplace).not.toContain("red-green development for AI agents");
    expect(packageJson.version).toBe("0.4.2");
    expect(packageLock.version).toBe("0.4.2");
    expect(packageLock.packages[""].version).toBe("0.4.2");
  });

  it("plans substantial sections with lifecycle-owned confirmation", async () => {
    const [planSkill, reviewSkill, lifecycle] = await Promise.all([
      skill("grimoire-plan").then(normalize),
      skill("grimoire-review").then(normalize),
      reference("testing-lifecycle.md").then(normalize),
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
    expect(planSkill).toContain("one optional post-section confirmation");
    expect(planSkill).toContain("`@manual` workflow scenarios use characterization tests");
    expect(planSkill).toContain("../references/testing-lifecycle.md");
    expect(planSkill).toContain("Do not invent downstream mechanics");
    expect(planSkill).not.toContain("## 5. Verification");
    expect(planSkill).not.toContain("<!-- execution: paired -->");
    expect(planSkill).not.toContain("paired patch");

    expect(reviewSkill).toContain("Validate activity-level review timing");
    expect(reviewSkill).toContain("one or two substantial implementation sections");
    expect(reviewSkill).toContain("section confirmation");
    expect(reviewSkill).toContain("../references/testing-lifecycle.md");
    expect(reviewSkill).toContain("manufactured Gherkin");
    expect(lifecycle).toContain("authoritative testing lifecycle policy");
  });

  it("uses one shared lifecycle across workflow consumers", async () => {
    const consumerNames = [
      "grimoire-plan",
      "grimoire-apply",
      "grimoire-bug",
      "grimoire-bug-triage",
      "grimoire-refactor",
      "grimoire-review",
      "grimoire-verify",
    ];
    const consumers = await Promise.all(
      consumerNames.map((name) => skill(name).then(normalize)),
    );
    const obsolete =
      "Every task follows the same cycle: test → red → code → green → next";

    for (const consumer of consumers) {
      expect(consumer).toContain("../references/testing-lifecycle.md");
      expect(consumer).not.toContain(obsolete);
    }
  });

  it("defines spike allocation, evidence, exits, and lesson destinations", async () => {
    const [lifecycle, spikeSkill, learnings] = await Promise.all([
      reference("testing-lifecycle.md").then(normalize),
      skill("grimoire-spike").then(normalize),
      rootFile("templates/learnings.md").then(normalize),
    ]);

    for (const content of [lifecycle, spikeSkill]) {
      expect(content).toContain("one explicit question");
      expect(content).toContain("Required evidence");
      expect(content).toContain("Probe boundary");
      expect(content).toContain("answered, disproved, blocked, or inconclusive");
    }
    expect(lifecycle).toContain("next unused positive integer");
    expect(lifecycle).toContain("Standalone responses start at `S1`");
    expect(lifecycle).toContain("affected unchecked tasks");
    expect(lifecycle).toContain("Active change: `learnings.md`");
    expect(lifecycle).toContain("Reported bug: `triage.md`");
    expect(lifecycle).toContain("Standalone: the response");
    expect(spikeSkill).toContain("findings-only spike");
    expect(spikeSkill).toContain("human direction before attempt four");
    expect(learnings).toContain("## Spike lessons");
    expect(learnings).toContain("### S<n> — <question>");
  });

  it("separates planned delivery, bug reproduction, and final verification", async () => {
    const [lifecycle, applySkill, bugSkill, verifySkill, baseline, health, hooks] = await Promise.all([
      reference("testing-lifecycle.md").then(normalize),
      skill("grimoire-apply").then(normalize),
      skill("grimoire-bug").then(normalize),
      skill("grimoire-verify").then(normalize),
      reference("test-baseline.md").then(normalize),
      reference("health-check.md").then(normalize),
      rootFile("src/core/hooks.ts").then(normalize),
    ]);

    expectOrdered(lifecycle, [
      "Write all known section tests before production code.",
      "Do not run tests only to observe red.",
      "Run at most one cheap post-section confirmation.",
      "Run final verification once after all delivery sections.",
    ]);
    expect(lifecycle).toContain(
      "Defer section confirmation when it requires database or container startup.",
    );
    expect(lifecycle).toContain(
      "Run the permanent reproduction once to observe the expected failure before production changes.",
    );
    expect(lifecycle).toContain("Run the same reproduction once after the fix.");
    expect(lifecycle).toContain("Run every configured suite once at baseline");
    expect(lifecycle).toContain("once during final verification");
    expect(lifecycle).toContain(
      "Focused reruns after final-suite failure diagnose only the observed failure.",
    );
    expect(applySkill).toContain("write all known section tests before production code");
    expect(applySkill).toContain("Do not run tests only to observe red");
    expect(applySkill).toContain("Mark every covered task complete together");
    expect(bugSkill).toContain("one observed failing reproduction");
    expect(bugSkill).toContain("one passing reproduction afterward");
    expect(verifySkill).toContain(
      "diagnosis gate in `../references/testing-lifecycle.md` to every final-suite failure",
    );
    expect(verifySkill).toContain(
      "For a feature tagged `@manual`, use its declared characterization or unit contract",
    );
    expect(health).toContain(
      "`@manual` scenarios have a declared characterization or unit contract",
    );
    expect(bugSkill).toContain(
      "Correct issues directly without adding another reproduction run.",
    );
    expect(bugSkill).not.toContain("fix and re-run tests");
    expect(baseline).toContain("once before delivery");
    expect(baseline).toContain("once during final verification");
    expect(lifecycle).toContain("They must not run configured unit or BDD suites.");
    expect(hooks).toContain("grimoire check lint format doc_style --changed");
    expect(hooks).not.toContain('CURRENT_GIT_CHECK = "grimoire check --changed');
  });

  it("requires evidence-based diagnosis before another test run", async () => {
    const [lifecycle, agents, applySkill, bugSkill, verifySkill] = await Promise.all([
      reference("testing-lifecycle.md").then(normalize),
      rootFile("AGENTS.md").then(normalize),
      skill("grimoire-apply").then(normalize),
      skill("grimoire-bug").then(normalize),
      skill("grimoire-verify").then(normalize),
    ]);

    expectOrdered(lifecycle, [
      "After any test or deterministic-check failure",
      "Before another test execution",
    ]);
    expect(lifecycle).toContain(
      "Before another test execution, name at least one explicit root-cause unknown that the existing evidence cannot resolve.",
    );
    expect(lifecycle).toContain(
      "The diagnostic test must resolve that unknown.",
    );
    expect(lifecycle).toContain(
      "Select the narrowest deterministic test that can resolve that unknown.",
    );
    expect(lifecycle).toContain(
      "When no authoritative artifact establishes the expected outcome, ask the user before changing code or tests.",
    );
    expect(lifecycle).toContain(
      "Partial or incomparable evidence supports a hypothesis only until sufficient comparable evidence eliminates material alternatives.",
    );
    expect(lifecycle).toContain(
      "An unknown cause is a successful diagnosis outcome when it includes established observations and targeted diagnostic actions.",
    );
    expect(lifecycle).toContain(
      "Each proposed diagnostic action must identify at least one root-cause unknown it would resolve.",
    );
    expect(lifecycle).toContain(
      "Do not run another dependent test or broader suite until the prerequisite is restored or the user gives explicit direction.",
    );
    expect(agents).toContain("Separate observations, hypotheses, and proven conclusions.");
    expect(agents).toContain("State that the cause is unknown when the evidence does not prove it.");

    for (const consumer of [applySkill, bugSkill, verifySkill]) {
      expect(consumer).toContain("diagnosis gate in `../references/testing-lifecycle.md`");
      expect(consumer).not.toContain(
        "Partial or incomparable evidence supports a hypothesis only until sufficient comparable evidence eliminates material alternatives.",
      );
    }
  });

  it("stops failed delivery and preserves user steering", async () => {
    const [applySkill, agents, learnings, lifecycle] = await Promise.all([
      skill("grimoire-apply").then(normalize),
      rootFile("AGENTS.md").then(normalize),
      rootFile("templates/learnings.md").then(normalize),
      reference("testing-lifecycle.md").then(normalize),
    ]);

    expect(lifecycle).toContain("After three failed delivery attempts, stop delivery.");
    expect(lifecycle).toContain("findings-only spike");
    expect(lifecycle).toContain("human direction before attempt four");
    expect(applySkill).toContain(
      "A `structure-before` activity pauses once for production-shape approval, then proceeds with direct autonomous implementation.",
    );
    expect(applySkill).toContain(
      "A `slice-after` activity proceeds with direct autonomous implementation and no intermediate gate.",
    );
    expect(applySkill).toContain("Start a fresh implementation context for each substantial section.");
    expect(applySkill).toContain("Task checkboxes are the resume state.");
    expect(applySkill).toContain("Record one implementation lesson only when remaining work changes.");
    expect(applySkill).toContain("Update only affected unchecked tasks.");
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
      "Invoke `grimoire-verify` once after all implementation sections are complete.",
    ]);
    expectOrdered(verifySkill, [
      "Run `grimoire validate`.",
      "Run existing Grimoire-specific static verification.",
      "Run configured deterministic non-test checks by explicit step name.",
      "Invoke `grimoire-precommit-review` once over the complete diff.",
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
      expect(doc).toContain("section confirmation");
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
      "→ /grimoire:apply Writes known tests, implements sections, and confirms each section once",
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
      "Remove `.grimoire/changes/<change-id>/`, including its design, manifest, tasks, baseline, and working-memory files.",
    ]);
    expect(commitSkill).toContain(
      "That commit contains durable verified work only and no active change-folder scaffolding.",
    );
  });

  it("deletes ephemeral state before documentation and stages one durable index", async () => {
    const applySkill = normalize(await skill("grimoire-apply"));

    expectOrdered(applySkill, [
      "Record every deferred task in `.grimoire/docs/debt-register.yml`.",
      "Remove `.grimoire/changes/<change-id>/`, including its design, manifest, tasks, baseline, and working-memory files.",
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
    const bugSkill = normalize(await skill("grimoire-bug"));

    expectOrdered(bugSkill, [
      "write the corrected reproduction before changing production code",
      "observe it fail for the corrected reason",
      "make that reproduction pass",
    ]);
    expect(bugSkill).toContain(
      "An agent must never weaken or delete a test without explicit user direction.",
    );
    expect(bugSkill).not.toContain(
      "If a test genuinely encodes the wrong expectation, that is a spec problem — STOP and go back to draft",
    );
  });

  it("uses observed provider fixtures and owned orchestration stubs", async () => {
    const [lifecycle, contracts] = await Promise.all([
      reference("testing-lifecycle.md").then(normalize),
      reference("testing-contracts.md").then(normalize),
    ]);

    expect(lifecycle).toContain("See `testing-contracts.md` for provider-test mechanics.");
    expect(lifecycle).not.toContain("mock at the HTTP boundary");
    expect(contracts).toContain("authoritative observed provider response");
    expect(contracts).toContain("repository-owned adapter-result type");
    expect(contracts).not.toContain("document the subset your client uses");
  });

  it("keeps code quality as writing guidance, not a repeated gate", async () => {
    const [quality, refactorSkill] = await Promise.all([
      reference("code-quality.md").then(normalize),
      skill("grimoire-refactor").then(normalize),
    ]);

    expect(quality).toContain("writing guidance");
    expect(quality).toContain("Final verification is the authoritative quality gate.");
    expect(quality).toContain("Self-check corrections do not trigger automatic test reruns.");
    expect(quality).not.toContain("per file, per task");
    expect(quality).not.toContain("re-run tests");
    expect(quality).not.toContain("This gate exists");
    expect(refactorSkill).toContain("../references/testing-lifecycle.md");
    expect(refactorSkill).not.toContain("Capture a baseline first, then keep it.");
  });

  it("identifies release 0.4.2 in package metadata", async () => {
    const [packageJson, packageLock] = await Promise.all([
      rootFile("package.json").then(JSON.parse),
      rootFile("package-lock.json").then(JSON.parse),
    ]);

    expect(packageJson.version).toBe("0.4.2");
    expect(packageLock.version).toBe("0.4.2");
    expect(packageLock.packages[""].version).toBe("0.4.2");
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
