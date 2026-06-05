---
name: grimoire-discover
description: Generate intent-focused area docs and data schema by querying the codebase graph. Use when initializing grimoire on an existing project or when an area's intent/boundaries have changed.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-discover

Generate **intent-focused** area docs and a data schema in `.grimoire/docs/`. Area docs capture what the graph can't know — an area's *purpose, boundaries, and conventions* — and point at the codebase-memory-mcp graph for everything structural (symbols, key files, call graphs, reusable code). The graph is the live source of structure; discover does not freeze it into a doc that drifts.

## Triggers
- User wants to document an area's purpose, boundaries, or conventions
- User asks about coding standards or where new code of a type should go
- User is onboarding an existing project to grimoire
- Loose match: "discover", "standards", "conventions", "boundaries", "onboard codebase"

Note: "find existing utilities", "what calls what", "codebase layout/structure" are **graph** queries, not discover — use codebase-memory-mcp (`search_graph`, `get_architecture`, `trace_path`) directly.

## Routing
- Want to document existing behavior as Gherkin features → `grimoire-audit`
- Want to find undocumented features and decisions → `grimoire-audit` (run discover first, then audit)
- Want to draft new functionality → `grimoire-draft`

## Prerequisites

**The codebase graph is the structure source.** `codebase-memory-mcp` should be indexed for this project — discover reads directory layout, symbols, key files, and call graphs from it (`get_architecture`, `search_graph`, `trace_path`), not from a filesystem snapshot. There is no `grimoire map` step and no `.snapshot.json` (both retired).

If `codebase-memory-mcp` is not indexed, run `index_repository` first. Only if the graph is genuinely unavailable, fall back to reading source files directly to identify boundaries and conventions.

## What It Produces

