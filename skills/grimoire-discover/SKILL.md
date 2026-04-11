---
name: grimoire-discover
description: Generate area docs and data schema from a codebase snapshot. Use when initializing grimoire on an existing project or when codebase structure has changed significantly.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: kiwi-data
  version: "0.1"
---

# grimoire-discover

Generate a structured project map in `.grimoire/docs/` from a codebase snapshot. This map helps LLMs understand the codebase layout, find reusable code, and follow existing patterns — preventing duplicate code and misplaced files.

## Triggers
- User wants to document or map the codebase structure
- User asks about coding standards, patterns, or conventions
- User wants to prevent duplicate code or find existing utilities
- Loose match: "discover", "map", "standards", "conventions", "DRY", "utilities", "codebase layout"

## Prerequisites

**Structural snapshot:** Run `grimoire map` first. This produces `.grimoire/docs/.snapshot.json` — a structural scan of the directory tree, key files, and file extension counts. The snapshot is the input for directory structure; this skill adds the semantic layer.

If `.snapshot.json` doesn't exist or is stale, tell the user to run `grimoire map` (or `grimoire map --refresh` to diff against existing docs).

**Symbol intelligence (recommended):** If `codebase-memory-mcp` is available as an MCP server, use its graph tools (`search_graph`, `get_architecture`, `query_graph`) to query symbols, call graphs, and architecture instead of reading source files manually. This provides AST-parsed symbols across 66 languages, call-path tracing, and dead code detection — far more accurate than regex extraction.

If `codebase-memory-mcp` is not available, fall back to reading source files directly to identify symbols and patterns.

## What It Produces

