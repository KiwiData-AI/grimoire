# Design Tool MCP Setup ({{tool}})

`{{tool}}` does not currently have a first-class MCP server in the grimoire registry.
Use this checklist to wire one up manually so AI agents can read your designs.

## 1. Install an MCP server for your tool

Search for an MCP server compatible with `{{tool}}` (e.g., `mcp-{{tool}}` on
npm, GitHub, or the MCP server registry at https://github.com/modelcontextprotocol).

If none exists, fall back to the HTML/ASCII path: `grimoire-design` will render
previews from a textual description and lint them against `.grimoire/brand/tokens.json`.

## 2. Set environment variables

Most design-tool MCPs require an API token. Export it in your shell, never in
`.grimoire/config.yaml`:

```bash
export {{tool}}_ACCESS_TOKEN=...
```

## 3. Register the server in your agent config

For Claude Code, add to `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "{{tool}}": {
      "command": "npx",
      "args": ["-y", "<mcp-package-name>"]
    }
  }
}
```

For other agents, see their MCP documentation.

## 4. Restart your agent and verify

Restart the agent. In `grimoire-design`, run a small request like "fetch the
homepage frame" to confirm the MCP responds.

## 5. Update `.grimoire/config.yaml`

Once the MCP is working, add it under `project.design_tool.mcp`:

```yaml
project:
  design_tool:
    name: {{tool}}
    mcp:
      name: {{tool}}-mcp
      command: npx
      args: ["-y", "<mcp-package-name>"]
```

Re-run `grimoire init` is not necessary — just save the file.
