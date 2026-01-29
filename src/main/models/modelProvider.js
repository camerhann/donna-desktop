/**
 * Donna Desktop - Model Provider Abstraction Layer
 * Supports Claude, Gemini, Ollama, and local models
 */

class ModelProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  async chat(messages, options = {}) {
    throw new Error('chat() must be implemented by subclass');
  }

  async stream(messages, options = {}) {
    throw new Error('stream() must be implemented by subclass');
  }

  validateConfig() {
    return true;
  }

  getCapabilities() {
    return {
      streaming: false,
      vision: false,
      functionCalling: false,
      maxTokens: 4096
    };
  }
}

/**
 * Anthropic Claude Provider
 */
class ClaudeProvider extends ModelProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'claude';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  validateConfig() {
    return !!this.apiKey;
  }

  getCapabilities() {
    return {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxTokens: 200000
    };
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || this.model,
        max_tokens: options.maxTokens || 4096,
        messages: this.formatMessages(messages),
        system: options.system || undefined
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: data.usage,
      model: data.model,
      stopReason: data.stop_reason
    };
  }

  async *stream(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || this.model,
        max_tokens: options.maxTokens || 4096,
        messages: this.formatMessages(messages),
        system: options.system || undefined,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield { type: 'text', content: parsed.delta.text };
            } else if (parsed.type === 'message_stop') {
              return;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content
    }));
  }
}

/**
 * Google Gemini Provider
 */
class GeminiProvider extends ModelProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'gemini';
    this.apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = config.model || 'gemini-pro';
  }

  validateConfig() {
    return !!this.apiKey;
  }

  getCapabilities() {
    return {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxTokens: 32000
    };
  }

  async chat(messages, options = {}) {
    const model = options.model || this.model;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: this.formatMessages(messages),
        generationConfig: {
          maxOutputTokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.candidates[0].content.parts[0].text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount
      },
      model: model,
      stopReason: data.candidates[0].finishReason
    };
  }

  async *stream(messages, options = {}) {
    const model = options.model || this.model;
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: this.formatMessages(messages),
        generationConfig: {
          maxOutputTokens: options.maxTokens || 4096,
          temperature: options.temperature || 0.7
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Gemini streams JSON array chunks
      try {
        const chunks = buffer.split('\n').filter(line => line.trim());
        for (const chunk of chunks) {
          const parsed = JSON.parse(chunk.replace(/^\[|\]$/g, '').replace(/^,/, ''));
          if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
            yield { type: 'text', content: parsed.candidates[0].content.parts[0].text };
          }
        }
        buffer = '';
      } catch (e) {
        // Buffer incomplete JSON
      }
    }
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }
}

/**
 * Ollama Provider (Local Models)
 */
class OllamaProvider extends ModelProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'ollama';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3.2';
  }

  validateConfig() {
    // Ollama doesn't need API keys, just needs to be running
    return true;
  }

  getCapabilities() {
    return {
      streaming: true,
      vision: false, // Depends on model
      functionCalling: false,
      maxTokens: 8192
    };
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || this.model,
        messages: messages,
        stream: false,
        options: {
          num_predict: options.maxTokens || 4096
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.message.content,
      usage: {
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count
      },
      model: data.model,
      stopReason: 'stop'
    };
  }

  async *stream(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || this.model,
        messages: messages,
        stream: true,
        options: {
          num_predict: options.maxTokens || 4096
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            yield { type: 'text', content: data.message.content };
          }
          if (data.done) {
            return;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * OpenAI-Compatible Provider (supports OpenAI, OpenRouter, etc.)
 */
class OpenAICompatibleProvider extends ModelProvider {
  constructor(config = {}) {
    super(config);
    this.name = config.name || 'openai';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o';
  }

  validateConfig() {
    return !!this.apiKey;
  }

  getCapabilities() {
    return {
      streaming: true,
      vision: true,
      functionCalling: true,
      maxTokens: 128000
    };
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || this.model,
        messages: messages,
        max_tokens: options.maxTokens || 4096
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model,
      stopReason: data.choices[0].finish_reason
    };
  }

  async *stream(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || this.model,
        messages: messages,
        max_tokens: options.maxTokens || 4096,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield { type: 'text', content };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

/**
 * Model Manager - Handles multiple providers and routing
 */
class ModelManager {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
    if (!this.defaultProvider) {
      this.defaultProvider = name;
    }
  }

  setDefaultProvider(name) {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
    }
  }

  getProvider(name) {
    return this.providers.get(name || this.defaultProvider);
  }

  listProviders() {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      type: provider.name,
      configured: provider.validateConfig(),
      capabilities: provider.getCapabilities()
    }));
  }

  async chat(messages, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${options.provider || this.defaultProvider}`);
    }
    return provider.chat(messages, options);
  }

  async *stream(messages, options = {}) {
    const provider = this.getProvider(options.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${options.provider || this.defaultProvider}`);
    }
    yield* provider.stream(messages, options);
  }
}

module.exports = {
  ModelProvider,
  ClaudeProvider,
  GeminiProvider,
  OllamaProvider,
  OpenAICompatibleProvider,
  ModelManager
};
