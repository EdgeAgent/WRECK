# WRECK architecture

## WRECK is the framework

WRECK owns the orchestration runtime, provider boundary, tool registry, MCP stdio client, specialist agent catalog, per-agent permission routing, and workspace tools. These are implemented in `src/` and invoked through `wreck agents`, `wreck agent`, and `wreck run`.

The complete REA and AI Website Cloner source snapshots are included separately as capability sources. The REA MCP toolchain can be connected to WRECK’s investigator role; the cloner's skill and Next.js source are used for visual reconstruction. WRECK's runtime and framework code do not depend on importing their internal modules.

## Agent flow

```text
Scope Planner
    ↓ target boundary and investigation plan
REA Investigator ── REA MCP tools (optional, role-restricted)
    ↓ cited technical findings and limitations
Experience Mapper ── browser/web MCP tools (optional, role-restricted)
    ↓ routes, responsive states, interactions, asset map
Implementation Builder ── workspace read/write (write opt-in)
    ↓ working implementation and local evidence
Quality Reviewer ── workspace read + fixed check command (check opt-in)
    ↓ verified results, known gaps, and evidence references
```

Each agent receives summaries from prior stages. A provider adapter calls the model; model tool calls are resolved only by tools registered for that role. The runtime caps tool-loop steps and output. Without a relevant tool, an agent must report that the evidence is unavailable rather than inventing it.

## Main components

| Component | WRECK-owned responsibility |
|---|---|
| `src/core/agent-runtime.mjs` | Provider contract, JSON-schema tool registry, tool-call loop, output caps, and max-step limit. |
| `src/core/orchestrator.mjs` | Sequential agent graph and least-privilege tool routing. |
| `src/agents/catalog.mjs` | Five specialist roles and safety instructions. |
| `src/providers/openai-compatible.mjs` | Default provider adapter for OpenAI Chat Completions-compatible endpoints. |
| `src/tools/mcp-stdio.mjs` | Generic MCP tool discovery/invocation over stdio; forwards supported, size-bounded screenshots to vision-capable providers. |
| `src/tools/workspace.mjs` | Project-contained file tools; secrets, symlinks, dependencies, and build paths blocked; writes/checks opt-in. |
| `SPEC.md` / `wreck.config.json` | Shared evidence and configuration contract for each generated app. |

## Provider and tool universality

The model layer is an interface: `complete({ model, messages, tools })`. The included adapter handles a common OpenAI-compatible protocol, including `image_url` data-URL inputs; a custom JavaScript adapter can translate to a different vendor's text/vision API without altering agent logic. WRECK uses configured model IDs rather than hard-coding a vendor model.

The tool layer is MCP-over-stdio by default. Each project can attach trusted MCP servers and route them to selected agent IDs. Other transports can be added behind the same tool registry. WRECK does not configure external services or install servers automatically.

## Handoff and traceability

`docs/research/wreck/SPEC.md` links findings to source/tool evidence, confidence, limitations, route/state observations, implementation requirements, and verification. `wreck.config.json` stores target metadata and tool-server commands but no credentials. Provider keys are read from the runtime environment and never persisted by WRECK.

## Why upstreams remain separate

REA and the cloner are independently versioned codebases with different runtime requirements and their own release/test workflows. The included REA snapshot requires Node `^22.19 || ^24.11 || >=26`; the cloner declares Node `>=24`. Merging their dependencies into WRECK's root would make the framework brittle. WRECK includes both full source snapshots, preserves their licenses, and connects to them through MCP, generated project artifacts, and the cloner's skill.

## Non-goals

WRECK does not bypass authentication, scrape private data, extract secrets, impersonate a site, or guarantee a pixel-perfect result. It requires authorization and explicit reporting of uncertainty and remaining differences.
