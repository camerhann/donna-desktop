/**
 * Donna Desktop - Image Generator Component
 * UI for generating images with Stable Diffusion and other providers
 */

class ImageGenerator {
  constructor() {
    this.isOpen = false;
    this.providers = [];
    this.isGenerating = false;
    this.generatedImages = [];
    this.modal = null;
    this.sdStatus = {
      installed: false,
      running: false,
      models: []
    };
  }

  async init() {
    await this.refreshProviders();
    await this.refreshSDStatus();
    this.createModal();
    this.bindEvents();
  }

  async refreshProviders() {
    try {
      this.providers = await window.donnaImaging.listProviders();
    } catch (e) {
      console.error('Failed to load providers:', e);
      this.providers = [];
    }
  }

  async refreshSDStatus() {
    try {
      const status = await window.donnaImaging.getInstallStatus();
      const running = await window.donnaImaging.isComfyUIRunning();
      this.sdStatus = {
        installed: status.installed,
        hasVenv: status.hasVenv,
        running,
        models: status.models || []
      };
    } catch (e) {
      console.error('Failed to get SD status:', e);
    }
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'image-generator-modal';
    this.modal.innerHTML = `
      <div class="image-generator-overlay"></div>
      <div class="image-generator-panel">
        <div class="image-generator-header">
          <h2>Image Generator</h2>
          <button class="close-btn" title="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="image-generator-content">
          <!-- SD Status Banner -->
          <div class="sd-status-banner" id="sd-status-banner">
            <div class="sd-status-info">
              <span class="sd-status-indicator"></span>
              <span class="sd-status-text">Checking Stable Diffusion status...</span>
            </div>
            <div class="sd-status-actions"></div>
          </div>

          <!-- Provider Selection -->
          <div class="generator-section">
            <label>Provider</label>
            <select id="image-provider" class="generator-select">
              <option value="comfyui">Stable Diffusion (Local - ComfyUI)</option>
              <option value="automatic1111">Stable Diffusion (Local - A1111)</option>
              <option value="dalle">DALL-E 3 (OpenAI)</option>
              <option value="flux">Flux (Replicate)</option>
            </select>
          </div>

          <!-- Prompt Input -->
          <div class="generator-section">
            <label>Prompt</label>
            <textarea id="image-prompt" class="generator-textarea" rows="4"
              placeholder="Describe the image you want to create..."></textarea>
          </div>

          <!-- Negative Prompt (for SD) -->
          <div class="generator-section sd-only">
            <label>Negative Prompt</label>
            <textarea id="negative-prompt" class="generator-textarea" rows="2"
              placeholder="What to avoid in the image...">blurry, bad quality, distorted, ugly, deformed</textarea>
          </div>

          <!-- Settings -->
          <div class="generator-settings">
            <div class="setting-group">
              <label>Size</label>
              <select id="image-size" class="generator-select-small">
                <option value="1024x1024">1024×1024</option>
                <option value="1024x768">1024×768 (4:3)</option>
                <option value="768x1024">768×1024 (3:4)</option>
                <option value="1280x720">1280×720 (16:9)</option>
                <option value="720x1280">720×1280 (9:16)</option>
                <option value="512x512">512×512 (Fast)</option>
              </select>
            </div>

            <div class="setting-group sd-only">
              <label>Steps</label>
              <input type="number" id="image-steps" class="generator-input-small" value="20" min="1" max="50">
            </div>

            <div class="setting-group sd-only">
              <label>CFG Scale</label>
              <input type="number" id="image-cfg" class="generator-input-small" value="7" min="1" max="20" step="0.5">
            </div>

            <div class="setting-group">
              <label>Count</label>
              <input type="number" id="image-count" class="generator-input-small" value="1" min="1" max="4">
            </div>
          </div>

          <!-- Model Selection (for SD) -->
          <div class="generator-section sd-only" id="model-section">
            <label>Model</label>
            <select id="sd-model" class="generator-select">
              <option value="">Loading models...</option>
            </select>
          </div>

          <!-- Generate Button -->
          <div class="generator-actions">
            <button id="generate-btn" class="generate-btn">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M7 10l2.5 3L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Generate Image
            </button>
            <button id="open-folder-btn" class="secondary-btn">
              Open Images Folder
            </button>
          </div>

          <!-- Results -->
          <div class="generator-results" id="generator-results">
            <div class="results-header">
              <h3>Generated Images</h3>
              <span class="results-count" id="results-count">0 images</span>
            </div>
            <div class="results-grid" id="results-grid">
              <!-- Generated images will appear here -->
            </div>
          </div>
        </div>

        <!-- Loading Overlay -->
        <div class="generating-overlay" id="generating-overlay">
          <div class="generating-content">
            <div class="generating-spinner"></div>
            <p>Generating image...</p>
            <p class="generating-tip">This may take a moment</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('image-generator-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'image-generator-styles';
    styles.textContent = `
      .image-generator-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 10000;
      }

