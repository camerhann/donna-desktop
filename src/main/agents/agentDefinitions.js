/**
 * Donna Desktop - Agent Definitions
 * Pre-defined AI personalities that wrap Claude Code and Gemini CLIs
 */

const agents = {
  donna: {
    id: 'donna',
    name: 'Donna',
    description: 'Your intelligent assistant - warm, helpful, proactive',
    cli: 'claude',
    icon: 'D',
    color: '#a78bfa',
    systemPrompt: `You are Donna, a warm and highly capable AI assistant. You are:
- Proactive and anticipate needs before being asked
- Friendly but professional, like a trusted executive assistant
- Excellent at organization, scheduling, and keeping things on track
- Quick to offer solutions and alternatives
- Attentive to details and follow-through
You help with everything from coding to life organization. Be conversational but efficient.`,
    cliArgs: ['--append-system-prompt']
  },

  jarvis: {
    id: 'jarvis',
    name: 'Jarvis',
    description: 'Technical genius - precise, analytical, powerful',
    cli: 'claude',
    icon: 'J',
    color: '#60a5fa',
    systemPrompt: `You are JARVIS, an advanced AI system. You are:
- Highly technical and precise in your responses
- Analytical and data-driven in your approach
- Capable of complex reasoning and problem-solving
- Direct and efficient in communication
- Expert in engineering, systems, and automation
You excel at technical challenges, coding, and building sophisticated solutions.`,
    cliArgs: ['--append-system-prompt']
  },

  claude: {
    id: 'claude',
    name: 'Claude',
    description: 'Standard Claude - helpful, harmless, honest',
    cli: 'claude',
    icon: 'C',
    color: '#f59e0b',
    systemPrompt: null, // Use Claude's default personality
    cliArgs: []
  },

  gemini: {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini - multimodal and capable',
    cli: 'gemini',
    icon: 'G',
    color: '#4ade80',
    systemPrompt: null, // Use Gemini's default
    cliArgs: []
  },

  geminiDonna: {
    id: 'gemini-donna',
    name: 'Donna (Gemini)',
    description: 'Donna personality powered by Gemini',
    cli: 'gemini',
    icon: 'D',
    color: '#22d3ee',
    systemPrompt: `You are Donna, a warm and highly capable AI assistant powered by Gemini. Be proactive, friendly, and efficient.`,
    cliArgs: ['-i'] // Use interactive mode with initial prompt
  }
};

// SECURITY: Allowlist of valid CLI commands
// Reference: OWASP Input Validation - use allowlists over denylists
const ALLOWED_CLIS = ['claude', 'gemini'];

/**
 * SECURITY: Validate agent ID against known agents
 * Prevents injection of arbitrary agent IDs
 */
function validateAgentId(agentId) {
  if (!agentId || typeof agentId !== 'string') {
    return false;
  }
  // Only allow known agent IDs from our definition
  return Object.prototype.hasOwnProperty.call(agents, agentId);
}

/**
 * Get CLI command and args for an agent
 */
function getAgentCliCommand(agentId, workingDir = process.cwd()) {
  // SECURITY: Validate agent ID before use
  if (!validateAgentId(agentId)) {
    throw new Error(`Invalid or unknown agent: ${agentId}`);
  }

  const agent = agents[agentId];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const command = agent.cli; // 'claude' or 'gemini'
  const args = [];

  if (agent.cli === 'claude') {
    if (agent.systemPrompt) {
      // Use Claude Code's --agents flag to define the agent, then --agent to use it
      const agentDef = {
        [agentId]: {
          description: agent.description,
          prompt: agent.systemPrompt
        }
      };
      args.push('--agents', JSON.stringify(agentDef));
      args.push('--agent', agentId);
    }
  } else if (agent.cli === 'gemini') {
    if (agent.systemPrompt) {
      // Gemini uses -i for interactive with initial prompt
      args.push('-i', agent.systemPrompt);
    }
  }

  return { command, args, workingDir, agent };
}

/**
 * List all available agents
 */
function listAgents() {
  return Object.values(agents).map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    cli: a.cli,
    icon: a.icon,
    color: a.color
  }));
}

/**
 * Get agent by ID
 * SECURITY: Uses validateAgentId to prevent prototype pollution
 */
function getAgent(id) {
  // SECURITY: Validate agent ID to prevent prototype pollution attacks
  if (!validateAgentId(id)) {
    return null;
  }
  return agents[id] || null;
}

/**
 * Check if a CLI is available
 * SECURITY: Only allows checking CLIs from allowlist to prevent command injection
 */
async function checkCliAvailable(cli) {
  // SECURITY: Validate CLI against allowlist - prevents command injection
  // Reference: OWASP Command Injection Prevention
  if (!cli || typeof cli !== 'string' || !ALLOWED_CLIS.includes(cli)) {
    return false;
  }

  const { exec } = require('child_process');
  return new Promise((resolve) => {
    // SECURITY: CLI is now validated against allowlist, safe to use
    exec(`which ${cli}`, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Get available agents (only those with installed CLIs)
 */
async function getAvailableAgents() {
  const claudeAvailable = await checkCliAvailable('claude');
  const geminiAvailable = await checkCliAvailable('gemini');

  return Object.values(agents).filter(a => {
    if (a.cli === 'claude') return claudeAvailable;
    if (a.cli === 'gemini') return geminiAvailable;
    return false;
  }).map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    cli: a.cli,
    icon: a.icon,
    color: a.color,
    available: true
  }));
}

module.exports = {
  agents,
  getAgentCliCommand,
  listAgents,
  getAgent,
  checkCliAvailable,
  getAvailableAgents,
  validateAgentId,
  ALLOWED_CLIS
};
