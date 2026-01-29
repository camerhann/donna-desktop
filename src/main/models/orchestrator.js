/**
 * Donna Desktop - AI Orchestration Layer
 * Allows Donna to spawn and coordinate multiple AI helpers
 */

const { ModelManager, ClaudeProvider, GeminiProvider, OllamaProvider, OpenAICompatibleProvider } = require('./modelProvider');

/**
 * Task represents a unit of work that can be assigned to an AI agent
 */
class Task {
  constructor(id, config = {}) {
    this.id = id;
    this.type = config.type || 'general';
    this.prompt = config.prompt;
    this.context = config.context || [];
    this.priority = config.priority || 'normal';
    this.status = 'pending';
    this.result = null;
    this.error = null;
    this.assignedAgent = null;
    this.createdAt = Date.now();
    this.completedAt = null;
  }

  complete(result) {
    this.status = 'completed';
    this.result = result;
    this.completedAt = Date.now();
  }

  fail(error) {
    this.status = 'failed';
    this.error = error;
    this.completedAt = Date.now();
  }
}

/**
 * Agent represents an AI worker that can be spawned by Donna
 */
class Agent {
  constructor(id, config = {}) {
    this.id = id;
    this.name = config.name || `Agent-${id.slice(0, 6)}`;
    this.role = config.role || 'assistant';
    this.provider = config.provider || 'claude';
    this.model = config.model;
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    this.status = 'idle';
    this.currentTask = null;
    this.completedTasks = [];
    this.createdAt = Date.now();
  }

  getDefaultSystemPrompt() {
    const prompts = {
      researcher: `You are a research agent. Your job is to analyze information, find relevant details, and provide comprehensive summaries. Be thorough and cite sources when possible.`,
      coder: `You are a coding agent. Your job is to write, review, and debug code. Follow best practices, write clean code, and explain your reasoning.`,
      analyst: `You are an analysis agent. Your job is to examine data, identify patterns, and provide insights. Be objective and data-driven.`,
      writer: `You are a writing agent. Your job is to create clear, engaging content. Adapt your tone to the context and audience.`,
      assistant: `You are a helpful assistant agent. Assist with any task you're given efficiently and accurately.`
    };
    return prompts[this.role] || prompts.assistant;
  }
}

/**
 * Orchestrator - Donna's brain for coordinating AI helpers
 */
class Orchestrator {
  constructor(modelManager) {
    this.modelManager = modelManager;
    this.agents = new Map();
    this.tasks = new Map();
    this.taskQueue = [];
    this.eventHandlers = new Map();
    this.isRunning = false;
  }

  /**
   * Spawn a new agent
   */
  spawnAgent(config = {}) {
    const id = this.generateId();
    const agent = new Agent(id, config);
    this.agents.set(id, agent);
    this.emit('agentSpawned', { agent });
    return agent;
  }

