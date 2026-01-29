/**
 * Link Cache - In-memory cache for link previews with TTL
 * Phase 2: Rich Link Previews
 */

class LinkCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.options = {
      ttl: 24 * 60 * 60 * 1000, // 24 hours default
      maxSize: 500, // Maximum cached entries
      ...options
    };
  }

  /**
   * Get cached preview for URL
   * @param {string} url - The URL to look up
   * @returns {Object|null} Cached data or null
   */
  get(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const entry = this.cache.get(normalizedUrl);

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalizedUrl);
      return null;
    }

    return {
      ...entry.data,
      cached: true,
      cachedAt: entry.cachedAt
    };
  }

  /**
   * Store preview in cache
   * @param {string} url - The URL
   * @param {Object} data - The preview data
   */
  set(url, data) {
    const normalizedUrl = this.normalizeUrl(url);

    // Enforce max size
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(normalizedUrl, {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.options.ttl
    });
  }

  /**
   * Check if URL is cached (and not expired)
   * @param {string} url - The URL
   * @returns {boolean}
   */
  has(url) {
    return this.get(url) !== null;
  }

  /**
   * Delete cached entry
   * @param {string} url - The URL
   */
  delete(url) {
    const normalizedUrl = this.normalizeUrl(url);
    this.cache.delete(normalizedUrl);
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let expired = 0;
    let valid = 0;
    const now = Date.now();

    for (const [, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      maxSize: this.options.maxSize,
      ttlMs: this.options.ttl
    };
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [url, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(url);
      }
    }
  }

  /**
   * Evict oldest entries to make room
   */
  evictOldest() {
    // First, try to remove expired entries
    this.cleanup();

    // If still over limit, remove oldest
    if (this.cache.size >= this.options.maxSize) {
      let oldest = null;
      let oldestTime = Infinity;

      for (const [url, entry] of this.cache) {
        if (entry.cachedAt < oldestTime) {
          oldest = url;
          oldestTime = entry.cachedAt;
        }
      }

      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }

  /**
   * Normalize URL for consistent caching
   */
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      // Remove trailing slash, lowercase hostname
      let normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}`;
      if (parsed.port) normalized += `:${parsed.port}`;
      normalized += parsed.pathname.replace(/\/$/, '') || '/';
      if (parsed.search) normalized += parsed.search;
      return normalized;
    } catch {
      return url;
    }
  }
}

// Singleton instance
let instance = null;

function getLinkCache() {
  if (!instance) {
    instance = new LinkCache();
  }
  return instance;
}

module.exports = { LinkCache, getLinkCache };
