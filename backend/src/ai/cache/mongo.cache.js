/**
 * MongoDB Cache Layer
 *
 * Persistent cache using MongoDB with TTL indexes.
 * Used as L2 cache (after in-memory LRU).
 *
 * Features:
 * - Automatic TTL expiration via MongoDB TTL index
 * - Hit tracking for analytics
 * - Batch operations for efficiency
 *
 * Performance Targets:
 * - Read: <10ms
 * - Write: <20ms
 */

const mongoose = require('mongoose');

const ERROR_LOG_COOLDOWN_MS = 60 * 1000;
const errorLogState = new Map();

const logCacheError = (namespace, operation, message) => {
  const key = `${namespace}:${operation}`;
  const now = Date.now();
  const state = errorLogState.get(key) || { lastLoggedAt: 0, suppressed: 0 };

  if (now - state.lastLoggedAt >= ERROR_LOG_COOLDOWN_MS) {
    const suffix = state.suppressed > 0
      ? ` (suppressed ${state.suppressed} similar errors in last ${ERROR_LOG_COOLDOWN_MS / 1000}s)`
      : '';

    console.error(`MongoCache ${operation} error [${namespace}]: ${message}${suffix}`);
    errorLogState.set(key, { lastLoggedAt: now, suppressed: 0 });
    return;
  }

  errorLogState.set(key, {
    lastLoggedAt: state.lastLoggedAt,
    suppressed: state.suppressed + 1
  });
};

// Generic cache schema
const CacheEntrySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  namespace: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  hitCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }  // TTL index
  }
}, {
  collection: 'ai_cache',
  timestamps: false
});

// Compound index for namespace + key lookups
CacheEntrySchema.index({ namespace: 1, _id: 1 });

let CacheEntry;
try {
  CacheEntry = mongoose.model('CacheEntry');
} catch {
  CacheEntry = mongoose.model('CacheEntry', CacheEntrySchema);
}

/**
 * MongoDB Cache class
 */
class MongoCache {
  constructor(namespace, options = {}) {
    this.namespace = namespace;
    this.ttlMs = options.ttlMs || 30 * 24 * 60 * 60 * 1000; // 30 days default
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
  }

  /**
   * Generate cache key with namespace prefix
   */
  _key(key) {
    return `${this.namespace}:${key}`;
  }

  /**
   * Get item from cache
   * @param {string} key
   * @returns {Promise<*>} value or null
   */
  async get(key) {
    try {
      const fullKey = this._key(key);

      const entry = await CacheEntry.findByIdAndUpdate(
        fullKey,
        {
          $inc: { hitCount: 1 },
          $set: { lastAccessedAt: new Date() }
        },
        { new: true }
      ).lean();

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if expired (belt and suspenders with TTL index)
      if (entry.expiresAt < new Date()) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch (error) {
      this.stats.errors++;
      logCacheError(this.namespace, 'get', error.message);
      return null;
    }
  }

  /**
   * Set item in cache
   * @param {string} key
   * @param {*} value
   * @param {Object} options
   */
  async set(key, value, options = {}) {
    try {
      const fullKey = this._key(key);
      const ttl = options.ttlMs || this.ttlMs;

      await CacheEntry.findByIdAndUpdate(
        fullKey,
        {
          $set: {
            _id: fullKey,
            namespace: this.namespace,
            value,
            metadata: options.metadata || {},
            lastAccessedAt: new Date(),
            expiresAt: new Date(Date.now() + ttl)
          },
          $setOnInsert: {
            createdAt: new Date(),
            hitCount: 0
          }
        },
        { upsert: true, new: true }
      );

      this.stats.sets++;
    } catch (error) {
      this.stats.errors++;
      logCacheError(this.namespace, 'set', error.message);
    }
  }

  /**
   * Delete item from cache
   * @param {string} key
   */
  async delete(key) {
    try {
      const fullKey = this._key(key);
      await CacheEntry.findByIdAndDelete(fullKey);
    } catch (error) {
      this.stats.errors++;
      logCacheError(this.namespace, 'delete', error.message);
    }
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    try {
      const fullKey = this._key(key);
      const count = await CacheEntry.countDocuments({
        _id: fullKey,
        expiresAt: { $gt: new Date() }
      });
      return count > 0;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Clear all entries in this namespace
   */
  async clear() {
    try {
      await CacheEntry.deleteMany({ namespace: this.namespace });
    } catch (error) {
      this.stats.errors++;
      logCacheError(this.namespace, 'clear', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const count = await CacheEntry.countDocuments({ namespace: this.namespace });
      const total = this.stats.hits + this.stats.misses;

      return {
        namespace: this.namespace,
        size: count,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
        sets: this.stats.sets,
        errors: this.stats.errors
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Batch get multiple keys
   * @param {string[]} keys
   * @returns {Promise<Object>} key -> value map
   */
  async mget(keys) {
    try {
      const fullKeys = keys.map(k => this._key(k));

      const entries = await CacheEntry.find({
        _id: { $in: fullKeys },
        expiresAt: { $gt: new Date() }
      }).lean();

      const result = {};
      const foundKeys = new Set();

      for (const entry of entries) {
        const originalKey = entry._id.replace(`${this.namespace}:`, '');
        result[originalKey] = entry.value;
        foundKeys.add(entry._id);
        this.stats.hits++;
      }

      // Count misses
      this.stats.misses += keys.length - entries.length;

      return result;
    } catch (error) {
      this.stats.errors++;
      logCacheError(this.namespace, 'mget', error.message);
      return {};
    }
  }

  /**
   * Batch set multiple keys
   * @param {Object} items - key -> value map
   * @param {Object} options
   */
  async mset(items, options = {}) {
    try {
      const ttl = options.ttlMs || this.ttlMs;
      const now = new Date();
      const expiresAt = new Date(Date.now() + ttl);

      const operations = Object.entries(items).map(([key, value]) => ({
        updateOne: {
          filter: { _id: this._key(key) },
          update: {
            $set: {
              namespace: this.namespace,
              value,
              lastAccessedAt: now,
              expiresAt
            },
            $setOnInsert: {
              createdAt: now,
              hitCount: 0
            }
          },
          upsert: true
        }
      }));

      await CacheEntry.bulkWrite(operations);
      this.stats.sets += Object.keys(items).length;
    } catch (error) {
      this.stats.errors++;
      logCacheError(this.namespace, 'mset', error.message);
    }
  }
}

// Factory for creating namespace-specific caches
const cacheInstances = {};

/**
 * Get or create a MongoDB cache instance
 * @param {string} namespace
 * @param {Object} options
 * @returns {MongoCache}
 */
const getInstance = (namespace, options = {}) => {
  if (!cacheInstances[namespace]) {
    cacheInstances[namespace] = new MongoCache(namespace, options);
  }
  return cacheInstances[namespace];
};

/**
 * Get all cache statistics
 */
const getAllStats = async () => {
  const stats = {};
  for (const [name, cache] of Object.entries(cacheInstances)) {
    stats[name] = await cache.getStats();
  }
  return stats;
};

module.exports = {
  MongoCache,
  CacheEntry,
  getInstance,
  getAllStats
};

