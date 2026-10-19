# Research notes: REA + AI Website Cloner

Research performed against the upstream repositories included in this snapshot. These notes distinguish upstream facts from WRECK design choices.

## REA (`morluto/rea`)

- Official repository: <https://github.com/morluto/rea>.
- The README identifies REA as an MCP/CLI toolset and advises obtaining it from official channels, not similarly named copies.
- The inspected README documents setup with `npx rea-agents setup`, supported coding agents, CLI use such as `npx -y rea-agents@latest analyze-javascript-application <path> --json`, and native analysis requiring a configured provider/tool.
- In the included revision, `package.json` reports version `6.7.0`, ESM, CLI binaries `rea` and `rea-agents`, and Node engine `^22.19.0 || ^24.11.0 || >=26.0.0`.
- REA findings are evidence-based and may include limitations. It is not a generic automatic “reverse any website backend” switch; the applicable interface depends on the target and installed tools.
- WRECK includes the full upstream source and preserved MIT license under `packages/rea/`.

## AI Website Cloner Template (`JCodesMore/ai-website-cloner-template`)

- Official upstream used: <https://github.com/JCodesMore/ai-website-cloner-template>.
- The README describes the `/clone-website <URL>` agent workflow and four stages: Map, Observe, Build, Compare. The skill is cross-agent, with a canonical `.agents/skills/clone-website/` and an explicit Claude Code bridge.
- The included `package.json` declares Next.js `16.3.5`, React `19.2.4`, Tailwind CSS v4, and Node `>=24`; `npm run check` performs lint, TypeScript typecheck, and production build.
- The upstream README explicitly cautions against phishing/impersonation, claiming others’ designs as one’s own, and violating site terms.
- WRECK includes the full upstream source and preserved MIT license under `apps/website-cloner/`.

## WRECK design decisions

- WRECK's original framework is under `src/`: provider interface, sequential specialist-agent orchestrator, JSON-schema tool registry, generic MCP-over-stdio client, and opt-in workspace tools. These WRECK-owned components are tested independently of upstream packages.
- WRECK does not merge the two upstream package manifests because their Node requirements, dependencies, and release processes differ.
- REA's public setup/CLI documentation exposes MCP and CLI interfaces; WRECK uses the standard MCP stdio protocol for configured tool servers rather than importing REA internals.
- The cloner ships a portable `clone-website` agent skill in addition to its Next.js template. WRECK includes the complete source snapshot and generates projects from it; a browser MCP server or supported browser-enabled coding agent is required for live visual inspection.
- Provider calls and tool processes occur only when the user runs an agent/workflow command. WRECK does not auto-install REA, silently alter coding-agent configuration, or persist provider credentials.
- WRECK's run plan and SPEC contract connect REA findings to route/state requirements and visual verification, with explicit confidence and limitation fields.