  /**
   * Terminate an agent
   */
  terminateAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      if (agent.currentTask) {
        agent.currentTask.fail('Agent terminated');
      }
      this.agents.delete(agentId);
      this.emit('agentTerminated', { agentId });
      return true;
    }
    return false;
  }

  /**
   * Create a new task
   */
  createTask(config = {}) {
    const id = this.generateId();
    const task = new Task(id, config);
    this.tasks.set(id, task);
    this.taskQueue.push(task);
    this.emit('taskCreated', { task });
    this.processQueue();
    return task;
  }

  /**
   * Process the task queue
   */
  async processQueue() {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      const agent = this.findAvailableAgent(task);

      if (agent) {
        await this.executeTask(agent, task);
      } else {
        // No agent available, put task back in queue
        this.taskQueue.unshift(task);
        break;
      }
    }

    this.isRunning = false;
  }

  /**
   * Find an available agent for a task
   */
  findAvailableAgent(task) {
    // First try to find an agent with matching role
    for (const [, agent] of this.agents) {
      if (agent.status === 'idle' && agent.role === task.type) {
        return agent;
      }
    }

    // Fall back to any available agent
    for (const [, agent] of this.agents) {
      if (agent.status === 'idle') {
        return agent;
      }
    }

    return null;
  }

  /**
   * Execute a task with an agent
   */
  async executeTask(agent, task) {
    agent.status = 'working';
    agent.currentTask = task;
    task.status = 'running';
    task.assignedAgent = agent.id;

    this.emit('taskStarted', { task, agent });

    try {
      const messages = [
        { role: 'system', content: agent.systemPrompt },
        ...task.context,
        { role: 'user', content: task.prompt }
      ];

      const response = await this.modelManager.chat(messages, {
        provider: agent.provider,
        model: agent.model
      });

      task.complete(response.content);
      agent.completedTasks.push(task.id);
      this.emit('taskCompleted', { task, agent, result: response.content });
    } catch (error) {
      task.fail(error.message);
      this.emit('taskFailed', { task, agent, error: error.message });
    } finally {
      agent.status = 'idle';
      agent.currentTask = null;
    }
  }

  /**
   * Stream a task result
   */
  async *streamTask(config = {}) {
    const task = this.createTask(config);
    const agent = this.findAvailableAgent(task) || this.spawnAgent({ role: config.type });

    agent.status = 'working';
    agent.currentTask = task;
    task.status = 'running';
    task.assignedAgent = agent.id;

    this.emit('taskStarted', { task, agent });

    try {
      const messages = [
        { role: 'system', content: agent.systemPrompt },
        ...task.context,
        { role: 'user', content: config.prompt }
      ];

      let fullContent = '';
      for await (const chunk of this.modelManager.stream(messages, {
        provider: agent.provider,
        model: agent.model
      })) {
        fullContent += chunk.content;
        yield chunk;
      }

      task.complete(fullContent);
      agent.completedTasks.push(task.id);
      this.emit('taskCompleted', { task, agent, result: fullContent });
    } catch (error) {
      task.fail(error.message);
      this.emit('taskFailed', { task, agent, error: error.message });
      throw error;
    } finally {
      agent.status = 'idle';
      agent.currentTask = null;
    }
  }

  /**
   * Donna's planning mode - break down complex tasks
   */
  async planTask(description, context = []) {
    const planningPrompt = `You are Donna's planning system. Analyze this task and break it down into subtasks.

Task: ${description}

Respond with a JSON array of subtasks, each with:
- type: one of "research", "coder", "analyst", "writer", "assistant"
- prompt: the specific instruction for that subtask
- priority: "high", "normal", or "low"
- dependencies: array of subtask indices this depends on (empty if none)

Only respond with the JSON array, no other text.`;

    const response = await this.modelManager.chat([
      { role: 'system', content: 'You are a task planning assistant. Respond only with valid JSON.' },
      ...context,
      { role: 'user', content: planningPrompt }
    ]);

    try {
      return JSON.parse(response.content);
    } catch (e) {
      // If JSON parsing fails, create a single task
      return [{
        type: 'assistant',
        prompt: description,
        priority: 'normal',
        dependencies: []
      }];
    }
  }

  /**
   * Execute a complex task with automatic planning and coordination
   */
  async executeComplexTask(description, context = []) {
    const subtasks = await this.planTask(description, context);
    const results = [];
    const taskMap = new Map();

    // Create all tasks
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      const task = this.createTask({
        type: subtask.type,
        prompt: subtask.prompt,
        priority: subtask.priority,
        context: context
      });
      taskMap.set(i, task);
    }

    // Execute tasks respecting dependencies
    const completed = new Set();
    while (completed.size < subtasks.length) {
      for (let i = 0; i < subtasks.length; i++) {
        if (completed.has(i)) continue;

        const subtask = subtasks[i];
        const deps = subtask.dependencies || [];
        const depsCompleted = deps.every(d => completed.has(d));

        if (depsCompleted) {
          const task = taskMap.get(i);

          // Add results from dependencies to context
          if (deps.length > 0) {
            const depResults = deps.map(d => ({
              role: 'assistant',
              content: `Previous result: ${results[d]}`
            }));
            task.context = [...context, ...depResults];
          }

          // Wait for task completion
          while (task.status === 'pending' || task.status === 'running') {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          results[i] = task.result;
          completed.add(i);
        }
      }
    }

    return results;
  }

  /**
   * Get status of all agents and tasks
   */
  getStatus() {
    return {
      agents: Array.from(this.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
        provider: a.provider,
        completedTasks: a.completedTasks.length
      })),
      tasks: {
        pending: this.taskQueue.length,
        running: Array.from(this.tasks.values()).filter(t => t.status === 'running').length,
        completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
        failed: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length
      }
    };
  }

  /**
   * Event handling
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Cleanup all agents and tasks
   */
  cleanup() {
    for (const [id] of this.agents) {
      this.terminateAgent(id);
    }
    this.tasks.clear();
    this.taskQueue = [];
  }
}

/**
 * Create a fully configured orchestrator with all providers
 */
function createOrchestrator(config = {}) {
  const modelManager = new ModelManager();

  // Register Claude provider
  if (config.claude?.apiKey || process.env.ANTHROPIC_API_KEY) {
    modelManager.registerProvider('claude', new ClaudeProvider({
      apiKey: config.claude?.apiKey,
      model: config.claude?.model
    }));
  }

  // Register Gemini provider
  if (config.gemini?.apiKey || process.env.GOOGLE_AI_API_KEY) {
    modelManager.registerProvider('gemini', new GeminiProvider({
      apiKey: config.gemini?.apiKey,
      model: config.gemini?.model
    }));
  }

  // Register Ollama provider (local, no API key needed)
  modelManager.registerProvider('ollama', new OllamaProvider({
    baseUrl: config.ollama?.baseUrl,
    model: config.ollama?.model
  }));

  // Register OpenAI-compatible providers
  if (config.openai?.apiKey || process.env.OPENAI_API_KEY) {
    modelManager.registerProvider('openai', new OpenAICompatibleProvider({
      apiKey: config.openai?.apiKey,
      model: config.openai?.model
    }));
  }

  // Register OpenRouter if configured
  if (config.openrouter?.apiKey || process.env.OPENROUTER_API_KEY) {
    modelManager.registerProvider('openrouter', new OpenAICompatibleProvider({
      name: 'openrouter',
      apiKey: config.openrouter?.apiKey || process.env.OPENROUTER_API_KEY,
      baseUrl: 'https://openrouter.ai/api/v1',
      model: config.openrouter?.model || 'anthropic/claude-3.5-sonnet'
    }));
  }

  // Set default provider
  if (config.defaultProvider && modelManager.getProvider(config.defaultProvider)) {
    modelManager.setDefaultProvider(config.defaultProvider);
  }

  return new Orchestrator(modelManager);
}

module.exports = {
  Task,
  Agent,
  Orchestrator,
  createOrchestrator
};
