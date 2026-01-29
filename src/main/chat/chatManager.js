/**
 * Donna Desktop - Chat Session Manager
 * Manages AI chat conversations with multiple providers
 */

const { ModelManager, ClaudeProvider, GeminiProvider, OllamaProvider, OpenAICompatibleProvider } = require('../models/modelProvider');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Chat Message
 */
class ChatMessage {
  constructor(role, content, metadata = {}) {
    this.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    this.role = role; // 'user', 'assistant', 'system'
    this.content = content;
    this.timestamp = Date.now();
    this.metadata = metadata; // provider, model, tokens, etc.
  }
}

/**
 * Chat Session
 */
class ChatSession {
  constructor(id, config = {}) {
    this.id = id;
    this.name = config.name || 'New Chat';
    this.provider = config.provider || 'claude';
    this.model = config.model || null;
    this.systemPrompt = config.systemPrompt || '';
    this.messages = [];
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.metadata = config.metadata || {};
  }

  addMessage(role, content, metadata = {}) {
    const message = new ChatMessage(role, content, metadata);
    this.messages.push(message);
    this.updatedAt = Date.now();
    return message;
  }

  getMessagesForAPI() {
    // Format messages for API call
    const apiMessages = [];

    for (const msg of this.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        apiMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    return apiMessages;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      model: this.model,
      systemPrompt: this.systemPrompt,
      messages: this.messages,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    const session = new ChatSession(data.id, {
      name: data.name,
      provider: data.provider,
      model: data.model,
      systemPrompt: data.systemPrompt,
      metadata: data.metadata
    });
    session.messages = data.messages || [];
    session.createdAt = data.createdAt;
    session.updatedAt = data.updatedAt;
    return session;
  }
}

/**
 * Chat Manager - Handles all chat operations
 */
class ChatManager {
  constructor() {
    this.sessions = new Map();
    this.modelManager = new ModelManager();
    this.configPath = path.join(os.homedir(), '.donna-desktop', 'config.json');
    this.chatsPath = path.join(os.homedir(), '.donna-desktop', 'chats');
    this.config = {};

    this.ensureDirectories();
    this.loadConfig();
    this.initializeProviders();
  }

