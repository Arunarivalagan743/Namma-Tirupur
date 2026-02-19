const axios = require('axios');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');
const reliabilityTelemetry = require('../ai/reliability.telemetry');

const logger = createLogger('TranslateController');

// Import AI translation cache service (graceful loading)
let translationCacheService = null;
try {
  translationCacheService = require('../ai/translation.cache');
  logger.info('Translation cache service loaded');
} catch (err) {
  logger.warn('Translation cache service not available', { message: err.message });
}

// Google Translate API Key
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const translationEnabled = !!GOOGLE_TRANSLATE_API_KEY;

if (translationEnabled) {
  logger.info('Google Translate API key detected; translation enabled');
} else {
  logger.warn('GOOGLE_TRANSLATE_API_KEY missing; translation returns original text');
}

const CONFIG = {
  maxRetries: 2,
  retryBaseDelayMs: 200,
  translationTimeoutMs: 5000,
  failureTtlMs: 6 * 60 * 60 * 1000,
  maxCallsPerMinute: Number(process.env.TRANSLATION_MAX_CALLS_PER_MINUTE || 120),
  maxQueueSize: Number(process.env.TRANSLATION_MAX_QUEUE_SIZE || 500),
  debug: process.env.TRANSLATION_DEBUG === 'true'
};

class TranslationRateLimiter {
  constructor(maxPerMinute, maxQueueSize) {
    this.maxPerMinute = maxPerMinute;
    this.maxQueueSize = maxQueueSize;
    this.requestTimestamps = [];
    this.queue = [];

    const timer = setInterval(() => this.flushQueue(), 200);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  prune(now = Date.now()) {
    const cutoff = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < cutoff) {
      this.requestTimestamps.shift();
    }
  }

  hasCapacity() {
    this.prune();
    return this.requestTimestamps.length < this.maxPerMinute;
  }

  flushQueue() {
    this.prune();
    while (this.queue.length > 0 && this.requestTimestamps.length < this.maxPerMinute) {
      const item = this.queue.shift();
      this.requestTimestamps.push(Date.now());
      item.resolve({ granted: true, queued: true });
    }
  }

  async acquire() {
    this.prune();

    if (this.requestTimestamps.length < this.maxPerMinute) {
      this.requestTimestamps.push(Date.now());
      return { granted: true, queued: false };
    }

    if (this.queue.length >= this.maxQueueSize) {
      return { granted: false, queued: false, reason: 'queue_overflow' };
    }

    return new Promise((resolve) => {
      this.queue.push({ resolve });
    });
  }
}

const limiter = new TranslationRateLimiter(CONFIG.maxCallsPerMinute, CONFIG.maxQueueSize);
const inFlightTranslations = new Map();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getCacheKey = (text, sourceLanguage, targetLanguage) => {
  if (translationCacheService?.generateCacheKey) {
    return translationCacheService.generateCacheKey(text, sourceLanguage, targetLanguage);
  }

  const normalized = String(text || '').trim();
  return crypto.createHash('sha256')
    .update(`${normalized}|${sourceLanguage}|${targetLanguage}`)
    .digest('hex')
    .substring(0, 32);
};

const extractStatusCode = (error) => error?.response?.status || null;

// Supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' }
];

/**
 * Call Google Translate API with timeout
 */
const translateWithApiKey = async (text, targetLanguage, sourceLanguage = 'en') => {
  const url = `https://translation.googleapis.com/language/translate/v2`;
  
  const response = await axios.post(url, null, {
    params: {
      q: text,
      target: targetLanguage,
      source: sourceLanguage,
      key: GOOGLE_TRANSLATE_API_KEY,
      format: 'text'
    },
    timeout: CONFIG.translationTimeoutMs
  });
  
  return response.data.data.translations[0].translatedText;
};

const translateWithRetry = async (text, targetLanguage, sourceLanguage, metrics) => {
  let attempt = 0;

  while (attempt <= CONFIG.maxRetries) {
    const slot = await limiter.acquire();
    if (!slot.granted) {
      metrics.queueOverflow++;
      const overflowError = new Error('Rate limit queue overflow');
      overflowError.code = 'RATE_LIMIT_OVERFLOW';
      throw overflowError;
    }

    if (slot.queued) {
      metrics.queuedRequests++;
    }

    metrics.apiCalls++;

    try {
      return await translateWithApiKey(text, targetLanguage, sourceLanguage);
    } catch (error) {
      const statusCode = extractStatusCode(error);
      const canRetry = attempt < CONFIG.maxRetries;

      if (statusCode === 403) {
        metrics.aborted403++;
        error.abortRetry = true;
        throw error;
      }

      if (!canRetry) {
        throw error;
      }

      metrics.retries++;
      const backoffMs = CONFIG.retryBaseDelayMs * (2 ** attempt);
      await wait(backoffMs);
      attempt += 1;
    }
  }

  throw new Error('Translation retries exhausted');
};