`.grimoire/docs/` with:
- **`index.yml`** — registry of documented areas (descriptions + directory mappings) and the functional-story map that groups capabilities in the OVERVIEW
- **Area docs** — one markdown file per significant area, **intent only**:
  - Purpose of the area
  - Boundaries (what belongs here, what doesn't, where related code lives)
  - Conventions (naming + structural patterns, with example file references)
  - Where new code of this type should go

Area docs do NOT contain Key Files, a reusable-code inventory, or duplicate listings — those are structure, and the graph regenerates them live on demand (and would drift if frozen here). When a reader needs symbols or reuse candidates, they query the graph, not the doc.

## Workflow

### 1. Load the Graph
Query `codebase-memory-mcp` to understand the codebase live:
- `get_architecture` — high-level module/dependency overview and directory layout (your roadmap of WHERE the areas are)
- `search_graph` — symbols (functions, classes, types) in a directory, with signatures
- `trace_path` — how modules connect (inbound/outbound calls)
- `query_graph` — specific relationships (e.g., `MATCH (f:Function)-[:CALLS]->(g) WHERE f.file STARTS WITH 'src/api/' RETURN f.name, g.name`)

The graph gives AST-accurate structure across many languages. You use it to *understand* each area so you can write its intent doc — you do NOT copy its output into the doc (that's what regenerating live avoids).

### 2. Determine Scope
Ask the user what to document (or accept the scope passed in by a calling skill):
- **Full scan** — document all significant areas (default for first run); use `get_architecture` to enumerate them
- **Area scan** — document specific directories (e.g., "just the API layer")
- **Targeted refresh** — a list of directories is passed in (e.g. from `grimoire-plan`'s staleness gate). Regenerate only those area docs and update their `last_updated` entries in `index.yml`. Fast-path for when an area's *intent* changed; does not touch areas outside the passed list.

Check `.grimoire/docs/index.yml` if it exists — don't redo work unless refreshing. Remember discover runs when **intent** changes (new area, shifted boundary), not on every code change — structure is always live from the graph.

### 3. Analyze Each Area
For each area, use the graph to understand it, then distill the **intent** a reader can't get from the graph:

**From the graph (read, don't transcribe):**
- Symbols, signatures, call relationships, dead code — context for understanding what the area does
- Cross-area import/HTTP links — informs the Boundaries section

**What you write down (the graph can't infer this):**
- What the area is *responsible for* (Purpose)
- What belongs here vs. where related code lives (Boundaries)
- Naming and structural conventions in use, with an exemplar file reference
- Where new code of this type should go
- **Data models and schemas** owned by this area (see Data Layer below)

### 4. Generate Area Docs
For each significant area, create a doc file in `.grimoire/docs/`.

**Area doc format (intent only — no structure tables):**

```markdown
# <Area Name>
> Last updated: YYYY-MM-DD

## Purpose
<1-2 sentences: what this area of the codebase is responsible for>

## Boundaries
<What belongs here and what doesn't. Where related code lives instead.>

## Conventions
<How things are done in this area. Reference specific files as exemplars — don't list every file.>

### Naming
- <naming convention with one example file>

### Structure
- <structural pattern with one exemplar file>

## Where New Code Goes
- New <type> → `path/to/directory/`
- New <type> → `path/to/other/`

## Structure (live)
For key files, symbols, reusable utilities, call graphs, and duplicates in this area,
query the graph — it is always current:
- `get_architecture(area="<dir>")` · `search_graph(qn_pattern="<dir>.*")`
- duplicates: `grimoire health` (config-driven `duplicates` metric)
```

Do not hand-list files, functions, or "reusable code" — that's the graph's job, and a frozen copy drifts. The single pointer above replaces the old Key Files / Reusable Code / Known Duplicates tables.

### 5. Generate Data Schema

Scan the codebase for data models, ORM definitions, migration files, and schema declarations. Produce `.grimoire/docs/data/schema.yml` documenting the current data layer.

**Where to look:**
- ORM models: Django `models.py`, SQLAlchemy models, Prisma `schema.prisma`, TypeORM entities, Mongoose schemas
- Migrations: `migrations/`, `alembic/versions/`, `prisma/migrations/`
- Raw SQL: `*.sql` files, schema definitions
- NoSQL: Mongoose schemas, DynamoDB table definitions, Firestore rules
- API schemas: GraphQL `.graphql` files, protobuf `.proto` files, JSON Schema
- External APIs: OpenAPI/Swagger specs, Postman collections, API client wrappers, SDK config files
- Message formats: Avro `.avsc`, protobuf `.proto`, JSON Schema for events/messages

**Schema format:** See `../references/schema-format.md` for the full YAML format with examples covering tables, nested objects, relationships, and external APIs.

**Rules:**
- Document what exists in the code, not what the database actually contains
- Use `source:` to point back to the ORM model or migration file — the schema.yml is a summary, the code is the truth
- Use `type: table` for SQL, `type: collection` for Mongo/document stores, `type: document` for nested sub-documents
- Use `type: external_api` for APIs you consume or produce but don't own the schema for
- Nested `fields` for embedded objects/arrays (common in document DBs and JSON columns)
- Include `note:` only when the field name isn't self-explanatory
- Include `relationships` when the ORM defines them explicitly
- For external APIs: `schema_ref` is the most important field — point to the OpenAPI spec, Swagger URL, API docs page, or local spec file so the LLM (and humans) know where to get the full contract
- For external APIs: `client` points to where the codebase calls the API — this is where changes happen when the API changes
- Don't duplicate entire OpenAPI specs into schema.yml — summarize the endpoints you actually use with key fields, and point to the full spec via `schema_ref`
- If the project has no data layer, skip this step entirely

If `.grimoire/docs/data/` already exists, update it rather than regenerating. Diff against existing schema.yml to flag new models or removed fields.

### 5.5 Component Inventory (optional)

Scan the codebase for an existing UI component library, then produce `.grimoire/docs/components.md` documenting reusable components. This inventory lets `grimoire-design` reuse what exists instead of generating duplicate components.

**Detection — component library:**

| Signal | What it tells you |
|--------|------------------|
| `components.json` | shadcn/ui — components live under the configured `aliases.components` path (typically `components/ui/`) |
| `tailwind.config.{js,ts}` | Tailwind project — utility-first; components are project-local |
| `package.json` deps: `@mui/material` | Material UI — components imported from `@mui/material/*` |
| `package.json` deps: `@chakra-ui/react` | Chakra UI — components imported from `@chakra-ui/react` |
| `package.json` deps: `@mantine/core` (or any `mantine` package) | Mantine |
| `package.json` deps: `@radix-ui/*` | Radix primitives — usually wrapped by shadcn or project components |

**Detection — Storybook:**

| Signal | What it tells you |
|--------|------------------|
| `.storybook/main.{ts,js}` | Storybook configured — stories define canonical component variants |
| `*.stories.{ts,tsx,jsx,js}` | Story files — each story is a documented component variant |

**Skip condition:** If no library signal and no story files are found, emit a single-line note ("No UI component signals detected — skipping component inventory.") and continue to §6. Do not create `components.md`.

**Workflow:**
1. Detect the library (or libraries) using the signals above
2. Locate component source files — for shadcn, walk `components/ui/`; for project-local components, look under `src/components/`, `app/components/`, or wherever the convention places them
3. For each component file, extract: name, file path, exported variants (e.g., `variant="primary|secondary"`), and notable props (especially required ones)
4. If Storybook is present, walk `*.stories.*` files to harvest the canonical variant list per component — stories are the source of truth for which variants exist
5. Write `.grimoire/docs/components.md` listing each component with file path, variants, and key props

**`components.md` format:**

```markdown
# Component Inventory
> Last updated: YYYY-MM-DD
> Library: <shadcn | MUI | Chakra | Mantine | project-local | mixed>

## Components

| Component | Location | Variants | Key Props | Notes |
|-----------|----------|----------|-----------|-------|
| `Button` | `components/ui/button.tsx` | `default`, `destructive`, `outline`, `ghost`, `link` | `variant`, `size`, `asChild` | Wraps Radix Slot when `asChild` |
| `Dialog` | `components/ui/dialog.tsx` | — | `open`, `onOpenChange` | Compound: `Dialog`, `DialogTrigger`, `DialogContent` |

## Stories
<Only if Storybook detected. List story files and the variants they document.>

| Story File | Component | Documented Variants |
|------------|-----------|---------------------|
| `Button.stories.tsx` | `Button` | Primary, Secondary, Destructive, Loading |
```

**Rules:**
- Document what exists in code, not what should exist. If the project has both shadcn and ad-hoc components, list both and note the inconsistency.
- Point to source files; do not duplicate component code into the doc.
- Variants come from prop unions in the type signature OR from the canonical Storybook stories — prefer Storybook when present.
- Only list components meant for reuse. Skip one-off page-level components (e.g., `LoginPage`) unless they're imported elsewhere.
- If `.grimoire/docs/components.md` already exists, update it — diff against existing entries to flag new or removed components.

### 6. Generate Project Context

Scan the codebase for deployment and infrastructure artifacts, then populate `.grimoire/docs/context.yml`. This file captures the project's ecosystem — how it's deployed, what services it talks to, and what infrastructure it depends on. If `context.yml` doesn't exist, copy it from the template first (`grimoire init` creates it, but this handles projects initialized before this feature).

**Where to look:**

| Artifact | What it tells you |
|----------|------------------|
| `Dockerfile`, `docker-compose.yml` | Containerized deployment; compose reveals linked services, databases, caches |
| `k8s/`, `kubernetes/`, `Chart.yaml`, `helmfile.yaml` | Kubernetes deployment; manifests reveal services, ingresses, config maps |
| `*.tf`, `terraform/`, `cdk.json`, `serverless.yml` | Infrastructure-as-code; reveals cloud provider, services, and architecture |
| `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/` | CI/CD platform and deploy triggers |
| `Procfile`, `app.json`, `vercel.json`, `netlify.toml` | PaaS deployment target |
| `fly.toml`, `render.yaml`, `railway.json` | PaaS deployment target |
| `.env.example`, `.env.template` | Environment variables reveal infrastructure dependencies (DB hosts, cache URLs, API keys) |
| `docker-compose.yml` services | Related services, databases, caches, queues running locally |
| API client wrappers, SDK config | Internal service dependencies |

**Workflow:**
1. Scan for the artifacts above — note what exists
2. Read `docker-compose.yml` (if present) — it's the richest source of service and infrastructure dependencies
3. Read `.env.example` (if present) — environment variables reveal what the project connects to
4. Read CI/CD config files — identify the platform, key workflows, and deploy triggers
5. Read IaC files (Terraform, CDK, etc.) — identify cloud provider and provisioned resources
6. Populate `context.yml` with what you found — fill in real values, remove unused commented sections
7. Present findings to the user for confirmation — they'll know about services and infrastructure that aren't discoverable from code alone (e.g., a shared auth service, a data warehouse they push to)

**Rules:**
- Only populate sections where you found evidence. Leave sections empty (with comments) rather than guessing.
- Use environment variable references (`${DATABASE_HOST}`) for hostnames and credentials — never hardcode real values.
- The `services` section is for **internal/sibling services** your org owns. Third-party APIs (Stripe, Twilio, etc.) belong in `schema.yml` under `external_api`.
- If `context.yml` already exists and has content, update it rather than overwriting — the user may have manually added entries.
- Ask the user about anything you can't determine from code: "I see a Redis connection in docker-compose but I'm not sure if it's just cache or also used for sessions — which is it?"

### 7. Generate Index
Create or update `.grimoire/docs/index.yml`:

```yaml
# Grimoire Project Map
# Auto-generated by /grimoire:discover
# Last updated: YYYY-MM-DD

areas:
  - name: api
    path: .grimoire/docs/api.md
    directory: src/api
    description: REST API layer — views, serializers, URL routing
  - name: models
    path: .grimoire/docs/models.md
    directory: src/models
    description: Data models, managers, querysets
  - name: utils
    path: .grimoire/docs/utils.md
    directory: src/utils
    description: Shared utilities, helpers, formatters

# Functional stories — how capabilities group for a human reader.
# `grimoire docs` uses this to group the OVERVIEW's Capabilities section.
# `features` lists feature-file basenames (no .feature extension).
stories:
  chat-qa:
    title: Chat & Q&A
    features: [ai-chat, a2ui-integration, search]
  extraction:
    title: Document extraction
    features: [document-pipeline, bbd-validation-rules]
```

The `directory` field links each doc back to the source directory — it's how a targeted refresh maps a changed directory to the area doc that describes it.

**Generate the `stories:` map.** Walk `features/`, then group the feature files by *functional story* — the user-facing capability area they serve, not the source directory. Propose the grouping to the user and let them rename/merge stories before writing. A feature not yet assigned to a story falls back to its feature-directory group in the OVERVIEW, so partial maps are fine. `stories` is the one place that grouping lives (DRY) — `grimoire docs` reads it, nothing else defines it.

### Freshness Tracking

Every area doc and the data schema must include a `Last updated` date in a comment or header. This lets other skills (plan, apply) judge whether the docs are trustworthy or stale.

**In `index.yml`**, track freshness per area:
```yaml
areas:
  - name: api
    path: .grimoire/docs/api.md
    directory: src/api
    description: REST API layer — views, serializers, URL routing
    last_updated: 2026-04-05
```

**In each area doc**, include a last-updated line at the top:
```markdown
# API Layer
> Last updated: 2026-04-05
```

**In `schema.yml`**, the `Last updated` comment at the top already serves this purpose.

**Staleness rule:** If an area doc is older than the most recent commit touching that directory (check via `git log -1 --format=%ci <directory>`), it's potentially stale. When running a full scan or gap fill, flag stale docs and offer to refresh them.

**Why this matters:** Area docs are the primary mechanism for reducing context window usage and preventing hallucinations. Stale docs are worse than no docs — they give the agent confident but wrong information about file paths, function names, and patterns. Freshness tracking lets other skills know when to trust the docs vs. when to fall back to reading source files.

### 8. Present Summary
After generating, show the user:
- How many areas documented
- Any areas whose boundaries seem unclear or whose conventions are inconsistent
- Suggest which area docs are most critical for the plan skill to read

## Integration with Other Skills

- The **plan** skill reads `.grimoire/docs/` for Purpose/Boundaries/Conventions before generating tasks, and queries the **graph** for symbols and reusable utilities
- The **verify** skill can check new code against documented conventions
- The **audit** skill can trigger a discover pass as part of onboarding
- The **design** skill reads `.grimoire/docs/components.md` first to avoid generating duplicate components
- The **plan** skill gates on staleness for level 3-4 changes (when an area's *intent* doc lags its directory) and directs the user to run a targeted refresh before planning

## Important
- **Start from the graph.** Use `get_architecture` to enumerate areas and `search_graph`/`trace_path` to understand each one. Read source files only to pin down intent the graph can't express.
- **Intent only — never transcribe structure.** Do not write Key Files lists, reusable-code inventories, or symbol tables into area docs. Those are derivable from the graph and would drift. The doc captures purpose, boundaries, and conventions; the doc points at the graph for everything else (DRY — one home per fact).
- **Document what IS, not what should be.** This describes the actual codebase, not aspirational standards. If the code is inconsistent, note it — don't paper over it.
- **Point, don't copy.** Reference one exemplar file per convention. Don't duplicate code into the docs.
- **Keep docs lean.** Each area doc should be scannable in 30 seconds. If it's too long, it's probably transcribing structure — cut it back to intent.
- **Don't document the obvious.** Skip areas self-explanatory from file names. Focus on areas where intent or boundaries are non-obvious.
- **Update, don't accumulate.** When refreshing, replace stale docs rather than appending.

## Done
When area docs, schema, context, and index are generated, the workflow is complete. Suggest `grimoire-audit` to document existing features and decisions as Gherkin specs and ADRs.
