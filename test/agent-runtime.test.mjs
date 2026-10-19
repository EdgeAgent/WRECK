import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry, runAgent } from '../src/core/agent-runtime.mjs';
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.mjs';
import { AGENTS, getAgent } from '../src/agents/catalog.mjs';

test('registers tools and rejects invalid or duplicate tool names', () => {
  const tools = new ToolRegistry();
  tools.register({ name: 'read_file', execute: async () => 'contents' });
  assert.equal(tools.modelTools()[0].function.name, 'read_file');
  assert.throws(() => tools.register({ name: 'read_file', execute: async () => '' }), /Duplicate/);
  assert.throws(() => tools.register({ name: 'bad.name', execute: async () => '' }), /Tool names/);
});

test('runs an agent tool loop using an injected provider without vendor lock-in', async () => {
  const calls = [];
  const tools = new ToolRegistry().register({ name: 'lookup', description: 'Test tool', execute: async ({ query }) => ({ result: `found:${query}` }) });
  const provider = {
    async complete(request) {
      calls.push(request);
      if (calls.length === 1) return { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 't1', type: 'function', function: { name: 'lookup', arguments: JSON.stringify({ query: 'evidence' }) } }] } }] };
      return { choices: [{ message: { role: 'assistant', content: 'Evidence is ready.' } }] };
    },
  };
  const result = await runAgent({ provider, agent: getAgent('rea-investigator'), input: 'Inspect the scoped app.', tools });
  assert.equal(result.text, 'Evidence is ready.');
  assert.equal(result.steps, 2);
  assert.equal(calls[0].tools[0].function.name, 'lookup');
  assert.equal(calls[1].messages.find((message) => message.role === 'tool').content, '{"result":"found:evidence"}');
});

test('enforces per-agent step limits', async () => {
  const provider = { async complete() { return { choices: [{ message: { tool_calls: [{ id: 'again', function: { name: 'echo', arguments: '{}' } }] } }] }; } };
  const tools = new ToolRegistry().register({ name: 'echo', execute: async () => 'again' });
  await assert.rejects(runAgent({ provider, agent: getAgent('scope-planner'), input: 'Plan', tools, maxSteps: 1 }), /tool limit/);
});

test('provides a provider adapter with no fixed model identifier', async () => {
  let request;
  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://llm.example/v1/', apiKey: 'test-token', model: 'test-model',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    },
  });
  const response = await provider.complete({ messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(response.choices[0].message.content, 'ok');
  assert.equal(request.url, 'https://llm.example/v1/chat/completions');
  assert.equal(request.init.headers.authorization, 'Bearer test-token');
  assert.equal(JSON.parse(request.init.body).model, 'test-model');
  assert.equal(new OpenAICompatibleProvider({ apiKey: 'key', fetchImpl: fetch }).model, undefined);
});

test('exposes a set of focused, ordered specialist agents', () => {
  assert.deepEqual(AGENTS.map((agent) => agent.id), ['scope-planner', 'rea-investigator', 'experience-mapper', 'implementation-builder', 'quality-reviewer']);
});


test('orchestrates all five WRECK agents sequentially and hands summaries forward', async () => {
  const requests = [];
  const provider = {
    async complete(request) {
      requests.push(request);
      return { choices: [{ message: { role: 'assistant', content: `stage-${requests.length}-complete` } }] };
    },
  };
  const { runWorkflow } = await import('../src/core/orchestrator.mjs');
  const outputs = await runWorkflow({ provider, target: 'https://example.test', goal: 'rebuild owned app', mcpServers: [] });
  assert.deepEqual(outputs.map((item) => item.agent), AGENTS.map((item) => item.id));
  assert.equal(outputs.length, 5);
  assert.match(requests[1].messages[1].content, /scope-planner/);
  assert.match(requests[1].messages[1].content, /stage-1-complete/);
  assert.match(requests[4].messages[1].content, /stage-4-complete/);
});


test('routes a configured MCP server only to the agent IDs it allows', async () => {
  const requests = [];
  let callNumber = 0;
  const provider = {
    async complete(request) {
      requests.push(request);
      const tool = request.tools?.[0]?.function;
      if (tool && requests.at(-1).messages[0].content.includes('REA Investigator') && callNumber === 0) {
        callNumber += 1;
        return { choices: [{ message: { tool_calls: [{ id: 'allowed-tool', type: 'function', function: { name: tool.name, arguments: '{}' } }] } }] };
      }
      return { choices: [{ message: { content: 'stage complete' } }] };
    },
  };
  const serverScript = `
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      buffer += chunk;
      for (;;) {
        const index = buffer.indexOf('\\n'); if (index < 0) break;
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        if (!line.trim()) continue;
        const m = JSON.parse(line); if (m.id === undefined) continue;
        let result = {};
        if (m.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'test', version: '1' } };
        if (m.method === 'tools/list') result = { tools: [{ name: 'lookup', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }] };
        if (m.method === 'tools/call') result = { content: [{ type: 'text', text: 'authorized tool result' }] };
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }) + '\\n');
      }
    });
  `;
  const { runWorkflow } = await import('../src/core/orchestrator.mjs');
  const outputs = await runWorkflow({
    provider,
    target: 'https://example.test',
    goal: 'test least privilege',
    mcpServers: [{ name: 'private_tools', command: process.execPath, args: ['-e', serverScript], agents: ['rea-investigator'] }],
  });
  assert.equal(outputs.length, 5);
  const reaRequests = requests.filter((request) => request.messages[0].content.includes('REA Investigator'));
  const nonReaRequests = requests.filter((request) => !request.messages[0].content.includes('REA Investigator'));
  assert.ok(reaRequests.some((request) => request.tools?.some((tool) => tool.function.name === 'mcp_private_tools_lookup')));
  assert.ok(nonReaRequests.every((request) => !request.tools?.some((tool) => tool.function.name === 'mcp_private_tools_lookup')));
});


test('passes MCP screenshot results to the next provider turn as image evidence', async () => {
  let imagePart;
  let called = false;
  const provider = {
    async complete(request) {
      imagePart = request.messages.find((message) => message.role === 'user' && Array.isArray(message.content))?.content?.find((part) => part.type === 'image_url');
      if (!called) {
        called = true;
        return { choices: [{ message: { tool_calls: [{ id: 'shot-1', type: 'function', function: { name: 'capture', arguments: '{}' } }] } }] };
      }
      return { choices: [{ message: { content: 'The screenshot shows the authorized page.' } }] };
    },
  };
  const tools = new ToolRegistry().register({
    name: 'capture',
    execute: async () => ({ type: 'mcp-rich-content', parts: [{ type: 'text', text: 'Viewport screenshot' }, { type: 'image', mimeType: 'image/png', data: 'AA==' }] }),
  });
  const result = await runAgent({ provider, agent: getAgent('experience-mapper'), input: 'Inspect this screenshot.', tools });
  assert.equal(result.text, 'The screenshot shows the authorized page.');
  assert.equal(imagePart.image_url.url, 'data:image/png;base64,AA==');
});
