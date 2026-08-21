---
status: implementing
complexity: 3
branch: feat/add-mkdocs-spec-site
design_ref:
---

# Change: Generate a branded MkDocs spec site in consumer repos

## Why
Reviewing grimoire specs means reading flat files in an editor. After this change, `grimoire docs` also regenerates and statically builds a searchable, grimoire-branded site over features, decisions, and constraints — and the finalize step runs it, so `.grimoire/site/` is current whenever a change lands. Solved when a configured consumer repo gets a built site from one command and an unconfigured repo is unaffected.

## Non-goals
- This repo's own documentation (stays VitePress).
- Editing specs through the site — read-only viewer; git is the write path.
- Test-result injection (living docs) — v1 renders specs only.
- Consumer brand override — the site is always Midnight Kiwi.
- Light theme — dark-only.
- Non-spec content in the nav (area docs, data schema) — the overview index already summarizes; grimoire spec items only.
- Serving/hosting — output is static HTML; where it's served is the consumer's business.

## Feature Changes
- **ADDED** `generate-a-spec-site.feature` — spec site built alongside the overview; skipped when not configured.

New-file justification: `generate-a-project-overview.feature` was considered (same command entry point) but its title covers the single-file overview; covering the site too would need an "and". No other file owns docs generation.

## Scenarios Added
- `generate-a-spec-site.feature`: "The spec site is built alongside the overview", "Spec site generation is skipped when not configured"

## Scenarios Modified
- none

## Decisions
- **ADDED** `0038-mkdocs-material-spec-site.md` — MkDocs Material, config-driven build, `.grimoire/site/`, dark-only Midnight Kiwi. (Draft D2/D4–D9 fold into 0038 as mechanics; none is an independent trade-off.)

## Prior Art
Evaluated for the spec-viewer need: **MkDocs Material** (adopted — built-in search, theming tokens, Pygments Gherkin); **log4brains** (rejected — ADR-only, own folder conventions, lightly maintained since 2024); **Pickles/Augurk** (rejected — .NET-centric, stale); **VitePress** (rejected for consumer sites — search/Gherkin need custom work; remains this repo's own doc tool); **mkdocs-gherkin-plugin** (rejected — injects test results, out of v1 scope; noted as the re-add path for living docs). Build portion is deliberately thin: grimoire pre-generates markdown + config and shells out to a user-configured build command, reusing the existing `tools:` config pattern.

## Assumptions
- The Pygments `gherkin` lexer ships with mkdocs-material's highlighting stack — evidence: Material uses Pygments, which includes a Gherkin lexer. Low risk; validated by the first real build (verification task 5.4).
- Consumers who configure `tools.spec_site.command` have the tooling that command needs (`uvx` or `mkdocs`) — by construction: the user writes the command; grimoire only runs it.
- `OVERVIEW.md` CommonMark renders cleanly under MkDocs — evidence: the file's own header says "Portable CommonMark — include it in your doc tool".

## Pre-Mortem
- **Committed HTML bloats diffs at finalize** → mitigation: README documents marking `.grimoire/site/` `linguist-generated` in `.gitattributes`; residual noise accepted (user decision: committed output).
- **Build command fails during finalize** → mitigation: `grimoire docs` exits non-zero with the command's output; the finalize step surfaces the failure instead of silently shipping a stale site.
- **Site drifts stale between finalizes** → accepted: manual `grimoire docs` regenerates on demand; the finalize hook bounds the drift to unmerged work.
- **Regenerated pages clobber hand edits in `.grimoire/site/`** → mitigation: generated files carry an "auto-generated, do not edit" header line, matching `OVERVIEW.md`'s convention.
