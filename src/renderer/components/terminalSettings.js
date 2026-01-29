/**
 * Donna Desktop - Terminal Settings
 * Settings panel for configurable terminal features
 */

class TerminalSettings {
  constructor() {
    this.isOpen = false;
    this.config = null;
    this.element = null;

    this.init();
  }

  init() {
    // Create settings panel
    this.element = document.createElement('div');
    this.element.className = 'terminal-settings';
    this.element.innerHTML = `
      <div class="settings-backdrop"></div>
      <div class="settings-panel">
        <div class="settings-header">
          <h2>Terminal Settings</h2>
          <button class="settings-close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="settings-content">
          <!-- Appearance Section -->
          <div class="settings-section">
            <h3 class="section-title">Appearance</h3>
            <p class="section-desc">Customize how Donna looks</p>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Theme</label>
                <p class="setting-desc">Choose your preferred color scheme</p>
              </div>
              <select id="appearance-theme" class="setting-select">
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <!-- Features Section -->
          <div class="settings-section">
            <h3 class="section-title">Features</h3>
            <p class="section-desc">Toggle terminal power features on or off</p>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Command Blocks</label>
                <p class="setting-desc">Group commands with their output in visual blocks. Shows timestamps and duration.</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="feature-commandBlocks">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">AI Suggestions</label>
                <p class="setting-desc">Get intelligent command suggestions as you type, powered by AI.</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="feature-aiSuggestions">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Command Palette</label>
                <p class="setting-desc">Quick launcher for commands and workflows. Press ⌘⇧P to open.</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="feature-commandPalette">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- Command Blocks Settings -->
          <div class="settings-section" id="section-commandBlocks">
            <h3 class="section-title">Command Blocks</h3>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Show Timestamps</label>
                <p class="setting-desc">Display when each command was run</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="blocks-showTimestamps">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Show Duration</label>
                <p class="setting-desc">Display how long each command took</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="blocks-showDuration">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Auto-collapse Long Output</label>
                <p class="setting-desc">Collapse output that exceeds the threshold</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="blocks-collapseLongOutput">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Collapse Threshold</label>
                <p class="setting-desc">Number of lines before auto-collapsing</p>
              </div>
              <input type="number" id="blocks-collapseThreshold" class="setting-input" min="10" max="500" step="10">
            </div>
          </div>

          <!-- AI Suggestions Settings -->
          <div class="settings-section" id="section-aiSuggestions">
            <h3 class="section-title">AI Suggestions</h3>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">AI Provider</label>
                <p class="setting-desc">Which AI model to use for suggestions</p>
              </div>
              <select id="ai-provider" class="setting-select">
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Trigger Delay</label>
                <p class="setting-desc">Milliseconds to wait before showing suggestions</p>
              </div>
              <input type="number" id="ai-triggerDelay" class="setting-input" min="100" max="2000" step="100">
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Show Inline</label>
                <p class="setting-desc">Display suggestions inline with your typing</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="ai-showInline">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <label class="setting-label">Max Suggestions</label>
                <p class="setting-desc">Maximum number of suggestions to show</p>
              </div>
              <input type="number" id="ai-maxSuggestions" class="setting-input" min="1" max="10" step="1">
            </div>
          </div>

          <!-- Workflows Section -->
          <div class="settings-section">
            <h3 class="section-title">Workflows</h3>
            <p class="section-desc">Saved command sequences (always enabled)</p>

            <div class="workflows-list" id="workflows-list">
              <!-- Workflows will be populated here -->
            </div>

            <button class="btn-add-workflow" id="btn-add-workflow">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Add Workflow
            </button>
          </div>
        </div>
      </div>
    `;

    this.element.style.display = 'none';
    document.body.appendChild(this.element);

    // Event listeners
    this.element.querySelector('.settings-backdrop').addEventListener('click', () => this.close());
    this.element.querySelector('.settings-close').addEventListener('click', () => this.close());

    // Feature toggles
    this.element.querySelectorAll('[id^="feature-"]').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const feature = e.target.id.replace('feature-', '');
        this.updateFeature(feature, e.target.checked);
      });
    });

    // Block settings
    this.element.querySelectorAll('[id^="blocks-"]').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateBlockSettings();
      });
    });

    // AI settings
    this.element.querySelectorAll('[id^="ai-"]').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateAISettings();
      });
    });

    // Appearance settings
    this.element.querySelectorAll('[id^="appearance-"]').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateAppearanceSettings();
      });
    });

    // Add workflow button
    this.element.querySelector('#btn-add-workflow').addEventListener('click', () => {
      window.workflowManager?.showEditor();
    });

    // Global keyboard shortcut to open settings
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for settings button click
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.toggle();
    });
  }

  /**
   * Toggle settings panel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open settings panel
   */
  async open() {
    // Load current config
    await this.loadConfig();

    this.isOpen = true;
    this.element.style.display = 'flex';

    requestAnimationFrame(() => {
      this.element.classList.add('open');
    });
  }

  /**
   * Close settings panel
   */
  close() {
    this.isOpen = false;
    this.element.classList.remove('open');

    setTimeout(() => {
      this.element.style.display = 'none';
    }, 200);
  }

  /**
   * Load configuration
   */
  async loadConfig() {
    try {
      this.config = await window.donnaTerminal?.getTerminalConfig?.() || this.getDefaultConfig();
    } catch {
      this.config = this.getDefaultConfig();
    }

    this.populateSettings();
  }

  /**
   * Get default config
   */
  getDefaultConfig() {
    return {
      features: {
        commandBlocks: true,
        aiSuggestions: true,
        commandPalette: true
      },
      appearance: {
        theme: 'system'
      },
      commandBlocks: {
        showTimestamps: true,
        showDuration: true,
        collapseLongOutput: true,
        collapseThreshold: 50
      },
      aiSuggestions: {
        provider: 'claude',
        triggerDelay: 500,
        showInline: true,
        maxSuggestions: 3
      },
      workflows: {
        builtIn: [],
        custom: []
      }
    };
  }

  /**
   * Populate settings form with current values
   */
  populateSettings() {
    // Appearance
    document.getElementById('appearance-theme').value = this.config.appearance?.theme || 'system';

    // Features
    document.getElementById('feature-commandBlocks').checked = this.config.features.commandBlocks;
    document.getElementById('feature-aiSuggestions').checked = this.config.features.aiSuggestions;
    document.getElementById('feature-commandPalette').checked = this.config.features.commandPalette;

    // Command blocks
    document.getElementById('blocks-showTimestamps').checked = this.config.commandBlocks.showTimestamps;
    document.getElementById('blocks-showDuration').checked = this.config.commandBlocks.showDuration;
    document.getElementById('blocks-collapseLongOutput').checked = this.config.commandBlocks.collapseLongOutput;
    document.getElementById('blocks-collapseThreshold').value = this.config.commandBlocks.collapseThreshold;

    // AI suggestions
    document.getElementById('ai-provider').value = this.config.aiSuggestions.provider;
    document.getElementById('ai-triggerDelay').value = this.config.aiSuggestions.triggerDelay;
    document.getElementById('ai-showInline').checked = this.config.aiSuggestions.showInline;
    document.getElementById('ai-maxSuggestions').value = this.config.aiSuggestions.maxSuggestions;

    // Show/hide feature-specific sections
    this.updateSectionVisibility();

    // Populate workflows
    this.populateWorkflows();
  }

  /**
   * Update section visibility based on feature toggles
   */
  updateSectionVisibility() {
    document.getElementById('section-commandBlocks').style.display =
      this.config.features.commandBlocks ? 'block' : 'none';
    document.getElementById('section-aiSuggestions').style.display =
      this.config.features.aiSuggestions ? 'block' : 'none';
  }

  /**
   * Populate workflows list
   */
  populateWorkflows() {
    const list = document.getElementById('workflows-list');
    const workflows = [
      ...(this.config.workflows?.builtIn || []),
      ...(this.config.workflows?.custom || [])
    ];

    if (workflows.length === 0) {
      list.innerHTML = '<p class="no-workflows">No workflows yet. Add one to get started!</p>';
      return;
    }

    list.innerHTML = workflows.map(w => `
      <div class="workflow-item" data-id="${w.id}">
        <div class="workflow-icon">${this.getWorkflowIcon(w.icon)}</div>
        <div class="workflow-info">
          <div class="workflow-name">${this.escapeHtml(w.name)}</div>
          <div class="workflow-desc">${this.escapeHtml(w.description || '')}</div>
        </div>
        ${w.isCustom ? `
          <button class="workflow-edit" title="Edit">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="workflow-delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 4h8M5 4V3h4v1M4 4v8h6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        ` : ''}
      </div>
    `).join('');

    // Add event listeners - use btn instead of e.target to handle clicks on child SVG elements
    list.querySelectorAll('.workflow-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.workflow-item').dataset.id;
        const workflow = workflows.find(w => w.id === id);
        if (workflow) {
          window.workflowManager?.showEditor(workflow);
        }
      });
    });

    list.querySelectorAll('.workflow-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.workflow-item').dataset.id;
        this.confirmDeleteWorkflow(id);
      });
    });
  }

  /**
   * Update a feature toggle
   */
  async updateFeature(feature, enabled) {
    const previousValue = this.config.features[feature];
    this.config.features[feature] = enabled;

    try {
      const result = await window.donnaTerminal?.setFeatureEnabled?.(feature, enabled);
      if (!result?.success) {
        // Revert on failure
        this.config.features[feature] = previousValue;
        const toggle = document.getElementById(`feature-${feature}`);
        if (toggle) toggle.checked = previousValue;
        console.error(`Failed to update feature: ${feature}`, result?.error);
        return;
      }
    } catch (error) {
      // Revert on error
      this.config.features[feature] = previousValue;
      const toggle = document.getElementById(`feature-${feature}`);
      if (toggle) toggle.checked = previousValue;
      console.error(`Error updating feature ${feature}:`, error);
      return;
    }

    this.updateSectionVisibility();

    // Emit event for components to react
    window.dispatchEvent(new CustomEvent('featureToggled', {
      detail: { feature, enabled }
    }));
  }

  /**
   * Update command block settings
   */
  async updateBlockSettings() {
    const previousSettings = { ...this.config.commandBlocks };
    const settings = {
      showTimestamps: document.getElementById('blocks-showTimestamps').checked,
      showDuration: document.getElementById('blocks-showDuration').checked,
      collapseLongOutput: document.getElementById('blocks-collapseLongOutput').checked,
      collapseThreshold: parseInt(document.getElementById('blocks-collapseThreshold').value) || 50
    };

    this.config.commandBlocks = settings;

    try {
      const result = await window.donnaTerminal?.updateFeatureSettings?.('commandBlocks', settings);
      if (!result?.success) {
        // Revert on failure
        this.config.commandBlocks = previousSettings;
        this.populateBlockSettingsUI(previousSettings);
        console.error('Failed to update command block settings:', result?.error);
        return;
      }
    } catch (error) {
      // Revert on error
      this.config.commandBlocks = previousSettings;
      this.populateBlockSettingsUI(previousSettings);
      console.error('Error updating command block settings:', error);
      return;
    }

    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { feature: 'commandBlocks', settings }
    }));
  }

  /**
   * Helper to populate block settings UI
   */
  populateBlockSettingsUI(settings) {
    document.getElementById('blocks-showTimestamps').checked = settings.showTimestamps;
    document.getElementById('blocks-showDuration').checked = settings.showDuration;
    document.getElementById('blocks-collapseLongOutput').checked = settings.collapseLongOutput;
    document.getElementById('blocks-collapseThreshold').value = settings.collapseThreshold;
  }

  /**
   * Update AI suggestion settings
   */
  async updateAISettings() {
    const previousSettings = { ...this.config.aiSuggestions };
    const settings = {
      provider: document.getElementById('ai-provider').value,
      triggerDelay: parseInt(document.getElementById('ai-triggerDelay').value) || 500,
      showInline: document.getElementById('ai-showInline').checked,
      maxSuggestions: parseInt(document.getElementById('ai-maxSuggestions').value) || 3
    };

    this.config.aiSuggestions = settings;

    try {
      const result = await window.donnaTerminal?.updateFeatureSettings?.('aiSuggestions', settings);
      if (!result?.success) {
        // Revert on failure
        this.config.aiSuggestions = previousSettings;
        this.populateAISettingsUI(previousSettings);
        console.error('Failed to update AI settings:', result?.error);
        return;
      }
    } catch (error) {
      // Revert on error
      this.config.aiSuggestions = previousSettings;
      this.populateAISettingsUI(previousSettings);
      console.error('Error updating AI settings:', error);
      return;
    }

    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { feature: 'aiSuggestions', settings }
    }));
  }

  /**
   * Helper to populate AI settings UI
   */
  populateAISettingsUI(settings) {
    document.getElementById('ai-provider').value = settings.provider;
    document.getElementById('ai-triggerDelay').value = settings.triggerDelay;
    document.getElementById('ai-showInline').checked = settings.showInline;
    document.getElementById('ai-maxSuggestions').value = settings.maxSuggestions;
  }

  /**
   * Update appearance settings (theme)
   */
  async updateAppearanceSettings() {
    const theme = document.getElementById('appearance-theme').value;
    const previousTheme = this.config.appearance?.theme || 'system';

    // Update local config
    if (!this.config.appearance) {
      this.config.appearance = {};
    }
    this.config.appearance.theme = theme;

    // Apply theme immediately via ThemeManager
    if (window.themeManager) {
      await window.themeManager.setTheme(theme);
    }

    // Persist to config
    try {
      const result = await window.donnaTerminal?.updateFeatureSettings?.('appearance', { theme });
      if (!result?.success) {
        // Revert on failure
        this.config.appearance.theme = previousTheme;
        document.getElementById('appearance-theme').value = previousTheme;
        if (window.themeManager) {
          await window.themeManager.setTheme(previousTheme);
        }
        console.error('Failed to save appearance settings:', result?.error);
        return;
      }
    } catch (error) {
      // Revert on error
      this.config.appearance.theme = previousTheme;
      document.getElementById('appearance-theme').value = previousTheme;
      if (window.themeManager) {
        await window.themeManager.setTheme(previousTheme);
      }
      console.error('Error saving appearance settings:', error);
      return;
    }

    window.dispatchEvent(new CustomEvent('settingsUpdated', {
      detail: { feature: 'appearance', settings: { theme } }
    }));
  }

  /**
   * Confirm and delete a workflow with custom dialog
   */
  confirmDeleteWorkflow(id) {
    // Create confirmation dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog-backdrop';
    dialog.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-content">
          <p>Delete this workflow?</p>
          <p class="confirm-dialog-subtitle">This action cannot be undone.</p>
        </div>
        <div class="confirm-dialog-actions">
          <button class="confirm-dialog-cancel">Cancel</button>
          <button class="confirm-dialog-confirm">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Handle cancel
    dialog.querySelector('.confirm-dialog-cancel').addEventListener('click', () => {
      dialog.remove();
    });

    // Handle backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });

    // Handle confirm
    dialog.querySelector('.confirm-dialog-confirm').addEventListener('click', () => {
      dialog.remove();
      this.deleteWorkflow(id);
    });

    // Focus cancel button for accessibility
    dialog.querySelector('.confirm-dialog-cancel').focus();
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id) {
    try {
      const result = await window.donnaTerminal?.deleteWorkflow?.(id);
      if (!result?.success) {
        console.error('Failed to delete workflow:', result?.error);
        return;
      }
    } catch (error) {
      console.error('Error deleting workflow:', error);
      return;
    }

    // Reload config
    await this.loadConfig();
  }

  /**
   * Get workflow icon SVG
   */
  getWorkflowIcon(type) {
    const icons = {
      git: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/></svg>',
      package: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v8l6 3 6-3V4L8 1z" stroke="currentColor" stroke-width="1.5"/></svg>',
      docker: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>',
      workflow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 7l4-2M6 9l4 2" stroke="currentColor" stroke-width="1.5"/></svg>'
    };
    return icons[type] || icons.workflow;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export
window.TerminalSettings = TerminalSettings;
