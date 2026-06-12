import { join, resolve } from "node:path";
import { fileExists } from "./fs.js";


export async function findProjectRoot(startDir?: string): Promise<string> {
  const start = startDir ?? process.cwd();
  let dir = start;
  const root = resolve("/");

  while (dir !== root) {
    if (
      (await fileExists(join(dir, ".grimoire"))) ||
      (await fileExists(join(dir, "features")))
    ) {
      return dir;
    }
    dir = resolve(dir, "..");
  }

  // Fall back to the starting directory
  return start;
}

export function resolveChangePath(root: string, changeId: string): string {
  if (/[/\\]/.test(changeId) || changeId === ".." || changeId.includes("..")) {
    throw new Error(`Invalid change ID: ${changeId}`);
  }
  return join(root, ".grimoire", "changes", changeId);
}


export function safePath(root: string, filePath: string): string {
  const resolved = resolve(root, filePath);
  if (!resolved.startsWith(root + "/") && resolved !== root) {
    throw new Error(`Path escapes project root: ${filePath}`);
  }
  return resolved;
}