const getCachedEntry = async (text, sourceLanguage, targetLanguage) => {
  if (!translationCacheService?.getCachedEntry) {
    return null;
  }

  return translationCacheService.getCachedEntry(text, sourceLanguage, targetLanguage);
};

const runTranslationPipeline = async (text, sourceLanguage, targetLanguage, metrics) => {
  const cacheKey = getCacheKey(text, sourceLanguage, targetLanguage);
  const cached = await getCachedEntry(text, sourceLanguage, targetLanguage);

  if (cached) {
    if (cached.failure || cached.untranslated) {
      metrics.failureCacheHits++;
    } else {
      metrics.cacheHits++;
    }

    return {
      original: text,
      translated: cached.translatedText,
      untranslated: !!cached.untranslated,
      cached: true,
      failureCached: !!cached.failure
    };
  }

  if (!translationEnabled) {
    metrics.fallbackCount++;
    return {
      original: text,
      translated: text,
      untranslated: true,
      cached: false,
      failureCached: false,
      note: 'translation_unavailable'
    };
  }

  if (inFlightTranslations.has(cacheKey)) {
    metrics.inFlightDeduped++;
    return inFlightTranslations.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const translated = await translateWithRetry(text, targetLanguage, sourceLanguage, metrics);

      if (translationCacheService?.cacheTranslation) {
        translationCacheService.cacheTranslation(
          text,
          sourceLanguage,
          targetLanguage,
          translated
        ).catch(() => {});
      }

      return {
        original: text,
        translated,
        untranslated: false,
        cached: false,
        failureCached: false
      };
    } catch (error) {
      metrics.errors++;
      const statusCode = extractStatusCode(error);

      if (translationCacheService?.cacheTranslationFailure) {
        translationCacheService.cacheTranslationFailure(
          text,
          sourceLanguage,
          targetLanguage,
          {
            errorCode: statusCode,
            reason: error.code || error.message || 'translation_failed'
          },
          CONFIG.failureTtlMs
        ).catch(() => {});
      }

      return {
        original: text,
        translated: text,
        untranslated: true,
        cached: false,
        failureCached: false,
        note: statusCode === 403 ? 'translation_forbidden' : 'translation_failed'
      };
    } finally {
      inFlightTranslations.delete(cacheKey);
    }
  })();

  inFlightTranslations.set(cacheKey, promise);
  return promise;
};

const createMetrics = (mode, totalItems) => ({
  mode,
  totalItems,
  cacheHits: 0,
  failureCacheHits: 0,
  apiCalls: 0,
  retries: 0,
  errors: 0,
  aborted403: 0,
  inFlightDeduped: 0,
  queuedRequests: 0,
  queueOverflow: 0,
  fallbackCount: 0,
  latencyMs: 0
});

const logSummary = (metrics) => {
  reliabilityTelemetry.recordTranslation(metrics);
  logger.info('Translation request summary', metrics);
  if (CONFIG.debug && metrics.errors > 0) {
    logger.debug('Translation request had recoverable failures', {
      errors: metrics.errors,
      aborted403: metrics.aborted403
    });
  }
};

