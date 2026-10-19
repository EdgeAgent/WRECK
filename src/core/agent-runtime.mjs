export class ToolRegistry {
  #tools = new Map();

  register(tool) {
    if (!tool?.name || !/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
      throw new Error('Tool names must be 1–64 letters, numbers, underscores, or hyphens.');
    }
    if (this.#tools.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
    if (typeof tool.execute !== 'function') throw new Error(`Tool ${tool.name} needs an execute function.`);
    const parameters = tool.parameters ?? { type: 'object', properties: {}, additionalProperties: false };
    this.#tools.set(tool.name, { ...tool, parameters });
    return this;
  }

  list() {
    return [...this.#tools.values()];
  }

  modelTools() {
    return this.list().map(({ name, description, parameters }) => ({
      type: 'function',
      function: { name, description: description ?? name, parameters },
    }));
  }

  async execute(name, input) {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`The model requested an unavailable tool: ${name}`);
    const result = await tool.execute(input ?? {});
    if (result?.type === 'mcp-rich-content' && Array.isArray(result.parts)) {
      let remainingImageChars = 12_000_000;
      let remainingTextChars = 100_000;
      const parts = [];
      for (const part of result.parts) {
        if (part?.type === 'text') {
          const text = String(part.text ?? '');
          parts.push({ type: 'text', text: text.slice(0, remainingTextChars) });
          remainingTextChars = Math.max(0, remainingTextChars - text.length);
        } else if (part?.type === 'image') {
          const mimeType = String(part.mimeType ?? '').toLowerCase();
          const data = String(part.data ?? '');
          if (!/^image\/(png|jpeg|webp|gif)$/.test(mimeType) || !/^[a-zA-Z0-9+/]*={0,2}$/.test(data) || data.length > remainingImageChars) {
            parts.push({ type: 'text', text: `[Image omitted: unsupported or over the WRECK image-data limit (${mimeType || 'unknown type'}).]` });
          } else {
            remainingImageChars -= data.length;
            parts.push({ type: 'image', mimeType, data });
          }
        }
      }
      return { type: 'mcp-rich-content', parts };
    }
    const content = typeof result === 'string' ? result : JSON.stringify(result ?? null);
    return content.length > 100_000 ? `${content.slice(0, 100_000)}\n[Tool output truncated at 100 KB]` : content;
  }
}

export async function runAgent({ provider, agent, input, tools = new ToolRegistry(), maxSteps = 10, onStep = () => {} }) {
  if (!provider || typeof provider.complete !== 'function') throw new Error('A provider implementing complete() is required.');
  if (!agent?.id || !agent?.system) throw new Error('An agent definition with id and system instructions is required.');
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 50) throw new Error('maxSteps must be between 1 and 50.');
  const messages = [
    { role: 'system', content: agent.system },
    { role: 'user', content: String(input) },
  ];
  const available = tools.modelTools();

  for (let step = 1; step <= maxSteps; step += 1) {
    onStep({ type: 'model', agent: agent.id, step });
    const reply = await provider.complete({ model: agent.model, messages, tools: available.length ? available : undefined });
    const message = reply?.choices?.[0]?.message ?? reply?.message;
    if (!message) throw new Error('Provider response did not contain an assistant message.');
    messages.push({ role: 'assistant', content: message.content ?? null, ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) });
    const calls = message.tool_calls ?? [];
    if (!calls.length) return { agent: agent.id, text: message.content ?? '', steps: step };

    for (const call of calls) {
      if (call.type && call.type !== 'function') throw new Error(`Unsupported model tool-call type: ${call.type}`);
      const name = call.function?.name;
      let args;
      try {
        args = JSON.parse(call.function?.arguments ?? '{}');
      } catch {
        throw new Error(`Model returned invalid JSON arguments for ${name ?? 'unknown tool'}.`);
      }
      onStep({ type: 'tool', agent: agent.id, step, name });
      let content;
      try {
        content = await tools.execute(name, args);
      } catch (error) {
        content = JSON.stringify({ error: error.message });
      }
      if (content?.type === 'mcp-rich-content') {
        const text = content.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
        const images = content.parts.filter((part) => part.type === 'image');
        messages.push({ role: 'tool', tool_call_id: call.id, content: text || `${images.length} image(s) returned by ${name}.` });
        if (images.length) {
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: `Visual evidence returned by tool ${name}; inspect these images as evidence for the current task.` },
              ...images.map((image) => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } })),
            ],
          });
        }
      } else {
        messages.push({ role: 'tool', tool_call_id: call.id, content });
      }
    }
  }
  throw new Error(`Agent ${agent.id} exceeded its ${maxSteps}-step tool limit without finishing.`);
}
