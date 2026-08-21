---
status: proposed
date: 2026-08-21
decision-makers: [Fred]
---

# MkDocs Material for the Generated Spec Site

## Context and Problem Statement
Consumer repos accumulate specs as flat files (`features/`, `.grimoire/decisions/`, `.grimoire/docs/constraints.md`). Reviewing them means reading raw markdown in an editor. Grimoire should generate a browsable, searchable, statically built site over those artifacts in any consumer repo. Which site generator, and how does grimoire drive it without owning a Python toolchain?

## Decision Drivers
- Built-in client-side search on static hosting
- Gherkin rendering without custom tooling
- Deep theming so the site can carry grimoire branding
- Consumer repos may be JS-only; grimoire is an npm CLI and must not manage a Python install
- Docs must be current when a change is finalized

## Considered Options
1. MkDocs Material — generate config + markdown, user-configured build command
2. VitePress — Node-native, but search and Gherkin need plugins/custom work
3. log4brains — purpose-built ADR UI, but ADR-only, own conventions, lightly maintained
4. Pickles / Augurk — Gherkin living-doc generators, .NET-centric and stale
5. Build a custom static generator inside grimoire

## Decision Outcome
Chosen option: "MkDocs Material", because it ships client-side search, tokenized theming, and Pygments Gherkin highlighting out of the box, so grimoire only pre-generates markdown pages and runs a user-configured build command.

Mechanics: `grimoire docs` (existing overview command) additionally regenerates `.grimoire/site/` — mkdocs config, markdown pages (features in Gherkin fences, decisions with status, constraints, overview as index), and a dark-only "Midnight Kiwi" stylesheet derived from the grimoire logo (ground `#141a24`, primary `#a8c94e`, accent `#6fd3f2`) — then runs the build command from `tools.spec_site.command` in `.grimoire/config.yaml` (e.g. `uvx --with mkdocs-material mkdocs build …`). No `spec_site` tool configured → site step skipped. The finalize step runs the same command, so the committed static HTML in `.grimoire/site/html/` is current when a change lands. Only the built `html/` is committed; the markdown intermediates and generated mkdocs config are gitignored via a generated `.grimoire/site/.gitignore` — they serve only the build.

### Consequences
- Good: search, theming, and Gherkin rendering are free; grimoire's build stays a thin generator.
- Good: config-over-hardcode — the build command is user-owned, matching the existing `tools:` pattern.
- Bad: a Python-ecosystem tool in possibly-JS repos; mitigated by `uvx` zero-install invocation and the feature being optional.
- Bad: committed static HTML adds diff noise at finalize; accepted, and consumers can mark `.grimoire/site/` as `linguist-generated`.

### Quality Attributes

| Attribute        | Target | Measurement |
|------------------|--------|-------------|
| Build time       | Site regen adds < 10s to `grimoire docs` on a repo with ≤100 specs | timed run |
| Portability      | Generated site builds offline (no network beyond the configured command's own tooling) | build with network disabled |
