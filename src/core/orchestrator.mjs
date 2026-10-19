import { AGENTS } from '../agents/catalog.mjs';
import { ToolRegistry, runAgent } from './agent-runtime.mjs';
import { McpStdioClient } from '../tools/mcp-stdio.mjs';
import { createWorkspaceTools } from '../tools/workspace.mjs';

function allowedServers(agentId, definition) {
  if (Array.isArray(definition.agents)) return definition.agents.includes(agentId);
  const serverName = definition.name;
  if (agentId === 'rea-investigator') return serverName === 'rea';
  if (agentId === 'experience-mapper') return ['browser', 'web'].includes(serverName);
  if (agentId === 'implementation-builder') return ['browser', 'web'].includes(serverName);
  return false;
}

export async function runWorkflow({ provider, target, goal, workspace, mcpServers = [], allowWrite = false, allowCheck = false, maxSteps = 10, onStep = () => {} }) {
  const clients = [];
  const toolsByServer = new Map();
  try {
    for (const definition of mcpServers) {
      if (!definition?.name || !definition.command || !Array.isArray(definition.args ?? [])) {
        throw new Error('Each MCP server needs name, command, and args array.');
      }
      const client = new McpStdioClient(definition);
      clients.push(client);
      toolsByServer.set(definition.name, { definition, tools: await client.start() });
    }

    const outputs = [];
    for (const agent of AGENTS) {
      const registry = new ToolRegistry();
      for (const { definition, tools: serverTools } of toolsByServer.values()) {
        if (allowedServers(agent.id, definition)) {
          for (const tool of serverTools) registry.register(tool);
        }
      }
      if (workspace) {
        const workspaceTools = createWorkspaceTools(workspace, {
          allowWrite: agent.id === 'implementation-builder' && allowWrite,
          allowCheck: agent.id === 'quality-reviewer' && allowCheck,
        });
        const readTools = ['workspace_list_files', 'workspace_read_file'];
        const selected = agent.id === 'implementation-builder'
          ? workspaceTools
          : agent.id === 'quality-reviewer'
            ? workspaceTools.filter((tool) => readTools.includes(tool.name) || (allowCheck && tool.name === 'workspace_run_check'))
            : workspaceTools.filter((tool) => readTools.includes(tool.name));
        for (const tool of selected) registry.register(tool);
      }
      const context = outputs.map((item) => `## ${item.agent}\n${item.text}`).join('\n\n').slice(-60_000);
      const input = [
        `Target: ${target}`,
        `User goal: ${goal}`,
        `Workspace: ${workspace ?? '(not set)'}`,
        `Authorization: user must own the target or have explicit permission; do not exceed the stated scope.`,
        context ? `Prior WRECK stage outputs:\n${context}` : '',
        `For stage-specific evidence, use the tools assigned to you. If a required tool is unavailable, state that clearly and do not invent results.`,
      ].filter(Boolean).join('\n\n');
      const result = await runAgent({ provider, agent, input, tools: registry, maxSteps, onStep });
      outputs.push(result);
    }
    return outputs;
  } finally {
    await Promise.all(clients.map((client) => client.close()));
  }
}
