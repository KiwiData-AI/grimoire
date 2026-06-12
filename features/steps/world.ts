import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setWorldConstructor, World } from "@cucumber/cucumber";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(REPO_ROOT, "bin", "grimoire.js");

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class GrimoireWorld extends World {
  dir = mkdtempSync(join(tmpdir(), "grimoire-bdd-"));
  result: RunResult = { stdout: "", stderr: "", code: 0 };

  /** Run the built grimoire CLI in the temp project. When `input` is given it is
   *  fed on stdin (for hook commands); otherwise stdin is closed so any prompt
   *  receives EOF and falls back to a default. */
  run(args: string[], input?: string): RunResult {
    // Strip NODE_OPTIONS so the tsx loader (used to run these step defs) does
    // not leak into the child CLI, which runs in a temp dir without tsx and
    // only needs the compiled dist JS.
    const { NODE_OPTIONS: _omit, ...env } = process.env;
    const r: SpawnSyncReturns<string> = spawnSync("node", [CLI, ...args], {
      cwd: this.dir,
      encoding: "utf-8",
      input,
      stdio: [input != null ? "pipe" : "ignore", "pipe", "pipe"],
      env,
    });
    this.result = {
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
      code: r.status ?? 1,
    };
    return this.result;
  }

  git(args: string[]): void {
    spawnSync("git", args, { cwd: this.dir, encoding: "utf-8" });
  }

  /** A repo with git configured so commits work in CI. */
  initGit(): void {
    this.git(["init", "-q"]);
    this.git(["config", "user.email", "bdd@example.com"]);
    this.git(["config", "user.name", "BDD"]);
    this.git(["config", "commit.gpgsign", "false"]);
  }

  /** A minimal but real grimoire project (config + dirs), no skills/hooks/AGENTS. */
  initProject(): void {
    this.initGit();
    this.run(["init", "--no-detect", "--skip-agents", "--skip-skills"]);
  }

  write(relPath: string, content: string): void {
    const full = join(this.dir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  get out(): string {
    return this.result.stdout + this.result.stderr;
  }

  /** Parse the command's stdout as JSON (commands invoked with --json emit
   *  nothing else on stdout). Throws with the raw output if it isn't JSON. */
  json<T = unknown>(): T {
    try {
      return JSON.parse(this.result.stdout) as T;
    } catch {
      throw new Error(`expected JSON on stdout but got:\n${this.out}`);
    }
  }

  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

setWorldConstructor(GrimoireWorld);
