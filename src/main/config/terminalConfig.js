/**
 * Donna Desktop - Terminal Configuration
 * Manages configurable terminal power features
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class TerminalConfig {
  constructor() {
    this.configDir = path.join(os.homedir(), '.donna-desktop');
    this.configPath = path.join(this.configDir, 'terminal-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Default configuration values
   */
  getDefaults() {
    return {
      // Configurable features (can be toggled)
      features: {
        commandBlocks: true,        // Group commands with their output
        aiSuggestions: true,        // AI command suggestions as you type
        commandPalette: true,       // Cmd+Shift+P command palette
      },

      // Always-on features (not configurable)
      // - workflows (saved command sequences)

      // Command blocks settings
      commandBlocks: {
        showTimestamps: true,
        showDuration: true,
        collapseLongOutput: true,
        collapseThreshold: 50,      // lines before collapsing
      },

      // AI suggestions settings
      aiSuggestions: {
        provider: 'claude',         // Which AI to use
        triggerDelay: 500,          // ms before suggesting
        showInline: true,           // Show suggestions inline
        maxSuggestions: 3,
        contextLines: 10,           // Terminal history lines for context
      },

      // Command palette settings
      commandPalette: {
        maxRecentCommands: 50,
        showWorkflows: true,
        showGitCommands: true,
        showAliases: true,
      },

      // Workflows (always enabled)
      workflows: {
        builtIn: [
          {
            id: 'git-commit-push',
            name: 'Git: Commit & Push',
            description: 'Stage all, commit with message, and push',
            commands: [
              'git add -A',
              'git commit -m "${message:Commit message}"',
              'git push'
            ],
            icon: 'git'
          },
          {
            id: 'npm-fresh-install',
            name: 'NPM: Fresh Install',
            description: 'Remove node_modules and reinstall',
            commands: [
              'rm -rf node_modules',
              'rm -f package-lock.json',
              'npm install'
            ],
            icon: 'package'
          },
          {
            id: 'docker-rebuild',
            name: 'Docker: Rebuild & Run',
            description: 'Stop, rebuild, and start containers',
            commands: [
              'docker-compose down',
              'docker-compose build --no-cache',
              'docker-compose up -d'
            ],
            icon: 'docker'
          }
        ],
        custom: []  // User-defined workflows
      }
    };
  }

  /**
   * Load configuration from disk
   */
  loadConfig() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const loaded = JSON.parse(data);
        // Merge with defaults to ensure all keys exist
        return this.deepMerge(this.getDefaults(), loaded);
      }
    } catch (error) {
      console.error('Failed to load terminal config:', error);
    }

    return this.getDefaults();
  }

  /**
   * Save configuration to disk
   */
  saveConfig() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save terminal config:', error);
    }
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * Get the full configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.config.features[feature] === true;
  }

  /**
   * Toggle a feature on/off
   */
  setFeatureEnabled(feature, enabled) {
    if (feature in this.config.features) {
      this.config.features[feature] = enabled;
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Update feature-specific settings
   */
  updateFeatureSettings(feature, settings) {
    if (feature in this.config) {
      this.config[feature] = { ...this.config[feature], ...settings };
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Get all workflows (built-in + custom)
   */
  getWorkflows() {
    return [
      ...this.config.workflows.builtIn,
      ...this.config.workflows.custom
    ];
  }

  /**
   * Add a custom workflow
   */
  addWorkflow(workflow) {
    const id = `custom-${Date.now()}`;
    const newWorkflow = {
      id,
      ...workflow,
      isCustom: true
    };
    this.config.workflows.custom.push(newWorkflow);
    this.saveConfig();
    return newWorkflow;
  }

  /**
   * Update a custom workflow
   */
  updateWorkflow(id, updates) {
    const index = this.config.workflows.custom.findIndex(w => w.id === id);
    if (index !== -1) {
      this.config.workflows.custom[index] = {
        ...this.config.workflows.custom[index],
        ...updates
      };
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Delete a custom workflow
   */
  deleteWorkflow(id) {
    const index = this.config.workflows.custom.findIndex(w => w.id === id);
    if (index !== -1) {
      this.config.workflows.custom.splice(index, 1);
      this.saveConfig();
      return true;
    }
    return false;
  }
}

module.exports = { TerminalConfig };
