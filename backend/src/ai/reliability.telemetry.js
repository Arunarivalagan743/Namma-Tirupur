const { createLogger } = require('../utils/logger');

const logger = createLogger('AIReliability');

const ALERT_THRESHOLDS = {
  errorRate: 0.05,
  cacheHitRate: 0.70,
  latencyMs: 200,
  retryRate: 0.20,
  confidence: 0.60
};

const state = {
  startedAt: new Date().toISOString(),
  translation: {
    totalRequests: 0,
    totalItems: 0,
    latencyMsTotal: 0,
    apiCalls: 0,
    cacheHits: 0,
    failureCacheHits: 0,
    retries: 0,
    errors: 0,
    fallbackCount: 0,
    deduped: 0,
    queueOverflow: 0,
    aborted403: 0
  },
  summarization: {
    totalRequests: 0,
    latencyMsTotal: 0,
    errors: 0,
    cacheHits: 0,
    geminiUsage: 0,
    localUsage: 0,
    lowConfidenceCount: 0,
    confidenceTotal: 0,
    confidenceSamples: 0
  },
  alerts: [],
  lastAlertByMetric: {}
};

const ALERT_COOLDOWN_MS = 60 * 1000;

const safeRate = (num, den) => (den > 0 ? num / den : 0);
const round = (value) => Number(value.toFixed(4));

const pushAlert = (metric, message, value, threshold) => {
  const now = Date.now();
  const lastAt = state.lastAlertByMetric[metric] || 0;

  if (now - lastAt < ALERT_COOLDOWN_MS) {
    return;
  }

  const alert = {
    metric,
    message,
    value,
    threshold,
    level: 'warning',
    timestamp: new Date().toISOString()
  };

  state.alerts.push(alert);
  if (state.alerts.length > 200) {
    state.alerts.shift();
  }

  state.lastAlertByMetric[metric] = now;

  logger.warn(`[Reliability Alert] ${message}`, { metric, value, threshold });
};

const evaluateTranslationAlerts = () => {
  const t = state.translation;
  const requests = t.totalRequests;
  if (requests === 0) {
    return;
  }

  const avgLatency = t.latencyMsTotal / requests;
  const errorRate = safeRate(t.errors, requests);
  const cacheHitRate = safeRate(t.cacheHits + t.failureCacheHits, t.totalItems || requests);
  const retryRate = safeRate(t.retries, t.apiCalls || 1);

  if (avgLatency > ALERT_THRESHOLDS.latencyMs) {
    pushAlert('translation.avgLatencyMs', 'Translation latency threshold exceeded', round(avgLatency), ALERT_THRESHOLDS.latencyMs);
  }

  if (errorRate > ALERT_THRESHOLDS.errorRate) {
    pushAlert('translation.errorRate', 'Translation error rate above threshold', round(errorRate), ALERT_THRESHOLDS.errorRate);
  }

  if (cacheHitRate < ALERT_THRESHOLDS.cacheHitRate && (t.totalItems || requests) >= 20) {
    pushAlert('translation.cacheHitRate', 'Translation cache hit rate below threshold', round(cacheHitRate), ALERT_THRESHOLDS.cacheHitRate);
  }

  if (retryRate > ALERT_THRESHOLDS.retryRate && t.apiCalls >= 20) {
    pushAlert('translation.retryRate', 'Translation retry rate spike detected', round(retryRate), ALERT_THRESHOLDS.retryRate);
  }
};

const evaluateSummarizationAlerts = () => {
  const s = state.summarization;
  const requests = s.totalRequests;
  if (requests === 0) {
    return;
  }

  const avgLatency = s.latencyMsTotal / requests;
  const errorRate = safeRate(s.errors, requests);
  const avgConfidence = s.confidenceSamples > 0
    ? s.confidenceTotal / s.confidenceSamples
    : 1;

  if (avgLatency > ALERT_THRESHOLDS.latencyMs) {
    pushAlert('summarization.avgLatencyMs', 'Summarization latency threshold exceeded', round(avgLatency), ALERT_THRESHOLDS.latencyMs);
  }

  if (errorRate > ALERT_THRESHOLDS.errorRate) {
    pushAlert('summarization.errorRate', 'Summarization error rate above threshold', round(errorRate), ALERT_THRESHOLDS.errorRate);
  }

  if (s.confidenceSamples >= 10 && avgConfidence < ALERT_THRESHOLDS.confidence) {
    pushAlert('summarization.avgConfidence', 'Summary confidence dropped below threshold', round(avgConfidence), ALERT_THRESHOLDS.confidence);
  }
};

