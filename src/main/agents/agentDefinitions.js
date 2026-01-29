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

/**
 * Get CLI command and args for an agent
 */
function getAgentCliCommand(agentId, workingDir = process.cwd()) {
  const agent = agents[agentId];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const command = agent.cli; // 'claude' or 'gemini'
  const args = [];

  if (agent.cli === 'claude') {
    if (agent.systemPrompt) {
      args.push('--append-system-prompt', agent.systemPrompt);
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
 */
function getAgent(id) {
  return agents[id] || null;
}

/**
 * Check if a CLI is available
 */
async function checkCliAvailable(cli) {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
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
  getAvailableAgents
};
