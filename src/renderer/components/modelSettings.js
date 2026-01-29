/**
 * Donna Desktop - Model Settings Component
 * UI for configuring AI providers and API keys
 */

class ModelSettings {
  constructor() {
    this.isOpen = false;
    this.config = {};
    this.providers = [];
    this.modal = null;
  }

  async init() {
    this.config = await window.donnaConfig.get() || {};
    this.providers = await window.donnaModels.listProviders();
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'model-settings-modal';
    this.modal.innerHTML = `
      <div class="model-settings-overlay"></div>
      <div class="model-settings-panel">
        <div class="model-settings-header">
          <h2>Model Settings</h2>
          <button class="close-btn" title="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="model-settings-content">
          <div class="settings-section">
            <h3>Default Provider</h3>
            <select id="default-provider" class="settings-select">
              <option value="claude">Claude (Anthropic)</option>
              <option value="gemini">Gemini (Google)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>

          <div class="settings-section">
            <h3>Claude (Anthropic)</h3>
            <div class="api-key-input">
              <label>API Key</label>
              <input type="password" id="claude-api-key" placeholder="sk-ant-..." autocomplete="off">
              <button class="toggle-visibility" data-target="claude-api-key">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3C4.5 3 1.5 5.5 0.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5z" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
            </div>
            <div class="model-select">
              <label>Model</label>
              <select id="claude-model" class="settings-select">
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
              </select>
            </div>
            <div class="provider-status" id="claude-status"></div>
          </div>

          <div class="settings-section">
            <h3>Gemini (Google)</h3>
            <div class="api-key-input">
              <label>API Key</label>
              <input type="password" id="gemini-api-key" placeholder="AIza..." autocomplete="off">
              <button class="toggle-visibility" data-target="gemini-api-key">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3C4.5 3 1.5 5.5 0.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5z" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
            </div>
            <div class="model-select">
              <label>Model</label>
              <select id="gemini-model" class="settings-select">
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-pro">Gemini Pro</option>
                <option value="gemini-pro-vision">Gemini Pro Vision</option>
              </select>
            </div>
            <div class="provider-status" id="gemini-status"></div>
          </div>

          <div class="settings-section">
            <h3>Ollama (Local)</h3>
            <div class="api-key-input">
              <label>Server URL</label>
              <input type="text" id="ollama-url" placeholder="http://localhost:11434" autocomplete="off">
            </div>
            <div class="model-select">
              <label>Model</label>
              <input type="text" id="ollama-model" placeholder="llama3.2" autocomplete="off">
            </div>
            <div class="provider-status" id="ollama-status"></div>
          </div>

          <div class="settings-section">
            <h3>OpenAI</h3>
            <div class="api-key-input">
              <label>API Key</label>
              <input type="password" id="openai-api-key" placeholder="sk-..." autocomplete="off">
              <button class="toggle-visibility" data-target="openai-api-key">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3C4.5 3 1.5 5.5 0.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5z" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
            </div>
            <div class="model-select">
              <label>Model</label>
              <select id="openai-model" class="settings-select">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            <div class="provider-status" id="openai-status"></div>
          </div>

          <div class="settings-section">
            <h3>OpenRouter</h3>
            <div class="api-key-input">
              <label>API Key</label>
              <input type="password" id="openrouter-api-key" placeholder="sk-or-..." autocomplete="off">
              <button class="toggle-visibility" data-target="openrouter-api-key">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3C4.5 3 1.5 5.5 0.5 8c1 2.5 4 5 7.5 5s6.5-2.5 7.5-5c-1-2.5-4-5-7.5-5z" stroke="currentColor" stroke-width="1.5"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
            </div>
            <div class="model-select">
              <label>Model</label>
              <input type="text" id="openrouter-model" placeholder="anthropic/claude-3.5-sonnet" autocomplete="off">
            </div>
            <div class="provider-status" id="openrouter-status"></div>
          </div>
        </div>
        <div class="model-settings-footer">
          <button class="save-btn">Save Settings</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('model-settings-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'model-settings-styles';
    styles.textContent = `
      .model-settings-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 10000;
      }

      .model-settings-modal.open {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .model-settings-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }

      .model-settings-panel {
        position: relative;
        width: 560px;
        max-height: 85vh;
        background: #1e1e22;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .model-settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .model-settings-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #fff;
      }

      .model-settings-header .close-btn {
        background: none;
        border: none;
        color: #a1a1aa;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.15s;
      }

