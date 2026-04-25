import { spawn } from "node:child_process";

/**
 * Spawn a command with stdin piped, avoiding sh -c shell interpretation.
 */
export function spawnWithStdin(
  command: string,
  args: string[],
  input: string,
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts = command.split(/\s+/);
    const proc = spawn(parts[0], [...parts.slice(1), ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Command exited with code ${code}`));
      }
    });

    proc.stdin.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code !== "EPIPE") reject(err);
    });
    proc.stdin.write(input, (err) => {
      if (err && (err as NodeJS.ErrnoException).code !== "EPIPE") reject(err);
      proc.stdin.end();
    });
  });
}
