import { access, readFile } from "node:fs/promises";
import fg from "fast-glob";


export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}


export async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}


export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


export async function findFiles(dir: string, ext: string): Promise<string[]> {
  return fg(`**/*${ext}`, { cwd: dir, absolute: true });
}
