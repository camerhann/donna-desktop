/**
 * File Handler - Process files for attachments and AI vision
 * Phase 3: File Cards/Attachments
 */
const fs = require('fs');
const path = require('path');
const { isPathSafe } = require('../security/fileSandbox');

// Try to load sharp, but make it optional
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('Sharp not available, image thumbnails will be disabled');
  sharp = null;
}

class FileHandler {
  constructor(options = {}) {
    this.options = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      thumbnailSize: 200,
      allowedImageTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      allowedTextTypes: ['text/plain', 'text/markdown', 'text/csv', 'application/json'],
      ...options
    };

    // File type mappings
    this.typeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.html': 'text/html',
      '.css': 'text/css',
      '.sh': 'text/x-shellscript',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml'
    };
  }

  /**
   * Process a file and return metadata
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File metadata
   */
  async processFile(filePath) {
    try {
      // Security check
      if (!isPathSafe(filePath)) {
        throw new Error('File path not allowed');
      }

      const stats = await fs.promises.stat(filePath);

      // Check file size
      if (stats.size > this.options.maxFileSize) {
        throw new Error(`File too large (max ${this.options.maxFileSize / 1024 / 1024}MB)`);
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.typeMap[ext] || 'application/octet-stream';
      const isImage = this.options.allowedImageTypes.includes(mimeType);
      const isText = mimeType.startsWith('text/') || mimeType === 'application/json';

      const result = {
        id: this.generateId(),
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        sizeFormatted: this.formatSize(stats.size),
        type: mimeType,
        ext,
        isImage,
        isText,
        isPdf: mimeType === 'application/pdf',
        modified: stats.mtime,
        thumbnail: null,
        preview: null
      };

      // Generate thumbnail for images
      if (isImage && sharp) {
        try {
          result.thumbnail = await this.generateThumbnail(filePath);
        } catch (e) {
          console.warn('Thumbnail generation failed:', e.message);
        }
      }

      // Get text preview for text files
      if (isText && stats.size < 100000) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          result.preview = content.slice(0, 500);
        } catch (e) {
          console.warn('Text preview failed:', e.message);
        }
      }

      return { success: true, file: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate thumbnail for an image
   * @param {string} filePath - Path to image
   * @returns {Promise<string>} Base64 thumbnail
   */
  async generateThumbnail(filePath) {
    if (!sharp) {
      throw new Error('Sharp not available');
    }

    const buffer = await sharp(filePath)
      .resize(this.options.thumbnailSize, this.options.thumbnailSize, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  /**
   * Encode file for AI vision API
   * @param {string} filePath - Path to image
   * @returns {Promise<Object>} { base64, mimeType }
   */
  async encodeForAI(filePath) {
    try {
      // Security check
      if (!isPathSafe(filePath)) {
        throw new Error('File path not allowed');
      }

      const stats = await fs.promises.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.typeMap[ext];

      // Only allow images for AI vision
      if (!this.options.allowedImageTypes.includes(mimeType)) {
        throw new Error('File type not supported for AI vision');
      }

      // Check file size (AI APIs have limits)
      if (stats.size > 20 * 1024 * 1024) { // 20MB limit for most AI APIs
        throw new Error('File too large for AI vision (max 20MB)');
      }

      const buffer = await fs.promises.readFile(filePath);
      const base64 = buffer.toString('base64');

      return {
        success: true,
        base64,
        mimeType,
        size: stats.size
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Read text file content
   * @param {string} filePath - Path to file
   * @param {number} maxLength - Maximum characters to read
   * @returns {Promise<Object>}
   */
  async readTextFile(filePath, maxLength = 50000) {
    try {
      if (!isPathSafe(filePath)) {
        throw new Error('File path not allowed');
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const truncated = content.length > maxLength;

      return {
        success: true,
        content: truncated ? content.slice(0, maxLength) : content,
        truncated,
        totalLength: content.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Prepare attachments for chat API
   * @param {Array} attachments - Array of file objects
   * @returns {Promise<Array>} Content parts for API
   */
  async prepareAttachmentsForChat(attachments) {
    const parts = [];

    for (const attachment of attachments) {
      if (attachment.isImage) {
        const encoded = await this.encodeForAI(attachment.path);
        if (encoded.success) {
          parts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: encoded.mimeType,
              data: encoded.base64
            }
          });
        }
      } else if (attachment.isText) {
        const text = await this.readTextFile(attachment.path);
        if (text.success) {
          parts.push({
            type: 'text',
            text: `[File: ${attachment.name}]\n${text.content}${text.truncated ? '\n... (truncated)' : ''}`
          });
        }
      }
    }

    return parts;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Format file size for display
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
}

// Singleton
let instance = null;

function getFileHandler() {
  if (!instance) {
    instance = new FileHandler();
  }
  return instance;
}

module.exports = { FileHandler, getFileHandler };
