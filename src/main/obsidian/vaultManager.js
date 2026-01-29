/**
 * Vault Manager - Obsidian vault operations
 * Phase 7: Obsidian Vault Integration
 */
const fs = require('fs');
const path = require('path');
const { parseWikilinks, extractFrontmatter } = require('./wikilinkParser');

// chokidar v4 is ESM-only, use dynamic import
let chokidar = null;
async function getChokidar() {
  if (!chokidar) {
    chokidar = await import('chokidar');
  }
  return chokidar;
}

class VaultManager {
  constructor() {
    this.vaultPath = null;
    this.index = {
      files: new Map(),      // path -> { title, modified, links }
      backlinks: new Map(),  // path -> [paths that link to it]
      tags: new Map()        // tag -> [paths]
    };
    this.watcher = null;
    this.isIndexing = false;
    this.listeners = new Map();
  }

  /**
   * Set the vault path and initialize
   * @param {string} vaultPath - Path to Obsidian vault
   */
  async setPath(vaultPath) {
    // Validate path
    if (!fs.existsSync(vaultPath)) {
      return { success: false, error: 'Vault path does not exist' };
    }

    const stats = await fs.promises.stat(vaultPath);
    if (!stats.isDirectory()) {
      return { success: false, error: 'Vault path is not a directory' };
    }

    // Stop existing watcher
    if (this.watcher) {
      await this.watcher.close();
    }

    this.vaultPath = vaultPath;

    // Index the vault
    await this.buildIndex();

    // Start file watcher
    await this.startWatcher();

    return {
      success: true,
      vaultPath: this.vaultPath,
      fileCount: this.index.files.size
    };
  }

  /**
   * Build index of all markdown files
   */
  async buildIndex() {
    if (!this.vaultPath || this.isIndexing) return;

    this.isIndexing = true;
    this.index.files.clear();
    this.index.backlinks.clear();
    this.index.tags.clear();

    try {
      await this.indexDirectory(this.vaultPath);
      this.buildBacklinks();
      this.emit('indexComplete', { fileCount: this.index.files.size });
    } catch (error) {
      console.error('Vault indexing error:', error);
    }

    this.isIndexing = false;
  }

  /**
   * Recursively index a directory
   */
  async indexDirectory(dirPath) {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.vaultPath, fullPath);

