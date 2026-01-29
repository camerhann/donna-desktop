/**
 * Link Preview Component
 * Phase 2: Rich Link Previews
 * Renders preview cards for URLs in chat
 */

class LinkPreviewRenderer {
  constructor() {
    this.cache = new Map();
    this.pendingPreviews = new Map();
    this.addStyles();
  }

  /**
   * Detect URLs in text and return them
   * @param {string} text - Text to scan
   * @returns {Array<string>} URLs found
   */
  detectUrls(text) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    return [...new Set(text.match(urlRegex) || [])];
  }

  /**
   * Create a link preview element
   * @param {string} url - URL to preview
   * @returns {HTMLElement} Preview element
   */
  createPreviewElement(url) {
    const el = document.createElement('div');
    el.className = 'link-preview-card loading';
    el.dataset.url = url;
    el.innerHTML = `
      <div class="link-preview-loading">
        <div class="link-preview-spinner"></div>
        <span>Loading preview...</span>
      </div>
    `;
    return el;
  }

  /**
   * Fetch and render preview for a URL
   * @param {HTMLElement} element - The preview element
   * @param {string} url - URL to preview
   */
  async fetchAndRender(element, url) {
    try {
      const result = await window.donnaLinks?.getPreview(url);

      if (result?.success) {
        this.renderPreview(element, result);
      } else {
        this.renderFallback(element, url, result?.error);
      }
    } catch (error) {
      this.renderFallback(element, url, error.message);
    }
  }

  /**
   * Render a successful preview
   */
  renderPreview(element, data) {
    element.classList.remove('loading');
    element.innerHTML = `
      ${data.image ? `
        <div class="link-preview-image">
          <img src="${this.escapeHtml(data.image)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"/>
        </div>
      ` : ''}
      <div class="link-preview-content">
        <div class="link-preview-site">
          ${data.favicon ? `<img src="${this.escapeHtml(data.favicon)}" class="link-preview-favicon" onerror="this.style.display='none'"/>` : ''}
          <span>${this.escapeHtml(data.siteName || this.getDomain(data.url))}</span>
        </div>
        <div class="link-preview-title">
          <a href="${this.escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">
            ${this.escapeHtml(data.title)}
          </a>
        </div>
        ${data.description ? `
          <div class="link-preview-description">
            ${this.escapeHtml(data.description)}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render fallback for failed preview
   */
  renderFallback(element, url, error) {
    element.classList.remove('loading');
    element.classList.add('fallback');
    element.innerHTML = `
      <div class="link-preview-content">
        <div class="link-preview-site">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1l6 6-6 6-6-6 6-6z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>${this.escapeHtml(this.getDomain(url))}</span>
        </div>
        <div class="link-preview-title">
          <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
            ${this.escapeHtml(url)}
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Process a message and add link previews
   * @param {HTMLElement} messageElement - The message content element
   */
  async processMessage(messageElement) {
    const text = messageElement.textContent;
    const urls = this.detectUrls(text);

    if (urls.length === 0) return;

    // Create container for previews
    const previewContainer = document.createElement('div');
    previewContainer.className = 'link-previews-container';

    // Limit to first 3 URLs
    const urlsToPreview = urls.slice(0, 3);

    for (const url of urlsToPreview) {
      const previewEl = this.createPreviewElement(url);
      previewContainer.appendChild(previewEl);
      this.fetchAndRender(previewEl, url);
    }

    messageElement.appendChild(previewContainer);
  }

  /**
   * Get domain from URL
   */
  getDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Add styles
   */
  addStyles() {
    if (document.getElementById('link-preview-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'link-preview-styles';
    styles.textContent = `
      .link-previews-container {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .link-preview-card {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        overflow: hidden;
        transition: border-color 0.15s;
      }

      .link-preview-card:hover {
        border-color: rgba(255, 255, 255, 0.15);
      }

      .link-preview-card.loading {
        padding: 12px;
      }

      .link-preview-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #71717a;
        font-size: 12px;
      }

      .link-preview-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--donna-accent, #a78bfa);
        border-radius: 50%;
        animation: linkPreviewSpin 0.8s linear infinite;
      }

      @keyframes linkPreviewSpin {
        to { transform: rotate(360deg); }
      }

      .link-preview-image {
        width: 120px;
        height: 80px;
        flex-shrink: 0;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.3);
      }

      .link-preview-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .link-preview-content {
        flex: 1;
        padding: 10px 12px;
        min-width: 0;
      }

      .link-preview-site {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #71717a;
        margin-bottom: 4px;
      }

      .link-preview-favicon {
        width: 14px;
        height: 14px;
        border-radius: 2px;
      }

      .link-preview-title {
        margin-bottom: 4px;
      }

      .link-preview-title a {
        color: #e4e4e7;
        text-decoration: none;
        font-weight: 500;
        font-size: 13px;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .link-preview-title a:hover {
        color: var(--donna-accent, #a78bfa);
      }

      .link-preview-description {
        font-size: 12px;
        color: #71717a;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .link-preview-card.fallback {
        padding: 10px 12px;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export singleton
window.linkPreviewRenderer = new LinkPreviewRenderer();
