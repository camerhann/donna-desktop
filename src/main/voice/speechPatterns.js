/**
 * Speech Patterns - Personal Speech Learning System
 *
 * Learns from user corrections to improve transcription accuracy.
 * Stores patterns in ~/.donna-desktop/speech-patterns.json
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

class SpeechPatterns {
  constructor() {
    this.patternsPath = path.join(os.homedir(), '.donna-desktop', 'speech-patterns.json');
    this.patterns = {
      corrections: [], // [{id, original, corrected, count, lastUsed}]
      metadata: {
        version: 1,
        created: new Date().toISOString(),
        lastUpdated: null
      }
    };
    this.load();
  }

  /**
   * Load patterns from disk
   */
  load() {
    try {
      if (fs.existsSync(this.patternsPath)) {
        const data = JSON.parse(fs.readFileSync(this.patternsPath, 'utf-8'));
        this.patterns = data;
      }
    } catch (e) {
      console.error('Failed to load speech patterns:', e);
    }
  }

  /**
   * Save patterns to disk
   */
  save() {
    try {
      const dir = path.dirname(this.patternsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.patterns.metadata.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.patternsPath, JSON.stringify(this.patterns, null, 2));
      return true;
    } catch (e) {
      console.error('Failed to save speech patterns:', e);
      return false;
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Normalize text for matching
   */
  normalize(text) {
    return text.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  }

  /**
   * Add or update a correction
   * @param {string} original - What was heard
   * @param {string} corrected - What the user meant
   * @returns {Object|null} The pattern object or null
   */
  addCorrection(original, corrected) {
    if (!original || !corrected || original === corrected) return null;

    const normalizedOriginal = this.normalize(original);
    const normalizedCorrected = corrected.trim();

    // Check if pattern already exists
    const existingIndex = this.patterns.corrections.findIndex(
      p => this.normalize(p.original) === normalizedOriginal
    );

    if (existingIndex >= 0) {
      // Update existing pattern
      const existing = this.patterns.corrections[existingIndex];
      existing.corrected = normalizedCorrected;
      existing.count = (existing.count || 1) + 1;
      existing.lastUsed = new Date().toISOString();
      this.save();
      return existing;
    }

    // Create new pattern
    const pattern = {
      id: this.generateId(),
      original: original.trim(),
      corrected: normalizedCorrected,
      count: 1,
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    this.patterns.corrections.push(pattern);
    this.save();
    return pattern;
  }

  /**
   * Get all patterns with optional sorting
   * @param {Object} options - { sortBy: 'count'|'recent'|'alphabetical', limit: number }
   */
  getPatterns(options = {}) {
    let patterns = [...this.patterns.corrections];

    // Sort
    if (options.sortBy === 'count') {
      patterns.sort((a, b) => (b.count || 0) - (a.count || 0));
    } else if (options.sortBy === 'recent') {
      patterns.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    } else {
      patterns.sort((a, b) => a.original.localeCompare(b.original));
    }

    // Limit
    if (options.limit) {
      patterns = patterns.slice(0, options.limit);
    }

    return patterns;
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id) {
    return this.patterns.corrections.find(p => p.id === id) || null;
  }

  /**
   * Delete a pattern
   */
  deletePattern(id) {
    const index = this.patterns.corrections.findIndex(p => p.id === id);
    if (index >= 0) {
      this.patterns.corrections.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Update a pattern
   */
  updatePattern(id, updates) {
    const pattern = this.getPattern(id);
    if (!pattern) return null;

    if (updates.original) pattern.original = updates.original.trim();
    if (updates.corrected) pattern.corrected = updates.corrected.trim();
    pattern.lastUsed = new Date().toISOString();

    this.save();
    return pattern;
  }

  /**
   * Apply learned patterns to transcribed text
   * @param {string} text - The text to correct
   * @returns {Object} { corrected: string, appliedPatterns: array }
   */
  applyPatterns(text) {
    if (!text || this.patterns.corrections.length === 0) {
      return { corrected: text, appliedPatterns: [] };
    }

    let correctedText = text;
    const appliedPatterns = [];

    // Sort by original length (longest first) to avoid partial matches
    const sortedPatterns = [...this.patterns.corrections].sort(
      (a, b) => b.original.length - a.original.length
    );

    for (const pattern of sortedPatterns) {
      // Case-insensitive word boundary match
      const regex = new RegExp(`\\b${this.escapeRegex(pattern.original)}\\b`, 'gi');
      if (regex.test(correctedText)) {
        correctedText = correctedText.replace(regex, pattern.corrected);
        appliedPatterns.push({
          id: pattern.id,
          original: pattern.original,
          corrected: pattern.corrected
        });

        // Update usage count
        pattern.count = (pattern.count || 1) + 1;
        pattern.lastUsed = new Date().toISOString();
      }
    }

    if (appliedPatterns.length > 0) {
      this.save();
    }

    return { corrected: correctedText, appliedPatterns };
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Export patterns for backup
   */
  exportPatterns() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      patterns: this.patterns.corrections.map(p => ({
        original: p.original,
        corrected: p.corrected,
        count: p.count
      }))
    };
  }

  /**
   * Import patterns from backup
   * @param {Object} data - Exported patterns data
   * @param {Object} options - { overwrite: boolean }
   */
  importPatterns(data, options = {}) {
    if (!data || !data.patterns || !Array.isArray(data.patterns)) {
      return { success: false, error: 'Invalid import data format' };
    }

    let imported = 0;
    let skipped = 0;
    let merged = 0;

    for (const pattern of data.patterns) {
      if (!pattern.original || !pattern.corrected) {
        skipped++;
        continue;
      }

      const existing = this.patterns.corrections.find(
        p => this.normalize(p.original) === this.normalize(pattern.original)
      );

      if (existing) {
        if (options.overwrite) {
          existing.corrected = pattern.corrected;
          existing.count = (existing.count || 0) + (pattern.count || 0);
          existing.lastUsed = new Date().toISOString();
          merged++;
        } else {
          skipped++;
        }
      } else {
        this.patterns.corrections.push({
          id: this.generateId(),
          original: pattern.original,
          corrected: pattern.corrected,
          count: pattern.count || 1,
          created: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        });
        imported++;
      }
    }

    this.save();
    return {
      success: true,
      imported,
      merged,
      skipped,
      total: this.patterns.corrections.length
    };
  }

  /**
   * Clear all patterns
   */
  clearAll() {
    this.patterns.corrections = [];
    return this.save();
  }

  /**
   * Get statistics about patterns
   */
  getStats() {
    const patterns = this.patterns.corrections;
    return {
      totalPatterns: patterns.length,
      totalCorrections: patterns.reduce((sum, p) => sum + (p.count || 0), 0),
      mostUsed: patterns.length > 0
        ? [...patterns].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 5)
        : [],
      recentlyAdded: patterns.length > 0
        ? [...patterns].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 5)
        : [],
      version: this.patterns.metadata.version,
      created: this.patterns.metadata.created,
      lastUpdated: this.patterns.metadata.lastUpdated
    };
  }
}

// Singleton instance
let instance = null;

function getSpeechPatterns() {
  if (!instance) {
    instance = new SpeechPatterns();
  }
  return instance;
}

module.exports = { SpeechPatterns, getSpeechPatterns };
