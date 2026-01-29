/**
 * Preview Window Renderer Script
 * Handles rendering of different file types
 * Uses marked for Markdown and highlight.js for code
 */

// Import marked and highlight.js from node_modules (loaded via Electron)
// We'll load these dynamically since we're in a renderer context

class PreviewRenderer {
  constructor() {
    this.currentContent = null;
    this.elements = {};
    this.marked = null;
    this.hljs = null;

    this.init();
  }

  async init() {
    // Cache DOM elements
    this.elements = {
      loading: document.querySelector('.preview-loading'),
      error: document.querySelector('.preview-error'),
      errorMessage: document.querySelector('.error-message'),
      image: document.querySelector('.preview-image'),
      imageTag: document.querySelector('.preview-image img'),
      markdown: document.querySelector('.preview-markdown'),
      code: document.querySelector('.preview-code'),
      codeBlock: document.querySelector('.preview-code code'),
      text: document.querySelector('.preview-text'),
      textPre: document.querySelector('.preview-text pre'),
      fileName: document.querySelector('.file-name'),
      fileSize: document.querySelector('.file-size'),
      fileIcon: document.querySelector('.file-icon'),
      filePath: document.querySelector('.file-path'),
      fileModified: document.querySelector('.file-modified'),
      copyBtn: document.querySelector('.copy-btn'),
      closeBtn: document.querySelector('.close-btn')
    };

    // Load libraries
    await this.loadLibraries();

    // Setup event listeners
    this.setupEvents();

    // Listen for content from main process
    if (window.previewAPI) {
      window.previewAPI.onContent((data) => this.renderContent(data));
      window.previewAPI.onError((data) => this.showError(data.error));
    }
  }

  async loadLibraries() {
    // marked and highlight.js need to be loaded
    // In Electron, we can require them directly or load from CDN
    // For simplicity, we'll use inline implementations for basic rendering

    // Simple marked-like parser for Markdown
    this.marked = this.createSimpleMarkdownParser();

    // highlight.js will be loaded from the main package
    // For now, we'll include a basic highlighter
    this.hljs = this.createSimpleHighlighter();
  }

