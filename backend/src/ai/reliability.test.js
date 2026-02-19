const path = require('path');
const axios = require('axios');
const reliabilityTelemetry = require('./reliability.telemetry');

const ROOT = path.resolve(__dirname, '..', '..');

const nowMs = () => Date.now();

const assert = (condition, message, details = null) => ({
  pass: !!condition,
  message,
  details
});

const mean = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const runController = async (handler, body) => {
  const req = { body, query: {}, params: {} };

  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      }
    };

    Promise.resolve(handler(req, res)).catch((error) => {
      resolve({ statusCode: 500, payload: { success: false, error: error.message } });
    });
  });
};

const loadTranslateController = () => {
  const modulePath = path.join(ROOT, 'src/controllers/translate.controller.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

const installInMemoryTranslationCacheMock = () => {
  const translationCacheModulePath = path.join(ROOT, 'src/ai/translation.cache.js');
  const translationCache = require(translationCacheModulePath);

  const original = {
    getCachedEntry: translationCache.getCachedEntry,
    getCachedTranslation: translationCache.getCachedTranslation,
    cacheTranslation: translationCache.cacheTranslation,
    cacheTranslationFailure: translationCache.cacheTranslationFailure,
    getCacheStats: translationCache.getCacheStats,
    clearCache: translationCache.clearCache
  };

  const store = new Map();
  const stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    failures: 0
  };

  const now = () => Date.now();

  const get = (key) => {
    const entry = store.get(key);
    if (!entry) {
      stats.misses += 1;
      return null;
    }

    if (entry.expiresAt <= now()) {
      store.delete(key);
      stats.misses += 1;
      return null;
    }

    stats.hits += 1;
    return entry.value;
  };

  const set = (key, value, ttlMs = 24 * 60 * 60 * 1000) => {
    store.set(key, {
      value,
      expiresAt: now() + ttlMs
    });
    stats.sets += 1;
  };

  translationCache.getCachedEntry = async (text, sourceLang = 'en', targetLang) => {
    const key = translationCache.generateCacheKey(text, sourceLang, targetLang);
    return get(key);
  };

  translationCache.getCachedTranslation = async (text, sourceLang = 'en', targetLang) => {
    const entry = await translationCache.getCachedEntry(text, sourceLang, targetLang);
    if (!entry || entry.failure || entry.untranslated) {
      return null;
    }
    return entry.translatedText;
  };

  translationCache.cacheTranslation = async (text, sourceLang = 'en', targetLang, translatedText, options = {}) => {
    const key = translationCache.generateCacheKey(text, sourceLang, targetLang);
    set(key, {
      translatedText,
      untranslated: false,
      failure: false,
      cachedAt: new Date().toISOString()
    }, options.ttlMs);
  };

  translationCache.cacheTranslationFailure = async (text, sourceLang = 'en', targetLang, errorMeta = {}, ttlMs = 6 * 60 * 60 * 1000) => {
    const key = translationCache.generateCacheKey(text, sourceLang, targetLang);
    set(key, {
      translatedText: text,
      untranslated: true,
      failure: true,
      errorCode: errorMeta.errorCode || null,
      reason: errorMeta.reason || 'translation_failed',
      cachedAt: new Date().toISOString()
    }, ttlMs);
    stats.failures += 1;
  };

  translationCache.getCacheStats = async () => ({
    inMemory: {
      size: store.size,
      ...stats,
      hitRate: Number(((stats.hits / Math.max(1, stats.hits + stats.misses)) * 100).toFixed(2))
    }
  });

  translationCache.clearCache = async () => {
    store.clear();
    stats.hits = 0;
    stats.misses = 0;
    stats.sets = 0;
    stats.failures = 0;
    return { cleared: 'all' };
  };

  return () => {
    translationCache.getCachedEntry = original.getCachedEntry;
    translationCache.getCachedTranslation = original.getCachedTranslation;
    translationCache.cacheTranslation = original.cacheTranslation;
    translationCache.cacheTranslationFailure = original.cacheTranslationFailure;
    translationCache.getCacheStats = original.getCacheStats;
    translationCache.clearCache = original.clearCache;
  };
};

const buildBatchTexts = (size, uniquePool = 25) => {
  const pool = Array.from({ length: uniquePool }, (_, i) => `Complaint text template ${i}`);
  return Array.from({ length: size }, (_, i) => pool[i % uniquePool]);
};

const chunkArray = (items, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const withAxiosMock = async (mockFactory, fn) => {
  const originalPost = axios.post;
  const tracker = {
    calls: 0,
    records: []
  };

  axios.post = async (url, body, config) => {
    tracker.calls += 1;
    tracker.records.push({
      url,
      q: config?.params?.q,
      target: config?.params?.target,
      source: config?.params?.source
    });

    return mockFactory({ url, body, config, tracker });
  };

  try {
    return await fn(tracker);
  } finally {
    axios.post = originalPost;
  }
};

const scoreSummaryQuality = (summaryText = '') => {
  const text = summaryText.toLowerCase();

  const checks = {
    hasIssue: text.includes('issue:') || text.includes('reported'),
    hasActions: text.includes('actions completed') || text.includes('update'),
    hasCurrentStatus: text.includes('current position') || text.includes('current status'),
    hasNextStep: text.includes('next steps')
  };

  const passed = Object.values(checks).filter(Boolean).length;
  return {
    checks,
    score: Number((passed / 4).toFixed(2))
  };
};

const runTranslationScenarios = async (translateController, options) => {
  const assertions = [];
  const latencySamples = [];

  const translationCache = require('./translation.cache');
  await translationCache.clearCache().catch(() => {});

  const failureScenario = await withAxiosMock(
    async () => {
      const err = new Error('Forbidden');
      err.response = { status: 403 };
      throw err;
    },
    async (tracker) => {
      const first = await runController(translateController.translateText, {
        text: 'Repeated forbidden text',
        sourceLanguage: 'en',
        targetLanguage: 'ta'
      });

      const second = await runController(translateController.translateText, {
        text: 'Repeated forbidden text',
        sourceLanguage: 'en',
        targetLanguage: 'ta'
      });

      return { first, second, apiCalls: tracker.calls };
    }
  );

  assertions.push(assert(
    failureScenario.first.payload.untranslated === true,
    'Fallback returns original text on API failure',
    failureScenario.first.payload
  ));

  assertions.push(assert(
    failureScenario.apiCalls === 1,
    'Failed translation is cached and prevents repeated API calls',
    { apiCalls: failureScenario.apiCalls }
  ));

  const retryScenario = await withAxiosMock(
    async ({ tracker, config }) => {
      if (tracker.calls <= 2) {
        const err = new Error('Timeout');
        err.code = 'ETIMEDOUT';
        err.response = { status: 504 };
        throw err;
      }

      return {
        data: {
          data: {
            translations: [{ translatedText: `[${config.params.target}] ${config.params.q}` }]
          }
        }
      };
    },
    async (tracker) => {
      const result = await runController(translateController.translateText, {
        text: 'Retry test text',
        sourceLanguage: 'en',
        targetLanguage: 'ta'
      });
      return { result, apiCalls: tracker.calls };
    }
  );

  assertions.push(assert(
    retryScenario.result.payload.translatedText !== 'Retry test text',
    'Translation succeeds after retries when transient errors recover',
    retryScenario.result.payload
  ));

  assertions.push(assert(
    retryScenario.apiCalls === 3,
    'Retry policy performs max 2 retries (3 total attempts)',
    { apiCalls: retryScenario.apiCalls }
  ));

  await translationCache.clearCache().catch(() => {});

  const dedupeScenario = await withAxiosMock(
    async ({ config }) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return {
        data: {
          data: {
            translations: [{ translatedText: `[${config.params.target}] ${config.params.q}` }]
          }
        }
      };
    },
    async (tracker) => {
      const tasks = Array.from({ length: options.concurrency }, () => runController(
        translateController.translateText,
        {
          text: 'Concurrent duplicate text',
          sourceLanguage: 'en',
          targetLanguage: 'ta'
        }
      ));
      const results = await Promise.all(tasks);
      return {
        apiCalls: tracker.calls,
        results
      };
    }
  );

  assertions.push(assert(
    dedupeScenario.apiCalls === 1,
    'In-flight deduplication prevents duplicate concurrent API calls',
    { apiCalls: dedupeScenario.apiCalls, concurrency: options.concurrency }
  ));

  await translationCache.clearCache().catch(() => {});

  const batchTexts = buildBatchTexts(options.batchSize, options.uniquePool);
  const batchChunks = chunkArray(batchTexts, 50);
  const coldRun = await withAxiosMock(
    async ({ config }) => ({
      data: {
        data: {
          translations: [{ translatedText: `[${config.params.target}] ${config.params.q}` }]
        }
      }
    }),
    async (tracker) => {
      const t0 = nowMs();
      const runs = [];

      for (const chunk of batchChunks) {
        runs.push(await runController(translateController.batchTranslate, {
          texts: chunk,
          sourceLanguage: 'en',
          targetLanguage: 'ta'
        }));
      }

      return {
        runs,
        apiCalls: tracker.calls,
        latencyMs: nowMs() - t0
      };
    }
  );

  latencySamples.push(coldRun.latencyMs);

  const warmRun = await withAxiosMock(
    async ({ config }) => ({
      data: {
        data: {
          translations: [{ translatedText: `[${config.params.target}] ${config.params.q}` }]
        }
      }
    }),
    async (tracker) => {
      const t0 = nowMs();
      const runs = [];
      for (const chunk of batchChunks) {
        runs.push(await runController(translateController.batchTranslate, {
          texts: chunk,
          sourceLanguage: 'en',
          targetLanguage: 'ta'
        }));
      }

      return {
        runs,
        apiCalls: tracker.calls,
        latencyMs: nowMs() - t0
      };
    }
  );

  latencySamples.push(warmRun.latencyMs);

  assertions.push(assert(
    coldRun.apiCalls === options.uniquePool,
    'Batch grouping translates only unique texts',
    {
      apiCalls: coldRun.apiCalls,
      expected: options.uniquePool,
      chunks: batchChunks.length,
      statuses: coldRun.runs.map(run => run.statusCode)
    }
  ));

  assertions.push(assert(
    warmRun.apiCalls === 0,
    'Warm cache batch avoids external translation calls',
    { apiCalls: warmRun.apiCalls }
  ));

  assertions.push(assert(
    warmRun.latencyMs <= coldRun.latencyMs,
    'Warm cache has lower or equal latency versus cold cache',
    { warmLatencyMs: warmRun.latencyMs, coldLatencyMs: coldRun.latencyMs }
  ));

  return {
    assertions,
    latencySamples,
    details: {
      failureScenario,
      retryScenario,
      dedupeScenario: { apiCalls: dedupeScenario.apiCalls },
      coldRun: { apiCalls: coldRun.apiCalls, latencyMs: coldRun.latencyMs },
      warmRun: { apiCalls: warmRun.apiCalls, latencyMs: warmRun.latencyMs }
    }
  };
};

const runSummarizationScenarios = async () => {
  const summarization = require('./summarization.service');
  const assertions = [];
  const latencySamples = [];

  const dataset = [
    {
      name: 'short',
      complaint: {
        title: 'Drain blockage near temple road',
        category: 'Drainage',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000)
      },
      history: []
    },
    {
      name: 'long-history',
      complaint: {
        title: 'Road potholes after rain',
        category: 'Road & Infrastructure',
        status: 'in_progress',
        priority: 'high',
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000),
        estimatedResolutionDays: 10
      },
      history: [
        { createdAt: new Date(Date.now() - 22 * 24 * 3600 * 1000), status: 'in_progress', remarks: 'Assigned to engineering team' },
        { createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000), status: 'in_progress', remarks: 'Field visit completed and inspection done' },
        { createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000), status: 'in_progress', remarks: 'Work order issued for repair' },
        { createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000), status: 'in_progress', remarks: 'Citizen follow-up completed; pending materials' }
      ]
    },
    {
      name: 'status-updates',
      complaint: {
        title: 'Street light flickering in ward 12',
        category: 'Street Lights',
        status: 'resolved',
        priority: 'urgent',
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
        resolvedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000)
      },
      history: [
        { createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000), status: 'in_progress', remarks: 'Inspection completed and electrician assigned' },
        { createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000), status: 'resolved', remarks: 'Repair completed and citizen informed' }
      ]
    },
    {
      name: 'edge-missing',
      complaint: {
        title: 'Water supply issue',
        category: 'Water Supply',
        status: 'in_progress',
        createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000)
      },
      history: [
        { createdAt: new Date(Date.now() - 12 * 3600 * 1000), status: 'in_progress', remarks: '' }
      ]
    }
  ];

  const qualityScores = [];

  for (const sample of dataset) {
    const t0 = nowMs();
    const timeline = summarization.buildTimeline(sample.complaint, sample.history);
    const actions = summarization.extractKeyActions(sample.history);
    const statusSummary = summarization.generateStatusSummary(sample.complaint, sample.history);

    const pendingSteps = statusSummary.status === 'resolved'
      ? ['Close the complaint after citizen confirmation.']
      : ['Continue active monitoring until closure criteria are met.'];

    const textSummary = summarization.generateTextSummary(
      sample.complaint,
      sample.history,
      timeline,
      actions,
      statusSummary,
      { pendingSteps }
    );

    const quality = scoreSummaryQuality(textSummary);
    qualityScores.push(quality.score);
    const latencyMs = nowMs() - t0;
    latencySamples.push(latencyMs);

    reliabilityTelemetry.recordSummarization({
      latencyMs,
      fromCache: false,
      summarySource: 'local',
      confidenceScore: quality.score,
      error: null
    });

    assertions.push(assert(
      quality.score >= 0.75,
      `Summary quality covers mandatory fields for dataset: ${sample.name}`,
      quality
    ));
  }

  return {
    assertions,
    latencySamples,
    averageQualityScore: Number(mean(qualityScores).toFixed(2)),
    qualityScores
  };
};