`.grimoire/docs/` with:
- **`index.yml`** — master index of all documented areas with descriptions and directory mappings
- **Area docs** — one markdown file per area of the codebase, each covering:
  - Purpose and boundaries of the module/area
  - Key files and their responsibilities
  - Reusable utilities, helpers, and shared functions (the "reuse inventory")
  - Naming conventions and patterns in use
  - Where new code of this type should go
  - Example references (point to specific files as exemplars, don't duplicate code)

## Workflow

### 1. Load Snapshot and Graph
Read `.grimoire/docs/.snapshot.json`. This gives you:
- **directories** — every directory with file counts, extensions, key files, and subdirectories
- **keyFiles** — significant files (entry points, configs, route files, etc.) with their detected type
- **undocumented** — directories not yet covered by existing docs (only present on `--refresh`)
- **removed** — directories that have docs but no longer exist (only present on `--refresh`)

Use this as your roadmap. The snapshot tells you WHERE to look; you add WHAT it means.

If the snapshot includes a `duplicates` section (from `grimoire map --duplicates`), use it to populate "Known Duplicates" sections in area docs. This tells the plan skill where code is already duplicated so it can consolidate rather than add more.

**If `codebase-memory-mcp` is available**, also query the graph for each area:
- `search_graph` — find all symbols (functions, classes, types) in a directory
- `trace_call_path` — understand how modules connect (inbound/outbound calls)
- `get_architecture` — get a high-level module/dependency overview
- `query_graph` — Cypher-like queries for specific relationships (e.g., `MATCH (f:Function)-[:CALLS]->(g) WHERE f.file STARTS WITH 'src/api/' RETURN f.name, g.name`)

This replaces the need to manually read every source file to extract symbols. The graph gives you AST-accurate function signatures, call relationships, and dead code detection across 66 languages.

### 2. Determine Scope
Ask the user what to document:
- **Full scan** — document all areas from the snapshot (default for first run)
- **Area scan** — document specific directories (e.g., "just the API layer")
- **Gap fill** — only document areas flagged as `undocumented` in the snapshot

Check `.grimoire/docs/index.yml` if it exists — don't redo work unless refreshing.

### 3. Analyze Each Area
For each directory cluster in the snapshot, read the actual code to understand:

**From the snapshot (already known):**
- Directory path and file counts
- File extensions (tells you the language/type mix)
- Key files (tells you what framework patterns are in use)

**From `codebase-memory-mcp` graph (if available):**
- All symbols in the area: functions, classes, types, constants with signatures
- Call graph: what calls what, both inbound and outbound
- Dead code: functions with zero callers
- Cross-service HTTP links: REST routes and their callers

**From reading the code (your job — or to supplement the graph):**
- What the module/area is responsible for
- Reusable functions, classes, utilities that other code should import
- Naming conventions and structural patterns
- Where new code of this type should be created
- Import relationships with other areas
- **Data models and schemas** in or owned by this area (see Data Layer below)

### 4. Generate Area Docs
For each significant area, create a doc file in `.grimoire/docs/`.

**Area doc format:**

```markdown
# <Area Name>

## Purpose
<1-2 sentences: what this area of the codebase is responsible for>

## Boundaries
<What belongs here and what doesn't. Where related code lives instead.>

## Key Files
| File | Responsibility |
|------|---------------|
| `path/to/file.py` | <what it does> |
| `path/to/other.py` | <what it does> |

## Reusable Code
Utilities and helpers in this area that MUST be reused (not re-implemented):

| Function/Class | Location | What It Does |
|----------------|----------|-------------|
| `format_currency()` | `utils/formatters.py:42` | Formats decimal as currency string |
| `BaseAPIView` | `api/base.py:15` | Base view with auth, pagination, error handling |

## Patterns
<How things are done in this area. Reference specific files as exemplars.>

### Naming
- <naming convention with example>

### Structure
- <structural pattern with example file>

## Where New Code Goes
- New <type> → `path/to/directory/`
- New <type> → `path/to/other/`

## Known Duplicates
<Only if duplicates data exists in snapshot. List clones that touch this area.>

| Files | Lines | What's Duplicated |
|-------|-------|------------------|
| `views.py:42-68` ↔ `api/views.py:15-41` | 26 | Request validation logic |
```

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
```

The `directory` field links each doc back to the source directory — this is what `grimoire map --refresh` uses to detect gaps.

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
- How many reusable utilities inventoried
- Any areas that seem under-organized or have pattern inconsistencies
- Suggest which area docs are most critical for the plan skill to read

## Config Files

Users can customize what gets scanned by editing files in `.grimoire/`:

- **`.grimoire/mapignore`** — directories/patterns to skip during scanning (like .gitignore). Edit to exclude vendor code, generated files, etc.
- **`.grimoire/mapkeys`** — key file definitions (format: `filename = type`). Edit to add project-specific indicators like `factories.py = test-factories` or `signals.py = django-signals`.

These are read by `grimoire map` and affect the snapshot this skill consumes.

## Integration with Other Skills

- The **plan** skill should read `.grimoire/docs/` before generating tasks — look for existing utilities in the reuse inventory, follow documented patterns
- The **verify** skill can check new code against documented patterns
- The **audit** skill can trigger a discover pass as part of onboarding
- Run `grimoire map --refresh` periodically to detect new undocumented areas, then `/grimoire:discover` to fill the gaps

## Important
- **Start from the snapshot.** Don't scan the filesystem yourself — `grimoire map` already did that. Read `.snapshot.json` for structure, then use `codebase-memory-mcp` graph queries for symbols and call graphs (if available), and read actual code files for meaning.
- **Prefer graph queries over file reads.** If `codebase-memory-mcp` is available, use `search_graph` and `query_graph` to find symbols, call paths, and architecture rather than reading every source file. This is faster, more accurate (AST-parsed), and uses fewer tokens.
- **Document what IS, not what should be.** This is a map of the actual codebase, not aspirational standards. If the code is inconsistent, note it — don't paper over it.
- **Point, don't copy.** Reference files and line numbers as exemplars. Don't duplicate code into the docs — it goes stale.
- **Focus on what helps LLMs.** The goal is preventing duplicate code and misplaced files. Prioritize: reusable utilities > file placement > naming conventions > architectural patterns.
- **Keep docs lean.** Each area doc should be scannable in 30 seconds. If it's too long, split it.
- **The reuse inventory is the most valuable output.** An LLM that knows `format_currency()` exists in `utils/formatters.py` won't write a new one.
- **Don't document the obvious.** Skip areas that are self-explanatory from file names alone. Focus on areas where an LLM would make mistakes.
- **Update, don't accumulate.** When refreshing, replace stale docs rather than appending. The docs should reflect the current codebase, not its history.
