---
status: accepted
date: 2026-04-02
decision-makers: [Fred]
---

# Use YAML for data schema documentation

## Context and Problem Statement
Grimoire needs a format to document the data layer — database tables, document collections, and external API contracts — so that AI agents understand the data model without reading model files. The format must handle both relational and non-relational schemas.

## Decision Drivers
- Must support SQL tables with typed fields, constraints, and relationships
- Must support document stores (MongoDB, DynamoDB) with nested objects/arrays
- Must support external API contracts with schema references (OpenAPI, docs URLs)
- AI agents should be able to read and write it trivially
- Already in the grimoire stack (config.yaml, mapkeys)

## Considered Options
1. YAML (`.grimoire/docs/data/schema.yml`)
2. DBML (Database Markup Language)
3. JSON Schema
4. Inline documentation in model files

## Decision Outcome
Chosen option: "YAML", because it handles both relational and document schemas with the same syntax, supports nested structures naturally, and is already used throughout grimoire. DBML only handles relational databases. JSON Schema is verbose and harder for humans to read. Inline docs require reading every model file.

### Consequences
- Good: One format for SQL tables, document collections, and external APIs
- Good: AI agents read and write YAML trivially — no special parser needed
- Good: Compact enough to fit in context alongside area docs
- Good: `schema_ref` field supports pointers to OpenAPI specs and external docs
- Bad: No built-in validation (unlike DBML which has a parser)
- Bad: YAML indentation sensitivity can cause subtle errors

### Confirmation
If the plan skill references `schema.yml` to correctly order data migrations before feature code, and the data engineer review persona can assess schema design from it, the decision is validated.