const recordTranslation = (metrics = {}) => {
  state.translation.totalRequests += 1;
  state.translation.totalItems += Number(metrics.totalItems || 1);
  state.translation.latencyMsTotal += Number(metrics.latencyMs || 0);
  state.translation.apiCalls += Number(metrics.apiCalls || 0);
  state.translation.cacheHits += Number(metrics.cacheHits || 0);
  state.translation.failureCacheHits += Number(metrics.failureCacheHits || 0);
  state.translation.retries += Number(metrics.retries || 0);
  state.translation.errors += Number(metrics.errors || 0);
  state.translation.fallbackCount += Number(metrics.fallbackCount || 0);
  state.translation.deduped += Number(metrics.inFlightDeduped || 0);
  state.translation.queueOverflow += Number(metrics.queueOverflow || 0);
  state.translation.aborted403 += Number(metrics.aborted403 || 0);

  evaluateTranslationAlerts();
};

const recordSummarization = (metrics = {}) => {
  state.summarization.totalRequests += 1;
  state.summarization.latencyMsTotal += Number(metrics.latencyMs || 0);
  state.summarization.errors += metrics.error ? 1 : 0;
  state.summarization.cacheHits += metrics.fromCache ? 1 : 0;

  if ((metrics.summarySource || 'local').startsWith('gemini')) {
    state.summarization.geminiUsage += 1;
  } else {
    state.summarization.localUsage += 1;
  }

  if (typeof metrics.confidenceScore === 'number') {
    state.summarization.confidenceTotal += metrics.confidenceScore;
    state.summarization.confidenceSamples += 1;
    if (metrics.confidenceScore < ALERT_THRESHOLDS.confidence) {
      state.summarization.lowConfidenceCount += 1;
    }
  }

  evaluateSummarizationAlerts();
};

const getSnapshot = () => {
  const t = state.translation;
  const s = state.summarization;

  const translationRequestBase = t.totalRequests || 1;
  const translationItemBase = t.totalItems || 1;
  const summaryBase = s.totalRequests || 1;

  return {
    startedAt: state.startedAt,
    generatedAt: new Date().toISOString(),
    thresholds: ALERT_THRESHOLDS,
    translation: {
      ...t,
      avgLatencyMs: round(t.latencyMsTotal / translationRequestBase),
      errorRate: round(safeRate(t.errors, translationRequestBase)),
      cacheHitRate: round(safeRate(t.cacheHits + t.failureCacheHits, translationItemBase)),
      retryRate: round(safeRate(t.retries, t.apiCalls || 1)),
      fallbackRate: round(safeRate(t.fallbackCount, translationItemBase))
    },
    summarization: {
      ...s,
      avgLatencyMs: round(s.latencyMsTotal / summaryBase),
      errorRate: round(safeRate(s.errors, summaryBase)),
      cacheHitRate: round(safeRate(s.cacheHits, summaryBase)),
      geminiUsageRate: round(safeRate(s.geminiUsage, summaryBase)),
      avgConfidence: round(s.confidenceSamples > 0 ? s.confidenceTotal / s.confidenceSamples : 0)
    },
    alerts: state.alerts.slice(-50)
  };
};

const reset = () => {
  state.startedAt = new Date().toISOString();
  state.translation = {
    totalRequests: 0,
    totalItems: 0,
    latencyMsTotal: 0,
    apiCalls: 0,
    cacheHits: 0,
    failureCacheHits: 0,
    retries: 0,
    errors: 0,
    fallbackCount: 0,
    deduped: 0,
    queueOverflow: 0,
    aborted403: 0
  };
  state.summarization = {
    totalRequests: 0,
    latencyMsTotal: 0,
    errors: 0,
    cacheHits: 0,
    geminiUsage: 0,
    localUsage: 0,
    lowConfidenceCount: 0,
    confidenceTotal: 0,
    confidenceSamples: 0
  };
  state.alerts = [];
  state.lastAlertByMetric = {};
};

module.exports = {
  ALERT_THRESHOLDS,
  recordTranslation,
  recordSummarization,
  getSnapshot,
  reset
};
