import { describe, it, expect } from "vitest";
import { spawnWithStdin } from "./spawn.js";
import { tmpdir } from "node:os";
import { realpathSync } from "node:fs";

describe("spawnWithStdin", () => {
  it("runs a command and returns stdout", async () => {
    const result = await spawnWithStdin("cat", [], "hello world", tmpdir());
    expect(result).toBe("hello world");
  });

  it("passes arguments to the command", async () => {
    const result = await spawnWithStdin("echo", ["-n", "test"], "", tmpdir());
    expect(result).toBe("test");
  });

  it("rejects on nonexistent command", async () => {
    await expect(
      spawnWithStdin("nonexistent_command_xyz", [], "", tmpdir())
    ).rejects.toThrow();
  });

  it("rejects when command exits with non-zero and no stdout", async () => {
    await expect(
      spawnWithStdin("sh", ["-c", "exit 1"], "", tmpdir())
    ).rejects.toThrow();
  });

  it("resolves with stdout even on non-zero exit if stdout has content", async () => {
    const result = await spawnWithStdin(
      "sh",
      ["-c", "echo partial; exit 1"],
      "",
      tmpdir()
    );
    expect(result).toBe("partial");
  });

  it("uses cwd parameter", async () => {
    const cwd = tmpdir();
    const result = await spawnWithStdin("pwd", [], "", cwd);
    expect(result).toBe(realpathSync(cwd));
  });
});
