import { spawn } from 'node:child_process';
import readline from 'node:readline';

export class McpStdioClient {
  constructor({ command, args = [], env = process.env, name = 'mcp', timeoutMs = 120_000 }) {
    if (!command) throw new Error('An MCP server command is required.');
    this.command = command;
    this.args = args;
    this.env = env;
    this.name = name;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.tools = [];
  }

  async start() {
    this.child = spawn(this.command, this.args, { stdio: ['pipe', 'pipe', 'pipe'], env: this.env, windowsHide: true });
    this.child.stderr.on('data', (chunk) => { this.lastStderr = `${this.lastStderr ?? ''}${chunk}`.slice(-8000); });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.#onLine(line));
    this.child.on('error', (error) => this.#failPending(error));
    this.child.on('exit', (code, signal) => this.#failPending(new Error(`MCP server ${this.name} exited (${code ?? signal}). ${this.lastStderr ?? ''}`)));
    await this.#request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'wreck-agent-framework', version: '0.1.0' },
    });
    this.#notify('notifications/initialized', {});
    const result = await this.#request('tools/list', {});
    this.tools = (result.tools ?? []).map((tool) => {
      const name = `mcp_${this.name}_${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      return {
        name,
        description: `[${this.name}] ${tool.description ?? tool.name}`.slice(0, 4000),
        parameters: tool.inputSchema ?? { type: 'object', properties: {}, additionalProperties: false },
        execute: (input) => this.callTool(tool.name, input),
      };
    });
    return this.tools;
  }

  #onLine(line) {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message ?? 'MCP request failed'));
    else pending.resolve(message.result ?? {});
  }

  #request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  #notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  async callTool(name, arguments_) {
    const result = await this.#request('tools/call', { name, arguments: arguments_ });
    if (result.isError) throw new Error((result.content ?? []).map((part) => part.text ?? '').join('\n') || `MCP tool ${name} failed`);
    const content = result.content ?? [];
    if (content.some((part) => part.type === 'image')) {
      return {
        type: 'mcp-rich-content',
        parts: content.map((part) => part.type === 'image'
          ? { type: 'image', mimeType: part.mimeType, data: part.data }
          : { type: 'text', text: part.text ?? JSON.stringify(part) }),
      };
    }
    return content.map((part) => part.text ?? JSON.stringify(part)).join('\n') || result.structuredContent || result;
  }

  #failPending(error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  async close() {
    if (!this.child || this.child.killed) return;
    this.lines?.close();
    this.child.stdin.end();
    const killer = setTimeout(() => this.child?.kill('SIGTERM'), 1000);
    killer.unref();
  }
}