const detectRegressions = (baseline, report) => {
  if (!baseline) {
    return [];
  }

  const regressions = [];
  const current = report.metrics;

  if (typeof baseline.translationAvgLatencyMs === 'number' &&
      current.translation.avgLatencyMs > baseline.translationAvgLatencyMs * 1.2) {
    regressions.push({
      metric: 'translation.avgLatencyMs',
      baseline: baseline.translationAvgLatencyMs,
      current: current.translation.avgLatencyMs,
      message: 'Translation latency regressed by >20%'
    });
  }

  if (typeof baseline.summaryAvgQuality === 'number' &&
      current.summarization.averageQualityScore < baseline.summaryAvgQuality - 0.1) {
    regressions.push({
      metric: 'summarization.averageQualityScore',
      baseline: baseline.summaryAvgQuality,
      current: current.summarization.averageQualityScore,
      message: 'Summary quality score dropped by >0.1'
    });
  }

  if (typeof baseline.translationCacheHitRate === 'number' &&
      current.telemetry.translation.cacheHitRate < baseline.translationCacheHitRate - 0.1) {
    regressions.push({
      metric: 'telemetry.translation.cacheHitRate',
      baseline: baseline.translationCacheHitRate,
      current: current.telemetry.translation.cacheHitRate,
      message: 'Translation cache hit rate dropped by >0.1'
    });
  }

  return regressions;
};

