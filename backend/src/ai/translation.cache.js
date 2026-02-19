/**
 * Translation Cache Service
 *
 * Caches translations to avoid repeated API calls to Google Translate.
 * Uses the unified two-layer cache (L1: LRU, L2: MongoDB).
 *
 * Performance Targets:
 * - Cache hit: <5ms
 * - Cache hit rate: >90%
 * - Cost reduction: >90%
 */

const crypto = require('crypto');
const { translationCache } = require('./cache');
const { createLogger } = require('../utils/logger');

// Get the pre-configured translation cache
const cache = translationCache();
const logger = createLogger('TranslationCache');

const CONFIG = {
  failureTtlMs: 6 * 60 * 60 * 1000,
  debug: process.env.TRANSLATION_DEBUG === 'true'
};

/**
 * Generate a unique cache key for a translation request
 * Uses SHA256 hash to handle any text safely
 */
const generateCacheKey = (text, sourceLang, targetLang) => {
  const normalized = text.trim();
  return crypto.createHash('sha256')
    .update(`${normalized}|${sourceLang}|${targetLang}`)
    .digest('hex')
    .substring(0, 32);  // Shorter keys for efficiency
};

/**
 * Get a cached translation
 * @param {string} text - Source text
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {Promise<string|null>} - Cached translation or null
 */
const normalizeCacheEntry = (cached, originalText) => {
  if (!cached) {
    return null;
  }

  if (typeof cached === 'string') {
    return {
      translatedText: cached,
      untranslated: false,
      failure: false,
      cachedAt: null,
      source: 'legacy'
    };
  }

  if (typeof cached === 'object' && typeof cached.translatedText === 'string') {
    return {
      translatedText: cached.translatedText,
      untranslated: !!cached.untranslated,
      failure: !!cached.failure,
      errorCode: cached.errorCode,
      reason: cached.reason,
      cachedAt: cached.cachedAt || null,
      source: 'structured'
    };
  }

  return {
    translatedText: originalText,
    untranslated: true,
    failure: true,
    reason: 'invalid_cache_payload',
    cachedAt: null,
    source: 'invalid'
  };
};

const getCachedEntry = async (text, sourceLang = 'en', targetLang) => {
  try {
    const key = generateCacheKey(text, sourceLang, targetLang);
    const cached = await cache.get(key);
    return normalizeCacheEntry(cached, text);
  } catch (error) {
    logger.warn('Translation cache get failed', { message: error.message });
    return null;
  }
};

const getCachedTranslation = async (text, sourceLang = 'en', targetLang) => {
  try {
    const entry = await getCachedEntry(text, sourceLang, targetLang);

    if (!entry || entry.failure || entry.untranslated) {
      return null;
    }

    if (CONFIG.debug) {
      logger.debug('Translation cache HIT', { targetLang });
    }

    return entry.translatedText;
  } catch (error) {
    logger.warn('Translation cache get failed', { message: error.message });
    return null;
  }
};

/**
 * Cache a translation
 * @param {string} text - Source text
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {string} translatedText - Translated text
 */
const cacheTranslation = async (text, sourceLang = 'en', targetLang, translatedText, options = {}) => {
  try {
    const key = generateCacheKey(text, sourceLang, targetLang);
    const payload = {
      translatedText,
      untranslated: false,
      failure: false,
      cachedAt: new Date().toISOString()
    };
    await cache.set(key, payload, {
      l1TtlMs: options.ttlMs,
      l2TtlMs: options.ttlMs
    });

    if (CONFIG.debug) {
      logger.debug('Translation cached', { targetLang });
    }
  } catch (error) {
    logger.warn('Translation cache set failed', { message: error.message });
  }
};

const cacheTranslationFailure = async (text, sourceLang = 'en', targetLang, errorMeta = {}, ttlMs = CONFIG.failureTtlMs) => {
  try {
    const key = generateCacheKey(text, sourceLang, targetLang);
    const payload = {
      translatedText: text,
      untranslated: true,
      failure: true,
      errorCode: errorMeta.errorCode || null,
      reason: errorMeta.reason || 'translation_failed',
      cachedAt: new Date().toISOString(),
      retryAfter: new Date(Date.now() + ttlMs).toISOString()
    };

    await cache.set(key, payload, {
      l1TtlMs: ttlMs,
      l2TtlMs: ttlMs
    });

    if (CONFIG.debug) {
      logger.debug('Translation failure cached', {
        targetLang,
        errorCode: payload.errorCode,
        reason: payload.reason
      });
    }
  } catch (error) {
    logger.warn('Translation failure cache set failed', { message: error.message });
  }
};

/**
 * Get or translate with caching
 * Pipeline: Cache Check → API Call (if miss) → Cache Store
 *
 * @param {string} text - Source text
 * @param {string} targetLang - Target language code
 * @param {Function} translateFn - Function to call for actual translation
 * @returns {Promise<string>} - Translated text
 */
const getOrTranslate = async (text, targetLang, translateFn, sourceLang = 'en') => {
  // Same language - return original
  if (targetLang === sourceLang) {
    return text;
  }

  // Check cache first
  const cachedEntry = await getCachedEntry(text, sourceLang, targetLang);
  if (cachedEntry) {
    return cachedEntry.translatedText;
  }

  try {
    const translated = await translateFn(text, targetLang, sourceLang);

    // Cache the result (async, non-blocking)
    cacheTranslation(text, sourceLang, targetLang, translated).catch(() => {});

    return translated;
  } catch (error) {
    cacheTranslationFailure(text, sourceLang, targetLang, {
      reason: error.message
    }).catch(() => {});
    return text;
  }
};

/**
 * Batch cache multiple translations
 * Useful for pre-populating cache with static content
 */
const batchCache = async (translations) => {
  const promises = translations.map(t =>
    cacheTranslation(t.text, t.sourceLang || 'en', t.targetLang, t.translatedText)
  );

  await Promise.allSettled(promises);
  if (CONFIG.debug) {
    logger.debug('Batch translations cached', { count: translations.length });
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = async () => {
  return await cache.getStats();
};

/**
 * Clear translation cache
 * @param {Object} options - Filter options
 */
const clearCache = async (options = {}) => {
  if (Object.keys(options).length === 0) {
    await cache.clear();
    return { cleared: 'all' };
  }
  // For filtered clearing, would need to iterate - simplified for now
  await cache.clear();
  return { cleared: 'all' };
};

module.exports = {
  generateCacheKey,
  getCachedTranslation,
  getCachedEntry,
  cacheTranslation,
  cacheTranslationFailure,
  getOrTranslate,
  batchCache,
  getCacheStats,
  clearCache
};

