---
status: accepted
date: 2026-04-05
decision-makers: [Fred]
---

# Treat config.yaml tool commands as trusted code

## Context and Problem Statement
`.grimoire/config.yaml` defines shell commands for linters, formatters, test runners, and other tools. These commands are executed by `grimoire check` and `grimoire health`. This is an inherent command execution risk — any string in the config can be run as a shell command.

## Decision Drivers
- This is the same trust model as npm scripts, Makefile targets, and CI configs
- Users create the config during `grimoire init` (interactive, confirmed)
- Validating arbitrary shell commands is impractical (too many legitimate patterns)
- The alternative (allowlisting commands) would break flexibility

## Considered Options
1. Accept config-as-code trust model (document the risk)
2. Allowlist known-safe executables
3. Parse and validate command strings for injection patterns
4. Run commands in a sandbox

## Decision Outcome
Chosen option: "Accept config-as-code trust model", because `.grimoire/config.yaml` is a project file that users create and commit. Restricting it would break the tool's flexibility without meaningfully improving security — if an attacker can modify your config, they can also modify your Makefile or package.json scripts.

### Consequences
- Good: Full flexibility — any tool command works
- Good: Consistent with how npm scripts, Makefiles, and CI configs work
- Bad: A malicious config in a cloned repo could execute arbitrary commands
- Bad: LLM commands are interpolated into shell calls (mitigated by piping stdin in v0.1.0)

### Confirmation
Document in README that config commands are executed. Ensure LLM prompts are piped via stdin (not interpolated into shell strings) to prevent prompt content from becoming shell injection.