  createSimpleMarkdownParser() {
    // A simple markdown parser that handles common cases
    return {
      parse: (text) => {
        let html = text;

        // Escape HTML first
        html = html.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');

        // Code blocks (fenced)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
          const highlighted = this.hljs ? this.hljs.highlight(code, lang) : code;
          return `<pre><code class="hljs language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Headers
        html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

        // Blockquotes
        html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

        // Horizontal rules
        html = html.replace(/^---+$/gm, '<hr>');
        html = html.replace(/^\*\*\*+$/gm, '<hr>');

        // Unordered lists
        html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Ordered lists
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

        // Paragraphs (double newlines)
        html = html.replace(/\n\n+/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>\s*(<h[1-6]>)/g, '$1');
        html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, '$1');
        html = html.replace(/<p>\s*(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
        html = html.replace(/<p>\s*(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
        html = html.replace(/<p>\s*(<blockquote>)/g, '$1');
        html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
        html = html.replace(/<p>\s*(<hr>)/g, '$1');
        html = html.replace(/(<hr>)\s*<\/p>/g, '$1');

        return html;
      }
    };
  }

  createSimpleHighlighter() {
    // Keywords for various languages
    const keywords = {
      javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'void', 'this', 'class', 'extends', 'export', 'import', 'from', 'as', 'default', 'async', 'await', 'yield', 'static', 'get', 'set', 'of', 'in', 'true', 'false', 'null', 'undefined', 'NaN', 'Infinity'],
      typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'void', 'this', 'class', 'extends', 'export', 'import', 'from', 'as', 'default', 'async', 'await', 'yield', 'static', 'get', 'set', 'of', 'in', 'true', 'false', 'null', 'undefined', 'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract', 'implements', 'public', 'private', 'protected', 'readonly'],
      python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'raise', 'import', 'from', 'as', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'pass', 'break', 'continue', 'True', 'False', 'None', 'and', 'or', 'not', 'is', 'in', 'async', 'await'],
      go: ['package', 'import', 'func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'goto', 'defer', 'go', 'select', 'chan', 'map', 'struct', 'interface', 'type', 'const', 'var', 'true', 'false', 'nil'],
      rust: ['fn', 'let', 'mut', 'const', 'return', 'if', 'else', 'match', 'for', 'while', 'loop', 'break', 'continue', 'impl', 'trait', 'struct', 'enum', 'mod', 'use', 'pub', 'self', 'super', 'crate', 'async', 'await', 'move', 'ref', 'static', 'type', 'where', 'unsafe', 'true', 'false'],
      default: ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'true', 'false', 'null']
    };

    return {
      highlight: (code, lang) => {
        const langKeywords = keywords[lang] || keywords.default;
        const keywordPattern = new RegExp(`\\b(${langKeywords.join('|')})\\b`, 'g');

        let result = code;

        // Comments (single line)
        result = result.replace(/(\/\/.*$)/gm, '<span class="hljs-comment">$1</span>');
        result = result.replace(/(#.*$)/gm, '<span class="hljs-comment">$1</span>');

        // Multi-line comments
        result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hljs-comment">$1</span>');

        // Strings (double and single quotes)
        result = result.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="hljs-string">$1</span>');
        result = result.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="hljs-string">$1</span>');

        // Template strings
        result = result.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="hljs-string">$1</span>');

        // Numbers
        result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="hljs-number">$1</span>');

        // Keywords
        result = result.replace(keywordPattern, '<span class="hljs-keyword">$1</span>');

        // Function calls
        result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span class="hljs-title">$1</span>(');

        return result;
      }
    };
  }

  setupEvents() {
    // Copy button
    this.elements.copyBtn?.addEventListener('click', () => this.copyContent());

    // Close button
    this.elements.closeBtn?.addEventListener('click', () => {
      if (window.previewAPI) {
        window.previewAPI.close();
      } else {
        window.close();
      }
    });
  }

  renderContent(data) {
    const { filePath, fileName, fileType, language, content, size, modified } = data;

    this.currentContent = content;

    // Update header info
    this.elements.fileName.textContent = fileName;
    this.elements.fileSize.textContent = this.formatSize(size);
    this.elements.fileIcon.dataset.type = fileType;

    // Update footer
    this.elements.filePath.textContent = filePath;
    this.elements.fileModified.textContent = this.formatDate(new Date(modified));

    // Hide all content areas
    this.hideAllContent();

    // Show appropriate content area
    switch (fileType) {
      case 'image':
        this.renderImage(content);
        break;
      case 'markdown':
        this.renderMarkdown(content);
        break;
      case 'code':
        this.renderCode(content, language);
        break;
      default:
        this.renderText(content);
    }
  }

  hideAllContent() {
    this.elements.loading.style.display = 'none';
    this.elements.error.style.display = 'none';
    this.elements.image.style.display = 'none';
    this.elements.markdown.style.display = 'none';
    this.elements.code.style.display = 'none';
    this.elements.text.style.display = 'none';
  }

  renderImage(dataUrl) {
    this.elements.imageTag.src = dataUrl;
    this.elements.image.style.display = 'flex';
  }

  renderMarkdown(content) {
    const html = this.marked.parse(content);
    this.elements.markdown.innerHTML = html;
    this.elements.markdown.style.display = 'block';
  }

  renderCode(content, language) {
    const highlighted = this.hljs.highlight(content, language);
    this.elements.codeBlock.innerHTML = highlighted;
    this.elements.codeBlock.className = `hljs language-${language || 'plaintext'}`;
    this.elements.code.style.display = 'block';
  }

  renderText(content) {
    this.elements.textPre.textContent = content;
    this.elements.text.style.display = 'block';
  }

  showError(message) {
    this.hideAllContent();
    this.elements.errorMessage.textContent = message;
    this.elements.error.style.display = 'flex';
  }

  async copyContent() {
    if (!this.currentContent) return;

    try {
      // For images, we can't copy the data URL directly as text
      // For other content, copy the raw content
      const textToCopy = typeof this.currentContent === 'string' &&
                         !this.currentContent.startsWith('data:')
        ? this.currentContent
        : 'Cannot copy image content as text';

      await navigator.clipboard.writeText(textToCopy);

      // Visual feedback
      this.elements.copyBtn.classList.add('copied');
      setTimeout(() => {
        this.elements.copyBtn.classList.remove('copied');
      }, 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }

  formatDate(date) {
    const now = new Date();
    const diff = now - date;

    // Less than a minute
    if (diff < 60000) return 'just now';

    // Less than an hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} min${mins > 1 ? 's' : ''} ago`;
    }

    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Format as date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PreviewRenderer();
});
