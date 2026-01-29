/**
 * File Attachment Component
 * Phase 3: File Cards/Attachments
 * Drag-drop zone and file card rendering
 */

class FileAttachmentManager {
  constructor(options = {}) {
    this.options = {
      maxFiles: 5,
      onAttach: options.onAttach || null,
      onRemove: options.onRemove || null,
      ...options
    };

    this.attachments = [];
    this.dropZone = null;
    this.attachmentContainer = null;

    this.addStyles();
  }

  /**
   * Create drag-drop zone
   * @param {HTMLElement} container - Container element
   */
  createDropZone(container) {
    this.dropZone = document.createElement('div');
    this.dropZone.className = 'file-drop-zone';
    this.dropZone.innerHTML = `
      <div class="file-drop-overlay">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 4v24M4 16h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <span>Drop files here</span>
      </div>
    `;

    this.attachmentContainer = document.createElement('div');
    this.attachmentContainer.className = 'file-attachments';

    container.appendChild(this.dropZone);
    container.appendChild(this.attachmentContainer);

    this.bindDropEvents(container);

    return this.dropZone;
  }

  /**
   * Bind drag-drop events
   */
  bindDropEvents(container) {
    let dragCounter = 0;

    container.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      this.dropZone.classList.add('active');
    });

    container.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        this.dropZone.classList.remove('active');
      }
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      this.dropZone.classList.remove('active');

      const files = Array.from(e.dataTransfer.files);
      await this.processFiles(files);
    });

    // Also allow paste
    container.addEventListener('paste', async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const files = items
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter(Boolean);

      if (files.length > 0) {
        e.preventDefault();
        await this.processFiles(files);
      }
    });
  }

  /**
   * Process dropped/pasted files
   */
  async processFiles(files) {
    if (this.attachments.length >= this.options.maxFiles) {
      alert(`Maximum ${this.options.maxFiles} files allowed`);
      return;
    }

    const remaining = this.options.maxFiles - this.attachments.length;
    const filesToProcess = files.slice(0, remaining);

    for (const file of filesToProcess) {
      await this.addFile(file);
    }
  }

  /**
   * Add a file attachment
   */
  async addFile(file) {
    try {
      // Process file through main process
      const result = await window.donnaFiles?.process(file.path || file.name);

      if (!result?.success) {
        // Handle browser File objects (from drag-drop)
        const fileData = {
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          sizeFormatted: this.formatSize(file.size),
          type: file.type,
          isImage: file.type.startsWith('image/'),
          isText: file.type.startsWith('text/'),
          file: file // Keep original file reference
        };

        // Generate thumbnail for images
        if (fileData.isImage) {
          fileData.thumbnail = await this.createThumbnail(file);
        }

        this.attachments.push(fileData);
        this.renderAttachment(fileData);
      } else {
        this.attachments.push(result.file);
        this.renderAttachment(result.file);
      }

      if (this.options.onAttach) {
        this.options.onAttach(this.attachments);
      }
    } catch (error) {
      console.error('Failed to add file:', error);
    }
  }

  /**
   * Create thumbnail from File object
   */
  createThumbnail(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Render an attachment card
   */
  renderAttachment(file) {
    const card = document.createElement('div');
    card.className = 'file-attachment-card';
    card.dataset.fileId = file.id;

    const icon = this.getFileIcon(file);

    card.innerHTML = `
      ${file.thumbnail ? `
        <div class="file-thumbnail">
          <img src="${file.thumbnail}" alt="${this.escapeHtml(file.name)}"/>
        </div>
      ` : `
        <div class="file-icon">${icon}</div>
      `}
      <div class="file-info">
        <div class="file-name" title="${this.escapeHtml(file.name)}">${this.escapeHtml(file.name)}</div>
        <div class="file-size">${file.sizeFormatted || this.formatSize(file.size)}</div>
      </div>
      <button class="file-remove" title="Remove">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    card.querySelector('.file-remove').addEventListener('click', () => {
      this.removeFile(file.id);
    });

    this.attachmentContainer.appendChild(card);
    this.updateVisibility();
  }

  /**
   * Remove a file attachment
   */
  removeFile(fileId) {
    const index = this.attachments.findIndex(f => f.id === fileId);
    if (index > -1) {
      this.attachments.splice(index, 1);
    }

    const card = this.attachmentContainer.querySelector(`[data-file-id="${fileId}"]`);
    if (card) {
      card.remove();
    }

    if (this.options.onRemove) {
      this.options.onRemove(this.attachments);
    }

    this.updateVisibility();
  }

  /**
   * Get all attachments
   */
  getAttachments() {
    return this.attachments;
  }

  /**
   * Clear all attachments
   */
  clearAttachments() {
    this.attachments = [];
    if (this.attachmentContainer) {
      this.attachmentContainer.innerHTML = '';
    }
    this.updateVisibility();
  }

  /**
   * Update visibility of attachment container
   */
  updateVisibility() {
    if (this.attachmentContainer) {
      this.attachmentContainer.style.display = this.attachments.length > 0 ? 'flex' : 'none';
    }
  }

  /**
   * Get icon for file type
   */
  getFileIcon(file) {
    if (file.type?.includes('pdf')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5"/><text x="7" y="16" font-size="6" fill="currentColor">PDF</text></svg>`;
    }
    if (file.isText || file.type?.startsWith('text/')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.5"/></svg>`;
    }
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
    if (document.getElementById('file-attachment-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'file-attachment-styles';
    styles.textContent = `
      .file-drop-zone {
        position: relative;
      }

      .file-drop-overlay {
        display: none;
        position: absolute;
        inset: 0;
        background: rgba(167, 139, 250, 0.1);
        border: 2px dashed var(--donna-accent, #a78bfa);
        border-radius: 12px;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        color: var(--donna-accent, #a78bfa);
        font-size: 14px;
        z-index: 10;
      }

      .file-drop-zone.active .file-drop-overlay {
        display: flex;
      }

      .file-attachments {
        display: none;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 0;
      }

      .file-attachment-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        max-width: 200px;
      }

      .file-thumbnail {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
      }

      .file-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .file-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #71717a;
        flex-shrink: 0;
      }

      .file-info {
        flex: 1;
        min-width: 0;
      }

      .file-name {
        font-size: 12px;
        font-weight: 500;
        color: #e4e4e7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-size {
        font-size: 11px;
        color: #71717a;
      }

      .file-remove {
        width: 24px;
        height: 24px;
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        flex-shrink: 0;
      }

      .file-remove:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export
window.FileAttachmentManager = FileAttachmentManager;
