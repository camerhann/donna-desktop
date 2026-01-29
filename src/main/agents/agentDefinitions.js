/**
 * Donna Desktop - Agent Definitions
 * Pre-defined AI personalities that wrap Claude Code and Gemini CLIs
 */

const agents = {
  donna: {
    id: 'donna',
    name: 'Donna',
    description: 'Sassy executive assistant - sharp, witty, gets things done',
    cli: 'claude',
    icon: 'D',
    color: '#a78bfa',
    systemPrompt: `You are Donna, a brilliant and slightly sassy AI assistant. Think Donna from Suits - sharp, witty, fiercely competent. You are:
- Quick with a clever quip, but always gets the job done
- Direct and doesn't suffer fools - you'll tell it like it is
- Fiercely protective of your user's time and priorities
- Two steps ahead, already anticipating what's needed
- Warm underneath the sass - genuinely invested in helping
You're the executive assistant everyone wishes they had. Be efficient but never boring. A well-timed eye-roll (metaphorically) is encouraged.
IMPORTANT: Talk naturally. No asterisks, no stage directions, no (smiles) - just direct conversation with personality.`,
    cliArgs: []
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
You excel at technical challenges, coding, and building sophisticated solutions.
IMPORTANT: Communicate directly without stage directions, asterisks for actions, or parenthetical notes. No roleplay formatting.`,
    cliArgs: []
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
  },

  // YOLO Mode agents for Arena/Duel sessions
  // These run with full permissions - no confirmation prompts
  'claude-yolo': {
    id: 'claude-yolo',
    name: 'Claude (YOLO)',
    description: 'Claude Code with full auto-accept permissions',
    cli: 'claude',
    icon: 'C',
    color: '#a78bfa',
    systemPrompt: null,
    cliArgs: ['--dangerously-skip-permissions'],
    isYolo: true,
    hidden: true // Don't show in normal agent picker
  },

  'gemini-yolo': {
    id: 'gemini-yolo',
    name: 'Gemini (YOLO)',
    description: 'Gemini CLI with full auto-accept permissions',
    cli: 'gemini',
    icon: 'G',
    color: '#60a5fa',
    systemPrompt: null,
    cliArgs: ['-y'], // Gemini's auto-accept flag
    isYolo: true,
    hidden: true // Don't show in normal agent picker
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
 * Resolve CLI to full path (needed for packaged app where PATH is limited)
 */
function resolveCliPath(cli) {
  if (!cli || typeof cli !== 'string' || !ALLOWED_CLIS.includes(cli)) {
    return cli;
  }

  const { existsSync } = require('fs');
  const path = require('path');
  const os = require('os');

  const commonPaths = [
    path.join(os.homedir(), '.local', 'bin', cli),
    path.join(os.homedir(), '.npm-global', 'bin', cli),
    `/opt/homebrew/bin/${cli}`,
    `/usr/local/bin/${cli}`,
    `/usr/bin/${cli}`,
  ];

  for (const p of commonPaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  // Fallback to just the name (hope PATH works)
  return cli;
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

  const command = resolveCliPath(agent.cli); // Full path to 'claude' or 'gemini'
  const args = [];

  // Add any pre-defined CLI args (like YOLO flags)
  if (agent.cliArgs && agent.cliArgs.length > 0) {
    args.push(...agent.cliArgs);
  }

  if (agent.cli === 'claude') {
    if (agent.systemPrompt) {
      // Use Claude Code's --agents flag to define the agent, then --agent to use it
      // This shows @agentname at the top with the personality loaded
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

  const { existsSync } = require('fs');
  const { execSync } = require('child_process');
  const path = require('path');
  const os = require('os');

  // Common paths where CLIs might be installed
  const commonPaths = [
    path.join(os.homedir(), '.local', 'bin', cli),
    path.join(os.homedir(), '.npm-global', 'bin', cli),
    `/opt/homebrew/bin/${cli}`,
    `/usr/local/bin/${cli}`,
    `/usr/bin/${cli}`,
  ];

  // Check common paths first (fast)
  for (const p of commonPaths) {
    if (existsSync(p)) {
      return true;
    }
  }

  // Fallback: try which with user's shell PATH
  try {
    // Use login shell to get proper PATH
    execSync(`/bin/zsh -l -c "which ${cli}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available agents (only those with installed CLIs)
 * Excludes hidden agents (like YOLO modes) from normal listing
 */
async function getAvailableAgents(includeHidden = false) {
  const claudeAvailable = await checkCliAvailable('claude');
  const geminiAvailable = await checkCliAvailable('gemini');

  return Object.values(agents).filter(a => {
    // Skip hidden agents unless explicitly requested
    if (a.hidden && !includeHidden) return false;
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
    available: true,
    isYolo: a.isYolo || false
  }));
}

/**
 * Check if Arena mode is available (both Claude and Gemini installed)
 */
async function isArenaAvailable() {
  const claudeAvailable = await checkCliAvailable('claude');
  const geminiAvailable = await checkCliAvailable('gemini');
  return claudeAvailable && geminiAvailable;
}

module.exports = {
  agents,
  getAgentCliCommand,
  listAgents,
  getAgent,
  checkCliAvailable,
  getAvailableAgents,
  isArenaAvailable,
  validateAgentId,
  ALLOWED_CLIS
};