const runReliabilitySuite = async (options = {}) => {
  const config = {
    batchSize: Number(options.batchSize || 200),
    uniquePool: Number(options.uniquePool || 40),
    concurrency: Number(options.concurrency || 50),
    dryRun: !!options.dryRun,
    baseline: options.baseline || null
  };

  process.env.GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || 'test-key';
  reliabilityTelemetry.reset();

  const restoreCacheMock = installInMemoryTranslationCacheMock();

  try {
    const translateController = loadTranslateController();
    if (typeof translateController.__resetReliabilitySnapshot === 'function') {
      translateController.__resetReliabilitySnapshot();
    }

    const startedAt = new Date().toISOString();

    let translationResult = { assertions: [], latencySamples: [], details: {} };
    if (!config.dryRun) {
      translationResult = await runTranslationScenarios(translateController, config);
    }

    const summarizationResult = await runSummarizationScenarios();

    const telemetry = reliabilityTelemetry.getSnapshot();
    const allAssertions = [...translationResult.assertions, ...summarizationResult.assertions];
    const passedAssertions = allAssertions.filter(a => a.pass).length;
    const failedAssertions = allAssertions.length - passedAssertions;

    const metrics = {
      translation: {
        avgLatencyMs: Number(mean(translationResult.latencySamples).toFixed(2)),
        p95LatencyMs: Number(percentile(translationResult.latencySamples, 95).toFixed(2)),
        samples: translationResult.latencySamples.length
      },
      summarization: {
        avgLatencyMs: Number(mean(summarizationResult.latencySamples).toFixed(2)),
        p95LatencyMs: Number(percentile(summarizationResult.latencySamples, 95).toFixed(2)),
        averageQualityScore: summarizationResult.averageQualityScore,
        samples: summarizationResult.latencySamples.length
      },
      telemetry
    };

    const regressions = detectRegressions(config.baseline, { metrics });

    const report = {
      suite: 'ai-reliability',
      status: failedAssertions === 0 && regressions.length === 0 ? 'pass' : 'fail',
      startedAt,
      finishedAt: new Date().toISOString(),
      config,
      assertions: {
        total: allAssertions.length,
        passed: passedAssertions,
        failed: failedAssertions,
        details: allAssertions
      },
      translation: translationResult.details,
      summarization: {
        averageQualityScore: summarizationResult.averageQualityScore,
        qualityScores: summarizationResult.qualityScores
      },
      metrics,
      regressions
    };

    return report;
  } finally {
    restoreCacheMock();
  }
};

module.exports = {
  runReliabilitySuite,
  scoreSummaryQuality
};
