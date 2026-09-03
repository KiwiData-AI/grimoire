import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/check.js", () => ({ runCheck: vi.fn() }));

import { runCheck } from "../core/check.js";
import { checkCommand } from "./check.js";

const mockRunCheck = vi.mocked(runCheck);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkCommand", () => {
  it("exits unsuccessfully when a configured check errors", async () => {
    mockRunCheck.mockResolvedValue({
      results: [],
      passed: 0,
      failed: 0,
      skipped: 0,
      errored: 1,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit 1");
    }) as never);

    await expect(checkCommand.parseAsync(["node", "grimoire"])).rejects.toThrow("exit 1");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
