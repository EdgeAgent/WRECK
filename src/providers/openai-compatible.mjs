export class OpenAICompatibleProvider {
  constructor({ baseUrl = process.env.WRECK_LLM_BASE_URL ?? 'https://api.openai.com/v1', apiKey = process.env.WRECK_LLM_API_KEY, model = process.env.WRECK_LLM_MODEL, fetchImpl = fetch, timeoutMs = 120_000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async complete({ model = this.model, messages, tools }) {
    if (!model) throw new Error('Set WRECK_LLM_MODEL to the model ID supported by your provider.');
    if (!this.apiKey) throw new Error('Set WRECK_LLM_API_KEY in your environment; WRECK never stores API keys in project files.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('LLM request timed out')), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model, messages, ...(tools?.length ? { tools, tool_choice: 'auto' } : {}) }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.error?.message ?? data?.message ?? `HTTP ${response.status}`;
        throw new Error(`LLM provider request failed: ${detail}`);
      }
      if (data?.error) throw new Error(`LLM provider error: ${data.error.message ?? 'unknown error'}`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
}