      // Skip hidden files and .obsidian folder
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        await this.indexDirectory(fullPath);
      } else if (entry.name.endsWith('.md')) {
        await this.indexFile(fullPath, relativePath);
      }
    }
  }

  /**
   * Index a single markdown file
   */
  async indexFile(fullPath, relativePath) {
    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const stats = await fs.promises.stat(fullPath);
      const { frontmatter, content: bodyContent } = extractFrontmatter(content);
      const links = parseWikilinks(bodyContent);

      // Extract title from frontmatter or filename
      const title = frontmatter.title
        || path.basename(relativePath, '.md');

      // Extract tags
      const tags = frontmatter.tags || [];
      const inlineTags = bodyContent.match(/#[\w-]+/g) || [];

      this.index.files.set(relativePath, {
        path: relativePath,
        fullPath,
        title,
        modified: stats.mtime,
        links: links.map(l => l.target),
        tags: [...new Set([...tags, ...inlineTags.map(t => t.slice(1))])]
      });

      // Index tags
      for (const tag of tags) {
        if (!this.index.tags.has(tag)) {
          this.index.tags.set(tag, []);
        }
        this.index.tags.get(tag).push(relativePath);
      }
    } catch (error) {
      console.warn(`Failed to index ${relativePath}:`, error.message);
    }
  }

  /**
   * Build backlinks index
   */
  buildBacklinks() {
    this.index.backlinks.clear();

    for (const [sourcePath, fileInfo] of this.index.files) {
      for (const link of fileInfo.links) {
        const targetPath = this.resolveWikilinkPath(link);
        if (targetPath) {
          if (!this.index.backlinks.has(targetPath)) {
            this.index.backlinks.set(targetPath, []);
          }
          this.index.backlinks.get(targetPath).push(sourcePath);
        }
      }
    }
  }

  /**
   * Start file watcher for live updates
   */
  async startWatcher() {
    if (!this.vaultPath) return;

    const chokidarModule = await getChokidar();
    this.watcher = chokidarModule.watch(this.vaultPath, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', async (fullPath) => {
        if (fullPath.endsWith('.md')) {
          const relativePath = path.relative(this.vaultPath, fullPath);
          await this.indexFile(fullPath, relativePath);
          this.buildBacklinks();
          this.emit('fileAdded', { path: relativePath });
        }
      })
      .on('change', async (fullPath) => {
        if (fullPath.endsWith('.md')) {
          const relativePath = path.relative(this.vaultPath, fullPath);
          await this.indexFile(fullPath, relativePath);
          this.buildBacklinks();
          this.emit('fileChanged', { path: relativePath });
        }
      })
      .on('unlink', (fullPath) => {
        if (fullPath.endsWith('.md')) {
          const relativePath = path.relative(this.vaultPath, fullPath);
          this.index.files.delete(relativePath);
          this.buildBacklinks();
          this.emit('fileRemoved', { path: relativePath });
        }
      });
  }

  /**
   * Search notes by query
   * @param {string} query - Search query
   * @returns {Array} Matching notes
   */
  async search(query) {
    if (!this.vaultPath) return [];

    const results = [];
    const queryLower = query.toLowerCase();

    for (const [relativePath, fileInfo] of this.index.files) {
      // Search in title
      if (fileInfo.title.toLowerCase().includes(queryLower)) {
        results.push({
          path: relativePath,
          title: fileInfo.title,
          modified: fileInfo.modified,
          matchType: 'title'
        });
        continue;
      }

      // Search in content
      try {
        const content = await fs.promises.readFile(fileInfo.fullPath, 'utf-8');
        if (content.toLowerCase().includes(queryLower)) {
          // Extract excerpt around match
          const index = content.toLowerCase().indexOf(queryLower);
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + query.length + 50);
          const excerpt = content.slice(start, end).replace(/\n/g, ' ');

          results.push({
            path: relativePath,
            title: fileInfo.title,
            modified: fileInfo.modified,
            matchType: 'content',
            excerpt: (start > 0 ? '...' : '') + excerpt + (end < content.length ? '...' : '')
          });
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    // Sort by modification time
    results.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return results.slice(0, 50); // Limit results
  }

  /**
   * Read a note's content
   * @param {string} relativePath - Path relative to vault
   */
  async readNote(relativePath) {
    if (!this.vaultPath) {
      return { success: false, error: 'No vault configured' };
    }

    const fullPath = path.join(this.vaultPath, relativePath);

    try {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const { frontmatter, content: bodyContent } = extractFrontmatter(content);
      const links = parseWikilinks(bodyContent);
      const backlinks = this.index.backlinks.get(relativePath) || [];

      return {
        success: true,
        path: relativePath,
        content: bodyContent,
        frontmatter,
        links,
        backlinks: backlinks.map(p => ({
          path: p,
          title: this.index.files.get(p)?.title || path.basename(p, '.md')
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new note
   * @param {string} relativePath - Path relative to vault
   * @param {string} content - Note content
   */
  async createNote(relativePath, content) {
    if (!this.vaultPath) {
      return { success: false, error: 'No vault configured' };
    }

    const fullPath = path.join(this.vaultPath, relativePath);
    const dir = path.dirname(fullPath);

    try {
      // Create directory if needed
      await fs.promises.mkdir(dir, { recursive: true });

      // Check if file exists
      if (fs.existsSync(fullPath)) {
        return { success: false, error: 'Note already exists' };
      }

      await fs.promises.writeFile(fullPath, content, 'utf-8');

      // Index the new file
      await this.indexFile(fullPath, relativePath);
      this.buildBacklinks();

      return { success: true, path: relativePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve a wikilink to a file path
   * @param {string} linkText - The wikilink text (without brackets)
   */
  resolveWikilinkPath(linkText) {
    // Remove alias if present
    const target = linkText.split('|')[0].trim();

    // Try exact match
    const exactPath = target.endsWith('.md') ? target : `${target}.md`;
    if (this.index.files.has(exactPath)) {
      return exactPath;
    }

    // Try finding by title
    for (const [filePath, fileInfo] of this.index.files) {
      if (fileInfo.title.toLowerCase() === target.toLowerCase()) {
        return filePath;
      }
      // Match filename without extension
      if (path.basename(filePath, '.md').toLowerCase() === target.toLowerCase()) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * Resolve wikilink (public API)
   */
  resolveWikilink(linkText) {
    const resolvedPath = this.resolveWikilinkPath(linkText);
    return {
      path: resolvedPath,
      exists: resolvedPath !== null,
      title: resolvedPath ? this.index.files.get(resolvedPath)?.title : linkText
    };
  }

  /**
   * Get backlinks for a note
   */
  getBacklinks(relativePath) {
    const backlinks = this.index.backlinks.get(relativePath) || [];
    return backlinks.map(p => ({
      path: p,
      title: this.index.files.get(p)?.title || path.basename(p, '.md')
    }));
  }

  /**
   * Get folder tree
   */
  getFolderTree() {
    if (!this.vaultPath) return null;

    const tree = { name: path.basename(this.vaultPath), children: [], files: [] };

    for (const [relativePath, fileInfo] of this.index.files) {
      const parts = relativePath.split(path.sep);
      let current = tree;

      for (let i = 0; i < parts.length - 1; i++) {
        let child = current.children.find(c => c.name === parts[i]);
        if (!child) {
          child = { name: parts[i], children: [], files: [] };
          current.children.push(child);
        }
        current = child;
      }

      current.files.push({
        name: parts[parts.length - 1],
        path: relativePath,
        title: fileInfo.title
      });
    }

    return tree;
  }

  /**
   * Event handling
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try { callback(data); } catch (e) { console.error(e); }
      }
    }
  }

  /**
   * Cleanup
   */
  async destroy() {
    if (this.watcher) {
      await this.watcher.close();
    }
  }
}

// Singleton
let instance = null;

function getVaultManager() {
  if (!instance) {
    instance = new VaultManager();
  }
  return instance;
}

module.exports = { VaultManager, getVaultManager };
