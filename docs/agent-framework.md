# WRECK agent framework

WRECK is its own extensible, sequential multi-agent runtime. A run combines a specialist role, a provider adapter, and a least-privilege set of tools. REA and the website cloner are included source projects, not WRECK's framework core.

## WRECK-owned layers

- **Agent roles** in `src/agents/catalog.mjs`: Scope Planner, REA Investigator, Experience Mapper, Implementation Builder, and Quality Reviewer.
- **Agent runtime** in `src/core/agent-runtime.mjs`: provider contract, tool registry, model tool-call loop, bounded steps/output, and tool-name validation.
- **Orchestrator** in `src/core/orchestrator.mjs`: runs the roles in order and passes earlier summaries forward. It assigns REA tools only to the investigator, browser tools only to mapping/build roles, and project tools according to permissions.
- **Provider boundary** in `src/providers/`: `complete({ model, messages, tools })` is the provider interface. The included adapter supports OpenAI Chat Completions-compatible services. Set a provider-specific model ID; WRECK hard-codes none.
- **MCP adapter** in `src/tools/mcp-stdio.mjs`: any configured MCP-over-stdio server can provide functions to WRECK. Text and bounded image results are preserved; screenshots are forwarded as image inputs to the next model turn. Tool servers are configured per project and may be restricted by agent ID.
- **Workspace adapter** in `src/tools/workspace.mjs`: scoped file listing/read/write and a fixed check command; secrets, symlink paths, Git/dependency/build paths, and oversized files are blocked.

## Run the agent team

Set these environment variables at runtime; WRECK never writes the key into `wreck.config.json`:

```text
WRECK_LLM_BASE_URL=https://your-provider.example/v1
WRECK_LLM_API_KEY=...             # use a secret store; don't commit
WRECK_LLM_MODEL=provider-model-id
```

Then:

```bash
node src/cli.mjs agents
node src/cli.mjs run --dir ./my-rebuild --goal "Rebuild the authorized account settings flow" --allow-write --allow-check
```

The `run` command starts all five agents sequentially. Use `node src/cli.mjs agent <agent-id> --dir <project> --input "..."` to run one stage. Tool calls are bounded by `--max-steps`; default is 10 per agent.

The built-in provider handles the common OpenAI Chat Completions-compatible request shape, including image inputs. To support a provider with a different API, write a JavaScript module exporting `createProvider({ env })` that returns an object implementing `complete({ model, messages, tools })`, then set `WRECK_PROVIDER_MODULE` to that module's path. The module receives standard chat messages; tool-produced screenshots are represented as `image_url` data URLs. Adapt that representation to the provider's native multimodal format. This keeps provider authentication and API-specific request/response translation outside the agent core. The plugin is executable code; only load provider modules you trust.

## MCP server configuration

A generated `wreck.config.json` contains `mcpServers: []`. Add trusted stdio servers with executable and argument array (never a shell command string), e.g.:

```json
{
  "mcpServers": [
    { "name": "rea", "command": "rea", "args": ["mcp"] },
    { "name": "browser", "command": "your-browser-mcp", "args": [], "agents": ["experience-mapper", "implementation-builder"] }
  ]
}
```

`rea` tools are routed to `rea-investigator` by default; `browser` and `web` tools to the mapper and builder. Any custom server can use `agents: [...]` to identify the roles allowed to call it. Read each server's docs and decide what it can access. WRECK does not install servers or alter external agent settings.

## Permission model

By default, workspace tools are read-only. `workspace_write_file` is added only with `--allow-write`; the `workspace_run_check` fixed command is added only with `--allow-check`. These flags are explicit because file writes and package scripts can have side effects. The framework does not expose an arbitrary shell tool. Run with provider credentials and MCP servers you trust; LLM calls send the supplied prompt/context to that configured provider.

## Integration with the two source projects

REA's complete upstream code is included under `packages/rea/`, with its own CLI/MCP server and license. The complete AI Website Cloner source is included under `apps/website-cloner/`, including its portable clone-website agent skill and Next.js template. WRECK consumes these through MCP, project artifacts, and the generated Next.js workspace. The exact interfaces and provenance are recorded in [research notes](research-notes.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

## Current limitations

The included generic MCP client supports stdio transport; HTTP transports can be added behind the same tool contract. Browser operation requires a configured browser MCP server or execution inside a browser-enabled coding agent. Screenshot interpretation requires a vision-capable model; unsupported image types and oversized image data are omitted with a tool note. WRECK agents must report when required evidence or tools are unavailable rather than inventing output.
