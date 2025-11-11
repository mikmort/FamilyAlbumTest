/**
 * Simple in-memory cache for frequently accessed data
 * This helps reduce database load for data that doesn't change often
 */

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @param {number} maxAge - Maximum age in milliseconds (default: 5 minutes)
   * @returns {any|null} Cached value or null if expired/not found
   */
  get(key, maxAge = 5 * 60 * 1000) {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    const now = Date.now();

    if (now - timestamp > maxAge) {
      // Cache expired
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());

    // Automatic cleanup: if cache gets too large, remove oldest entries
    if (this.cache.size > 1000) {
      const sortedEntries = Array.from(this.timestamps.entries())
        .sort((a, b) => a[1] - b[1]);
      
      // Remove oldest 10%
      const toRemove = sortedEntries.slice(0, 100);
      toRemove.forEach(([key]) => {
        this.cache.delete(key);
        this.timestamps.delete(key);
      });
    }
  }

  /**
   * Invalidate cache for a specific key
   * @param {string} key - Cache key
   */
  invalidate(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   * @param {string} pattern - Pattern to match (e.g., 'media:')
   */
  invalidatePattern(pattern) {
    const keysToDelete = Array.from(this.cache.keys())
      .filter(key => key.includes(pattern));
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.timestamps.delete(key);
    });
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
const cache = new SimpleCache();

module.exports = { cache };
