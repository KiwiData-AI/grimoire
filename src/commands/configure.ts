import { Command } from "commander";
import { join } from "node:path";
import { configureProject, SECTION_LABELS, type SectionName } from "../core/configure.js";

const VALID_SECTIONS = Object.keys(SECTION_LABELS) as SectionName[];

export const configureCommand = new Command("configure")
  .description(
    "Configure grimoire options deferred from init: compliance, design tool, LLM models, bug trackers, testing tools"
  )
  .argument(
    "[section]",
    `Section to configure: ${VALID_SECTIONS.join(", ")} (omit for interactive menu)`
  )
  .argument("[path]", "Project root directory", ".")
  .action(async (section: string | undefined, path: string) => {
    const root = join(process.cwd(), path);
    const sections: SectionName[] | undefined =
      section && (VALID_SECTIONS as string[]).includes(section)
        ? [section as SectionName]
        : undefined;

    if (section && !sections) {
      console.error(
        `Unknown section "${section}". Valid: ${VALID_SECTIONS.join(", ")}`
      );
      process.exit(1);
    }

    await configureProject(root, sections);
  });