      .image-generator-modal.open {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .image-generator-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }

      .image-generator-panel {
        position: relative;
        width: 640px;
        max-height: 90vh;
        background: #1e1e22;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .image-generator-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .image-generator-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #fff;
      }

      .image-generator-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }

      .sd-status-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #27272a;
        border-radius: 10px;
        margin-bottom: 20px;
      }

      .sd-status-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .sd-status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #f87171;
      }

      .sd-status-banner.running .sd-status-indicator {
        background: #4ade80;
      }

      .sd-status-banner.installed .sd-status-indicator {
        background: #fbbf24;
      }

      .sd-status-text {
        font-size: 13px;
        color: #a1a1aa;
      }

      .sd-status-actions button {
        padding: 6px 12px;
        font-size: 12px;
        background: var(--donna-accent, #a78bfa);
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .sd-status-actions button:hover {
        background: #8b5cf6;
      }

      .generator-section {
        margin-bottom: 16px;
      }

      .generator-section label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #a1a1aa;
        margin-bottom: 6px;
      }

      .generator-select,
      .generator-textarea,
      .generator-input-small,
      .generator-select-small {
        width: 100%;
        padding: 10px 12px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
      }

      .generator-select:focus,
      .generator-textarea:focus,
      .generator-input-small:focus,
      .generator-select-small:focus {
        border-color: var(--donna-accent, #a78bfa);
      }

      .generator-textarea {
        resize: vertical;
        font-family: inherit;
      }

      .generator-settings {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }

      .setting-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .setting-group label {
        font-size: 11px;
        color: #71717a;
        margin: 0;
      }

      .generator-input-small,
      .generator-select-small {
        width: 100%;
        padding: 8px 10px;
        font-size: 12px;
      }

      .generator-actions {
        display: flex;
        gap: 12px;
        margin-top: 20px;
      }

      .generate-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, var(--donna-accent, #a78bfa) 0%, #8b5cf6 100%);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }

      .generate-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
      }

      .generate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .secondary-btn {
        padding: 12px 16px;
        background: #27272a;
        color: #a1a1aa;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .secondary-btn:hover {
        background: #3f3f46;
        color: #fff;
      }

      .generator-results {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .results-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #e4e4e7;
      }

      .results-count {
        font-size: 12px;
        color: #71717a;
      }

      .results-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .result-image {
        position: relative;
        aspect-ratio: 1;
        border-radius: 10px;
        overflow: hidden;
        background: #27272a;
        cursor: pointer;
        transition: transform 0.15s;
      }

      .result-image:hover {
        transform: scale(1.02);
      }

      .result-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .result-image-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
        opacity: 0;
        transition: opacity 0.15s;
        display: flex;
        align-items: flex-end;
        padding: 12px;
      }

      .result-image:hover .result-image-overlay {
        opacity: 1;
      }

      .result-image-overlay button {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        backdrop-filter: blur(4px);
      }

      .generating-overlay {
        position: absolute;
        inset: 0;
        background: rgba(30, 30, 34, 0.95);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }

      .generating-overlay.active {
        display: flex;
      }

      .generating-content {
        text-align: center;
      }

      .generating-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(167, 139, 250, 0.2);
        border-top-color: var(--donna-accent, #a78bfa);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .generating-content p {
        margin: 0;
        color: #e4e4e7;
        font-size: 14px;
      }

      .generating-tip {
        color: #71717a !important;
        font-size: 12px !important;
        margin-top: 8px !important;
      }

      .sd-only {
        display: none;
      }

      .image-generator-panel.sd-mode .sd-only {
        display: block;
      }

      .image-generator-panel.sd-mode .setting-group.sd-only {
        display: flex;
      }

      .close-btn {
        background: none;
        border: none;
        color: #a1a1aa;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.15s;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    `;
    document.head.appendChild(styles);
  }

  bindEvents() {
    // Close button
    this.modal.querySelector('.close-btn').addEventListener('click', () => this.close());

    // Overlay click
    this.modal.querySelector('.image-generator-overlay').addEventListener('click', () => this.close());

    // Provider change
    const providerSelect = this.modal.querySelector('#image-provider');
    providerSelect.addEventListener('change', () => this.onProviderChange());

    // Generate button
    this.modal.querySelector('#generate-btn').addEventListener('click', () => this.generate());

    // Open folder button
    this.modal.querySelector('#open-folder-btn').addEventListener('click', () => {
      window.donnaImaging.openImagesFolder();
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  onProviderChange() {
    const provider = this.modal.querySelector('#image-provider').value;
    const panel = this.modal.querySelector('.image-generator-panel');

    if (provider === 'comfyui' || provider === 'automatic1111') {
      panel.classList.add('sd-mode');
      this.updateModelList();
    } else {
      panel.classList.remove('sd-mode');
    }
  }

  async updateModelList() {
    const modelSelect = this.modal.querySelector('#sd-model');
    const models = await window.donnaImaging.listModels();

    if (models.length > 0) {
      modelSelect.innerHTML = models.map(m =>
        `<option value="${m.name}">${m.name} (${m.size})</option>`
      ).join('');
    } else {
      modelSelect.innerHTML = '<option value="">No models found - please install one</option>';
    }
  }

  updateSDStatusBanner() {
    const banner = this.modal.querySelector('#sd-status-banner');
    const text = banner.querySelector('.sd-status-text');
    const actions = banner.querySelector('.sd-status-actions');

    banner.classList.remove('running', 'installed');

    if (this.sdStatus.running) {
      banner.classList.add('running');
      text.textContent = `Stable Diffusion running (${this.sdStatus.models.length} models)`;
      actions.innerHTML = '<button onclick="imageGenerator.stopSD()">Stop Server</button>';
    } else if (this.sdStatus.installed) {
      banner.classList.add('installed');
      text.textContent = 'Stable Diffusion installed but not running';
      actions.innerHTML = '<button onclick="imageGenerator.startSD()">Start Server</button>';
    } else {
      text.textContent = 'Stable Diffusion not installed';
      actions.innerHTML = '<button onclick="imageGenerator.installSD()">Install (Free, Local)</button>';
    }
  }

  async installSD() {
    const result = await window.donnaImaging.installComfyUI();
    if (result.success) {
      alert('ComfyUI installed! You need to download a model to start generating images.');
      await this.refreshSDStatus();
      this.updateSDStatusBanner();
    } else {
      alert('Installation failed: ' + result.error);
    }
  }

  async startSD() {
    const result = await window.donnaImaging.startComfyUI();
    if (result.success) {
      // Wait a moment for server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.refreshSDStatus();
      this.updateSDStatusBanner();
      this.updateModelList();
    } else {
      alert('Failed to start: ' + result.error);
    }
  }

  async stopSD() {
    await window.donnaImaging.stopComfyUI();
    await this.refreshSDStatus();
    this.updateSDStatusBanner();
  }

  async generate() {
    if (this.isGenerating) return;

    const prompt = this.modal.querySelector('#image-prompt').value.trim();
    if (!prompt) {
      alert('Please enter a prompt');
      return;
    }

    const provider = this.modal.querySelector('#image-provider').value;
    const [width, height] = this.modal.querySelector('#image-size').value.split('x').map(Number);
    const count = parseInt(this.modal.querySelector('#image-count').value) || 1;

    const options = {
      provider,
      width,
      height,
      batchSize: count
    };

    // Add SD-specific options
    if (provider === 'comfyui' || provider === 'automatic1111') {
      options.negativePrompt = this.modal.querySelector('#negative-prompt').value;
      options.steps = parseInt(this.modal.querySelector('#image-steps').value) || 20;
      options.cfg = parseFloat(this.modal.querySelector('#image-cfg').value) || 7;
      const model = this.modal.querySelector('#sd-model').value;
      if (model) options.model = model;
    }

    this.setGenerating(true);

    try {
      const result = await window.donnaImaging.generate(prompt, options);

      if (result.success && result.result.images) {
        this.addImages(result.result.images, prompt);
      } else {
        alert('Generation failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Generation error: ' + error.message);
    } finally {
      this.setGenerating(false);
    }
  }

  setGenerating(isGenerating) {
    this.isGenerating = isGenerating;
    const overlay = this.modal.querySelector('#generating-overlay');
    const btn = this.modal.querySelector('#generate-btn');

    if (isGenerating) {
      overlay.classList.add('active');
      btn.disabled = true;
    } else {
      overlay.classList.remove('active');
      btn.disabled = false;
    }
  }

  addImages(images, prompt) {
    const grid = this.modal.querySelector('#results-grid');
    const count = this.modal.querySelector('#results-count');

    for (const img of images) {
      this.generatedImages.unshift({ ...img, prompt });

      const imageEl = document.createElement('div');
      imageEl.className = 'result-image';
      imageEl.innerHTML = `
        <img src="file://${img.path}" alt="${prompt}">
        <div class="result-image-overlay">
          <button onclick="imageGenerator.openImage('${img.path}')">Open</button>
        </div>
      `;
      imageEl.addEventListener('click', () => this.openImage(img.path));

      grid.insertBefore(imageEl, grid.firstChild);
    }

    count.textContent = `${this.generatedImages.length} images`;
  }

  openImage(imagePath) {
    window.donnaImaging.openImage(imagePath);
  }

  async open() {
    await this.refreshProviders();
    await this.refreshSDStatus();
    this.updateSDStatusBanner();
    this.onProviderChange();

    this.modal.classList.add('open');
    this.isOpen = true;
  }

  close() {
    this.modal.classList.remove('open');
    this.isOpen = false;
  }
}

// Create global instance
const imageGenerator = new ImageGenerator();
window.ImageGenerator = ImageGenerator;
window.imageGenerator = imageGenerator;