      .model-settings-header .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .model-settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px 24px;
      }

      .settings-section {
        margin-bottom: 24px;
        padding-bottom: 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .settings-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }

      .settings-section h3 {
        margin: 0 0 16px;
        font-size: 14px;
        font-weight: 600;
        color: #e4e4e7;
      }

      .api-key-input,
      .model-select {
        margin-bottom: 12px;
      }

      .api-key-input label,
      .model-select label {
        display: block;
        font-size: 12px;
        color: #a1a1aa;
        margin-bottom: 6px;
      }

      .api-key-input {
        position: relative;
        display: flex;
        gap: 8px;
      }

      .api-key-input input,
      .model-select input,
      .settings-select {
        flex: 1;
        padding: 10px 12px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
      }

      .api-key-input input:focus,
      .model-select input:focus,
      .settings-select:focus {
        border-color: var(--donna-accent, #a78bfa);
      }

      .api-key-input input::placeholder,
      .model-select input::placeholder {
        color: #52525b;
      }

      .toggle-visibility {
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #a1a1aa;
        cursor: pointer;
        padding: 10px;
        transition: all 0.15s;
      }

      .toggle-visibility:hover {
        background: #3f3f46;
        color: #fff;
      }

      .settings-select {
        width: 100%;
        cursor: pointer;
      }

      .provider-status {
        margin-top: 8px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .provider-status.configured {
        color: #4ade80;
      }

      .provider-status.not-configured {
        color: #f87171;
      }

      .provider-status::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .model-settings-footer {
        padding: 16px 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: flex-end;
      }

      .save-btn {
        padding: 10px 24px;
        background: var(--donna-accent, #a78bfa);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }

      .save-btn:hover {
        background: #8b5cf6;
        transform: translateY(-1px);
      }

      .save-btn:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styles);
  }

  bindEvents() {
    // Close button
    this.modal.querySelector('.close-btn').addEventListener('click', () => this.close());

    // Overlay click to close
    this.modal.querySelector('.model-settings-overlay').addEventListener('click', () => this.close());

    // Toggle visibility buttons
    this.modal.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Save button
    this.modal.querySelector('.save-btn').addEventListener('click', () => this.save());

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  async open() {
    // Refresh config and providers
    this.config = await window.donnaConfig.get() || {};
    this.providers = await window.donnaModels.listProviders();

    // Populate form with current values
    this.populateForm();
    this.updateProviderStatuses();

    this.modal.classList.add('open');
    this.isOpen = true;
  }

  close() {
    this.modal.classList.remove('open');
    this.isOpen = false;
  }

  populateForm() {
    const models = this.config.models || {};

    // Default provider
    const defaultProvider = document.getElementById('default-provider');
    if (this.config.defaultProvider) {
      defaultProvider.value = this.config.defaultProvider;
    }

    // Claude
    if (models.claude?.apiKey) {
      document.getElementById('claude-api-key').value = models.claude.apiKey;
    }
    if (models.claude?.model) {
      document.getElementById('claude-model').value = models.claude.model;
    }

    // Gemini
    if (models.gemini?.apiKey) {
      document.getElementById('gemini-api-key').value = models.gemini.apiKey;
    }
    if (models.gemini?.model) {
      document.getElementById('gemini-model').value = models.gemini.model;
    }

    // Ollama
    if (models.ollama?.baseUrl) {
      document.getElementById('ollama-url').value = models.ollama.baseUrl;
    }
    if (models.ollama?.model) {
      document.getElementById('ollama-model').value = models.ollama.model;
    }

    // OpenAI
    if (models.openai?.apiKey) {
      document.getElementById('openai-api-key').value = models.openai.apiKey;
    }
    if (models.openai?.model) {
      document.getElementById('openai-model').value = models.openai.model;
    }

    // OpenRouter
    if (models.openrouter?.apiKey) {
      document.getElementById('openrouter-api-key').value = models.openrouter.apiKey;
    }
    if (models.openrouter?.model) {
      document.getElementById('openrouter-model').value = models.openrouter.model;
    }
  }

  updateProviderStatuses() {
    this.providers.forEach(provider => {
      const statusEl = document.getElementById(`${provider.name}-status`);
      if (statusEl) {
        if (provider.configured) {
          statusEl.className = 'provider-status configured';
          statusEl.textContent = 'Configured';
        } else {
          statusEl.className = 'provider-status not-configured';
          statusEl.textContent = 'Not configured';
        }
      }
    });

    // Ollama is always "configured" since it's local
    const ollamaStatus = document.getElementById('ollama-status');
    if (ollamaStatus) {
      ollamaStatus.className = 'provider-status configured';
      ollamaStatus.textContent = 'Local (no API key needed)';
    }
  }

  async save() {
    const newConfig = {
      defaultProvider: document.getElementById('default-provider').value,
      models: {
        claude: {
          apiKey: document.getElementById('claude-api-key').value || undefined,
          model: document.getElementById('claude-model').value
        },
        gemini: {
          apiKey: document.getElementById('gemini-api-key').value || undefined,
          model: document.getElementById('gemini-model').value
        },
        ollama: {
          baseUrl: document.getElementById('ollama-url').value || undefined,
          model: document.getElementById('ollama-model').value || undefined
        },
        openai: {
          apiKey: document.getElementById('openai-api-key').value || undefined,
          model: document.getElementById('openai-model').value
        },
        openrouter: {
          apiKey: document.getElementById('openrouter-api-key').value || undefined,
          model: document.getElementById('openrouter-model').value || undefined
        }
      }
    };

    // Clean up empty values
    Object.keys(newConfig.models).forEach(key => {
      const model = newConfig.models[key];
      Object.keys(model).forEach(k => {
        if (model[k] === undefined || model[k] === '') {
          delete model[k];
        }
      });
      if (Object.keys(model).length === 0) {
        delete newConfig.models[key];
      }
    });

    const result = await window.donnaConfig.set(newConfig);
    if (result.success) {
      // Refresh providers
      this.providers = await window.donnaModels.listProviders();
      this.updateProviderStatuses();

      // Show success feedback
      const saveBtn = this.modal.querySelector('.save-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      saveBtn.style.background = '#4ade80';
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
      }, 1500);
    }
  }
}

// Export for use in other modules
window.ModelSettings = ModelSettings;
