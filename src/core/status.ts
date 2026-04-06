import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { findProjectRoot, resolveChangePath } from "../utils/paths.js";

interface StatusOptions {
  json: boolean;
}

interface ChangeStatus {
  id: string;
  status: string;
  branch: string | null;
  stage: "draft" | "planned" | "applying" | "complete";
  artifacts: {
    manifest: boolean;
    features: string[];
    decisions: string[];
    tasks: TaskStatus | null;
  };
}

interface TaskStatus {
  total: number;
  completed: number;
  pending: string[];
}

export async function getChangeStatus(
  changeId: string,
  options: StatusOptions
): Promise<void> {
  const root = await findProjectRoot();
  const changePath = resolveChangePath(root, changeId);

  const status: ChangeStatus = {
    id: changeId,
    status: "draft",
    branch: null,
    stage: "draft",
    artifacts: {
      manifest: false,
      features: [],
      decisions: [],
      tasks: null,
    },
  };

  // Check manifest and parse frontmatter
  try {
    const manifestContent = await readFile(
      join(changePath, "manifest.md"),
      "utf-8"
    );
    status.artifacts.manifest = true;

    if (manifestContent.startsWith("---")) {
      const frontmatter = manifestContent.split("---")[1] || "";
      const statusMatch = frontmatter.match(/status:\s*(\S+)/);
      if (statusMatch) status.status = statusMatch[1];
      const branchMatch = frontmatter.match(/branch:\s*(\S+)/);
      if (branchMatch) status.branch = branchMatch[1];
    }
  } catch {
    // no manifest
  }

  // Find feature files
  try {
    const glob = (await import("fast-glob")).default;
    status.artifacts.features = await glob("features/**/*.feature", {
      cwd: changePath,
    });
  } catch {
    // no features dir
  }

  // Find decision files
  try {
    const glob = (await import("fast-glob")).default;
    status.artifacts.decisions = await glob("decisions/**/*.md", {
      cwd: changePath,
    });
  } catch {
    // no decisions dir
  }

  // Parse tasks
  try {
    const tasksContent = await readFile(
      join(changePath, "tasks.md"),
      "utf-8"
    );
    const taskLines = tasksContent.match(/^- \[[ x]\] .+$/gm) || [];
    const completed = taskLines.filter((l) => l.startsWith("- [x]")).length;
    const pending = taskLines
      .filter((l) => l.startsWith("- [ ]"))
      .map((l) => l.replace("- [ ] ", "").trim());

    status.artifacts.tasks = {
      total: taskLines.length,
      completed,
      pending,
    };

    status.stage = "planned";
    if (completed > 0 && completed < taskLines.length) {
      status.stage = "applying";
    }
    if (completed === taskLines.length && taskLines.length > 0) {
      status.stage = "complete";
    }
  } catch {
    // no tasks
  }

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  // Pretty print
  console.log(chalk.bold(`\nChange: ${changeId}`));
  console.log(`Status: ${stageLabel(status.status)}`);
  if (status.branch) {
    console.log(`Branch: ${chalk.cyan(status.branch)}`);
  }
  console.log(`Stage:  ${stageLabel(status.stage)}\n`);

  console.log("Artifacts:");
  console.log(
    `  Manifest:  ${status.artifacts.manifest ? chalk.green("yes") : chalk.red("missing")}`
  );
  console.log(
    `  Features:  ${status.artifacts.features.length > 0 ? status.artifacts.features.join(", ") : chalk.dim("none")}`
  );
  console.log(
    `  Decisions: ${status.artifacts.decisions.length > 0 ? status.artifacts.decisions.join(", ") : chalk.dim("none")}`
  );

  if (status.artifacts.tasks) {
    const t = status.artifacts.tasks;
    console.log(
      `  Tasks:     ${t.completed}/${t.total} complete`
    );
    if (t.pending.length > 0) {
      console.log("\nPending tasks:");
      for (const task of t.pending) {
        console.log(`  ${chalk.dim("[ ]")} ${task}`);
      }
    }
  } else {
    console.log(`  Tasks:     ${chalk.dim("not yet planned")}`);
  }
}

function stageLabel(stage: string): string {
  switch (stage) {
    case "draft":
      return chalk.yellow("draft");
    case "planned":
      return chalk.blue("planned");
    case "applying":
      return chalk.cyan("applying");
    case "complete":
      return chalk.green("complete");
    default:
      return stage;
  }
}
