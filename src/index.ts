// Public API for programmatic use
export { initProject } from "./core/init.js";
export { updateProject } from "./core/update.js";
export { validateChange, type ValidateResult } from "./core/validate.js";
export { listChanges, listFeatures, listDecisions } from "./core/list.js";
export { getChangeStatus } from "./core/status.js";
export { archiveChange, ArchiveError } from "./core/archive.js";
export { generateMap } from "./core/map.js";
export { runCheck, type CheckResult } from "./core/check.js";
export { loadConfig } from "./utils/config.js";
export { detectTools } from "./core/detect.js";
export { generateLog } from "./core/log.js";
export { traceFile } from "./core/trace.js";
export { generateDocs } from "./core/docs.js";
export { runHealth } from "./core/health.js";
export { diffChange, type DiffResult } from "./core/diff.js";
export { runCi } from "./core/ci.js";
export { analyzeTestQuality, type TestQualityReport } from "./core/test-quality.js";
export { checkDocStyle, type DocStyleReport } from "./core/doc-style.js";
