import { Command } from "commander";
import fg from "fast-glob";
import { analyzeTestQuality, printReport, TEST_FILE_GLOBS, TEST_FILE_IGNORE } from "../core/test-quality.js";
import { findProjectRoot } from "../utils/paths.js";

export const testQualityCommand = new Command("test-quality")
  .description("Analyze test files for weak assertions, empty bodies, and quality issues")
  .argument("[files...]", "Specific test files to analyze (default: auto-detect)")
  .option("--json", "Output as JSON")
  .action(async (files: string[], options) => {
    const root = await findProjectRoot();

    let filePaths: string[];
    if (files.length > 0) {
      filePaths = files;
    } else {
      filePaths = await fg(TEST_FILE_GLOBS, {
        cwd: root,
        absolute: true,
        ignore: TEST_FILE_IGNORE,
      });
    }

    if (filePaths.length === 0) {
      console.log("No test files found.");
      return;
    }

    const report = await analyzeTestQuality(filePaths);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (report.summary.critical > 0) {
      process.exit(1);
    }
  });