  ensureDirectories() {
    const dirs = [
      path.join(os.homedir(), '.donna-desktop'),
      this.chatsPath
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load config:', e);
      this.config = {};
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  initializeProviders() {
    const models = this.config.models || {};

    // Claude
    if (models.claude?.apiKey || process.env.ANTHROPIC_API_KEY) {
      this.modelManager.registerProvider('claude', new ClaudeProvider({
        apiKey: models.claude?.apiKey,
        model: models.claude?.model
      }));
    }

    // Gemini
    if (models.gemini?.apiKey || process.env.GOOGLE_AI_API_KEY) {
      this.modelManager.registerProvider('gemini', new GeminiProvider({
        apiKey: models.gemini?.apiKey,
        model: models.gemini?.model
      }));
    }

    // Ollama (local, always available)
    this.modelManager.registerProvider('ollama', new OllamaProvider({
      baseUrl: models.ollama?.baseUrl,
      model: models.ollama?.model
    }));

    // OpenAI
    if (models.openai?.apiKey || process.env.OPENAI_API_KEY) {
      this.modelManager.registerProvider('openai', new OpenAICompatibleProvider({
        apiKey: models.openai?.apiKey,
        model: models.openai?.model
      }));
    }

    // OpenRouter
    if (models.openrouter?.apiKey || process.env.OPENROUTER_API_KEY) {
      this.modelManager.registerProvider('openrouter', new OpenAICompatibleProvider({
        name: 'openrouter',
        apiKey: models.openrouter?.apiKey || process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        model: models.openrouter?.model || 'anthropic/claude-3.5-sonnet'
      }));
    }
  }

  /**
   * Create a new chat session
   */
  createSession(config = {}) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const session = new ChatSession(id, {
      name: config.name || this.generateSessionName(),
      provider: config.provider || this.config.defaultProvider || 'claude',
      model: config.model,
      systemPrompt: config.systemPrompt || '',
      metadata: config.metadata
    });

    this.sessions.set(id, session);
    this.saveSession(session);

    return session;
  }

  generateSessionName() {
    const now = new Date();
    return `Chat ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  /**
   * Get a session by ID
   */
  getSession(id) {
    if (!this.sessions.has(id)) {
      // Try to load from disk
      const session = this.loadSession(id);
      if (session) {
        this.sessions.set(id, session);
      }
    }
    return this.sessions.get(id);
  }

  /**
   * List all sessions
   */
  listSessions() {
    const sessions = [];

    // Load all sessions from disk
    try {
      const files = fs.readdirSync(this.chatsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = file.replace('.json', '');
          const session = this.getSession(id);
          if (session) {
            sessions.push({
              id: session.id,
              name: session.name,
              provider: session.provider,
              model: session.model,
              messageCount: session.messages.length,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to list sessions:', e);
    }

    // Sort by updated time, newest first
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    return sessions;
  }

  /**
   * Delete a session
   */
  deleteSession(id) {
    this.sessions.delete(id);
    const filePath = path.join(this.chatsPath, `${id}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (e) {
      console.error('Failed to delete session:', e);
      return false;
    }
  }

  /**
   * Rename a session
   */
  renameSession(id, name) {
    const session = this.getSession(id);
    if (session) {
      session.name = name;
      session.updatedAt = Date.now();
      this.saveSession(session);
      return true;
    }
    return false;
  }

  /**
   * Save session to disk
   */
  saveSession(session) {
    try {
      const filePath = path.join(this.chatsPath, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session.toJSON(), null, 2));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  }

  /**
   * Load session from disk
   */
  loadSession(id) {
    try {
      const filePath = path.join(this.chatsPath, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return ChatSession.fromJSON(data);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
    return null;
  }

  /**
   * Send a message and get response
   */
  async sendMessage(sessionId, content) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add user message
    const userMessage = session.addMessage('user', content);

    // Build messages array for API
    const messages = session.getMessagesForAPI();

    try {
      const response = await this.modelManager.chat(messages, {
        provider: session.provider,
        model: session.model,
        system: session.systemPrompt || undefined
      });

      // Add assistant message
      const assistantMessage = session.addMessage('assistant', response.content, {
        provider: session.provider,
        model: response.model,
        usage: response.usage
      });

      // Auto-generate name from first message if it's the default
      if (session.messages.length === 2 && session.name.startsWith('Chat ')) {
        const autoName = await this.generateNameFromContent(content);
        if (autoName) {
          session.name = autoName;
        }
      }

      this.saveSession(session);

      return {
        userMessage,
        assistantMessage,
        usage: response.usage
      };
    } catch (error) {
      // Remove the user message if API call fails
      session.messages.pop();
      throw error;
    }
  }

  /**
   * Stream a message response
   */
  async *streamMessage(sessionId, content) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add user message
    const userMessage = session.addMessage('user', content);
    yield { type: 'user_message', message: userMessage };

    // Build messages array for API
    const messages = session.getMessagesForAPI();

    try {
      let fullContent = '';

      for await (const chunk of this.modelManager.stream(messages, {
        provider: session.provider,
        model: session.model,
        system: session.systemPrompt || undefined
      })) {
        fullContent += chunk.content;
        yield { type: 'chunk', content: chunk.content };
      }

      // Add assistant message with full content
      const assistantMessage = session.addMessage('assistant', fullContent, {
        provider: session.provider,
        model: session.model
      });

      // Auto-generate name from first message if it's the default
      if (session.messages.length === 2 && session.name.startsWith('Chat ')) {
        const autoName = await this.generateNameFromContent(content);
        if (autoName) {
          session.name = autoName;
        }
      }

      this.saveSession(session);

      yield { type: 'complete', message: assistantMessage };
    } catch (error) {
      // Remove the user message if streaming fails
      session.messages.pop();
      yield { type: 'error', error: error.message };
    }
  }

  /**
   * Generate a session name from content
   */
  async generateNameFromContent(content) {
    try {
      // Simple approach: take first 40 chars of the message
      const name = content.slice(0, 40).trim();
      if (name.length < content.length) {
        return name + '...';
      }
      return name;
    } catch {
      return null;
    }
  }

  /**
   * List available providers
   */
  listProviders() {
    return this.modelManager.listProviders();
  }

  /**
   * Update provider config
   */
  updateProviderConfig(provider, config) {
    if (!this.config.models) {
      this.config.models = {};
    }
    this.config.models[provider] = { ...this.config.models[provider], ...config };
    this.saveConfig();

    // Reinitialize providers
    this.modelManager = new ModelManager();
    this.initializeProviders();
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider) {
    this.config.defaultProvider = provider;
    this.saveConfig();
  }

  /**
   * Get config
   */
  getConfig() {
    return this.config;
  }
}

module.exports = {
  ChatMessage,
  ChatSession,
  ChatManager
};
