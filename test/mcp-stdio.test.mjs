import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { McpStdioClient } from '../src/tools/mcp-stdio.mjs';

test('discovers and invokes tools from a standards-shaped MCP stdio server', async () => {
  const serverScript = `
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      buffer += chunk;
      for (;;) {
        const index = buffer.indexOf('\\n');
        if (index < 0) break;
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === undefined) continue;
        let result = {};
        if (message.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'test', version: '1' } };
        if (message.method === 'tools/list') result = { tools: [
          { name: 'lookup', description: 'Return test evidence', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
          { name: 'capture', description: 'Capture a test screenshot', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
        ] };
        if (message.method === 'tools/call' && message.params.name === 'capture') result = { content: [{ type: 'text', text: 'Browser screenshot' }, { type: 'image', mimeType: 'image/png', data: 'AA==' }] };
        if (message.method === 'tools/call' && message.params.name === 'lookup') result = { content: [{ type: 'text', text: 'evidence:' + message.params.arguments.query }] };
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\\n');
      }
    });
  `;
  const client = new McpStdioClient({ command: process.execPath, args: ['-e', serverScript], name: 'rea' });
  try {
    const tools = await client.start();
    assert.equal(tools.length, 2);
    assert.equal(tools[0].name, 'mcp_rea_lookup');
    assert.equal(await tools[0].execute({ query: 'homepage route' }), 'evidence:homepage route');
    const imageResult = await tools[1].execute({});
    assert.equal(imageResult.type, 'mcp-rich-content');
    assert.equal(imageResult.parts[1].data, 'AA==');
  } finally {
    await client.close();
  }
});