const translateController = {
  /**
   * GET /api/translate/languages
   */
  getSupportedLanguages: async (req, res) => {
    res.json({
      success: true,
      languages: SUPPORTED_LANGUAGES
    });
  },

  /**
   * POST /api/translate
   * Pipeline: Validate → Cache Check → API Call → Cache Store → Response
   */
  translateText: async (req, res) => {
    const startTime = Date.now();
    const metrics = createMetrics('single', 1);

    try {
      const { text, targetLanguage, sourceLanguage = 'en' } = req.body;

      // Validate input
      if (!text || !targetLanguage) {
        return res.status(400).json({
          success: false,
          message: 'Text and target language are required'
        });
      }

      // Same language - return original
      if (targetLanguage === sourceLanguage) {
        metrics.latencyMs = Date.now() - startTime;
        logSummary(metrics);
        return res.json({
          success: true,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          latencyMs: Date.now() - startTime
        });
      }

      // Translation disabled - return original
      if (!translationEnabled) {
        metrics.fallbackCount++;
        metrics.latencyMs = Date.now() - startTime;
        logSummary(metrics);
        return res.json({
          success: true,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          untranslated: true,
          note: 'Translation service unavailable',
          latencyMs: Date.now() - startTime
        });
      }

      const translation = await runTranslationPipeline(
        text,
        sourceLanguage,
        targetLanguage,
        metrics
      );

      metrics.latencyMs = Date.now() - startTime;
      logSummary(metrics);

      res.json({
        success: true,
        translatedText: translation.translated,
        sourceLanguage,
        targetLanguage,
        cached: translation.cached,
        untranslated: translation.untranslated,
        failureCached: translation.failureCached,
        latencyMs: Date.now() - startTime
      });

    } catch (error) {
      metrics.errors++;
      metrics.latencyMs = Date.now() - startTime;
      logger.error('Translation request failed unexpectedly', error);
      logSummary(metrics);
      // Graceful degradation - return original text
      return res.json({
        success: true,
        translatedText: req.body.text,
        sourceLanguage: req.body.sourceLanguage || 'en',
        targetLanguage: req.body.targetLanguage,
        untranslated: true,
        note: 'Translation failed - returning original text',
        latencyMs: Date.now() - startTime
      });
    }
  },

  /**
   * POST /api/translate/batch
   * Batch translate multiple texts
   */
  batchTranslate: async (req, res) => {
    const startTime = Date.now();

    try {
      const { texts, targetLanguage, sourceLanguage = 'en' } = req.body;
      const metrics = createMetrics('batch', Array.isArray(texts) ? texts.length : 0);

      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Texts array is required'
        });
      }

      if (!targetLanguage) {
        return res.status(400).json({
          success: false,
          message: 'Target language is required'
        });
      }

      // Limit batch size
      if (texts.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 50 texts per batch'
        });
      }

      // Same language - return original
      if (targetLanguage === sourceLanguage) {
        metrics.latencyMs = Date.now() - startTime;
        logSummary(metrics);
        return res.json({
          success: true,
          translations: texts.map(text => ({ original: text, translated: text, untranslated: false })),
          sourceLanguage,
          targetLanguage,
          latencyMs: Date.now() - startTime
        });
      }

      const groups = new Map();
      texts.forEach((text, index) => {
        const normalized = String(text || '').trim();
        if (!groups.has(normalized)) {
          groups.set(normalized, []);
        }
        groups.get(normalized).push(index);
      });

      const uniqueTexts = Array.from(groups.keys());
      const translatedByUnique = await Promise.all(
        uniqueTexts.map((text) => runTranslationPipeline(text, sourceLanguage, targetLanguage, metrics))
      );

      const translations = new Array(texts.length);
      translatedByUnique.forEach((translation, uniqueIndex) => {
        const key = uniqueTexts[uniqueIndex];
        const indexes = groups.get(key) || [];
        indexes.forEach((idx) => {
          translations[idx] = {
            original: texts[idx],
            translated: translation.translated,
            cached: translation.cached,
            untranslated: translation.untranslated,
            failureCached: translation.failureCached
          };
        });
      });

      metrics.latencyMs = Date.now() - startTime;
      logSummary(metrics);

      res.json({
        success: true,
        translations,
        sourceLanguage,
        targetLanguage,
        latencyMs: Date.now() - startTime
      });

    } catch (error) {
      logger.error('Batch translation error', error);
      res.status(500).json({
        success: false,
        message: 'Failed to translate texts'
      });
    }
  },

  /**
   * POST /api/translate/detect
   * Detect language of text (basic implementation)
   */
  detectLanguage: async (req, res) => {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Text is required'
        });
      }

      // Basic detection using character sets
      // Tamil
      if (/[\u0B80-\u0BFF]/.test(text)) {
        return res.json({
          success: true,
          detectedLanguage: 'ta',
          confidence: 0.9
        });
      }

      // Hindi/Devanagari
      if (/[\u0900-\u097F]/.test(text)) {
        return res.json({
          success: true,
          detectedLanguage: 'hi',
          confidence: 0.9
        });
      }

      // Telugu
      if (/[\u0C00-\u0C7F]/.test(text)) {
        return res.json({
          success: true,
          detectedLanguage: 'te',
          confidence: 0.9
        });
      }

      // Kannada
      if (/[\u0C80-\u0CFF]/.test(text)) {
        return res.json({
          success: true,
          detectedLanguage: 'kn',
          confidence: 0.9
        });
      }

      // Malayalam
      if (/[\u0D00-\u0D7F]/.test(text)) {
        return res.json({
          success: true,
          detectedLanguage: 'ml',
          confidence: 0.9
        });
      }

      // Default to English
      return res.json({
        success: true,
        detectedLanguage: 'en',
        confidence: 0.7
      });

    } catch (error) {
      console.error('Language detection error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to detect language'
      });
    }
  },

  /**
   * POST /api/translate/clear-cache
   * Clear translation cache (admin only)
   */
  clearCache: async (req, res) => {
    try {
      if (!translationCacheService) {
        return res.json({
          success: true,
          message: 'Cache service not available'
        });
      }

      const result = await translationCacheService.clearCache();

      res.json({
        success: true,
        message: 'Translation cache cleared',
        result
      });

    } catch (error) {
      logger.error('Clear cache error', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache'
      });
    }
  },

  getReliabilityStats: async (req, res) => {
    try {
      const telemetry = reliabilityTelemetry.getSnapshot();
      const cacheStats = translationCacheService?.getCacheStats
        ? await translationCacheService.getCacheStats()
        : null;

      res.json({
        success: true,
        data: {
          telemetry,
          cache: cacheStats
        }
      });
    } catch (error) {
      logger.error('Reliability stats error', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reliability stats'
      });
    }
  }
};

translateController.__getReliabilitySnapshot = () => reliabilityTelemetry.getSnapshot();
translateController.__resetReliabilitySnapshot = () => reliabilityTelemetry.reset();

module.exports = translateController;
