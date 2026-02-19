/**
 * AI Admin Controller
 *
 * Admin-only endpoints for managing AI features:
 * - System health and metrics
 * - Translation cache stats and management
 * - Classification accuracy monitoring
 * - Duplicate detection stats
 * - Priority scoring analytics
 *
 * All endpoints are protected by admin middleware.
 */

// Import AI services safely
let aiServices = null;
try {
  aiServices = require('../ai');
} catch (err) {
  console.warn('AI services not available:', err.message);
}

let reliabilityTelemetry = null;
try {
  reliabilityTelemetry = require('../ai/reliability.telemetry');
} catch (err) {
  console.warn('AI reliability telemetry not available:', err.message);
}

/**
 * GET /api/admin/ai/overview
 * Get AI system health and overview
 */
const getAIOverview = async (req, res) => {
  try {
    if (!aiServices) {
      return res.json({
        success: true,
        data: {
          available: false,
          message: 'AI services not loaded'
        }
      });
    }

    const health = await aiServices.getHealthStatus();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('AI overview error:', error);
    res.status(500).json({ error: 'Failed to get AI overview' });
  }
};

/**
 * GET /api/admin/ai/metrics
 * Get AI performance metrics for monitoring
 */
const getAIMetrics = async (req, res) => {
  try {
    if (!aiServices) {
      return res.status(503).json({ error: 'AI services not available' });
    }

    const metrics = await aiServices.getMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('AI metrics error:', error);
    res.status(500).json({ error: 'Failed to get AI metrics' });
  }
};

/**
 * GET /api/admin/ai/translation-cache/stats
 * Get translation cache statistics
 */
const getTranslationCacheStats = async (req, res) => {
  try {
    if (!aiServices?.translationCache) {
      return res.status(503).json({ error: 'Translation cache service not available' });
    }

    const stats = await aiServices.translationCache.getCacheStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Translation cache stats error:', error);
    res.status(500).json({ error: 'Failed to get translation cache stats' });
  }
};

/**
 * DELETE /api/admin/ai/translation-cache
 * Clear translation cache (admin only)
 */
const clearTranslationCache = async (req, res) => {
  try {
    if (!aiServices?.translationCache) {
      return res.status(503).json({ error: 'Translation cache service not available' });
    }

    const result = await aiServices.translationCache.clearCache(req.body);

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      result
    });
  } catch (error) {
    console.error('Clear translation cache error:', error);
    res.status(500).json({ error: 'Failed to clear translation cache' });
  }
};

/**
 * GET /api/admin/ai/duplicates/stats
 * Get duplicate detection statistics
 */
const getDuplicateStats = async (req, res) => {
  try {
    if (!aiServices?.duplicateService) {
      return res.status(503).json({ error: 'Duplicate detection service not available' });
    }

    const stats = await aiServices.duplicateService.getDuplicateStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Duplicate stats error:', error);
    res.status(500).json({ error: 'Failed to get duplicate stats' });
  }
};

/**
 * GET /api/admin/ai/classification/stats
 * Get classification distribution
 */
const getClassificationStats = async (req, res) => {
  try {
    if (!aiServices?.classifierService) {
      return res.status(503).json({ error: 'Classification service not available' });
    }

    // Get recent complaints and analyze
    const { Complaint } = require('../models');
    const recentComplaints = await Complaint.find({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).select('title description category').lean();

    // Reclassify and compare
    const results = await aiServices.classifierService.batchClassify(recentComplaints);

    // Calculate accuracy (comparing AI suggestion vs actual category)
    let correct = 0;
    let total = 0;

    results.forEach((r, i) => {
      if (r.category === recentComplaints[i].category) {
        correct++;
      }
      total++;
    });

    const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : 'N/A';
    const distributionStats = aiServices.classifierService.getClassificationStats(results);

    res.json({
      success: true,
      data: {
        totalAnalyzed: total,
        accuracy: `${accuracy}%`,
        distribution: distributionStats,
        categories: aiServices.classifierService.CATEGORIES
      }
    });
  } catch (error) {
    console.error('Classification stats error:', error);
    res.status(500).json({ error: 'Failed to get classification stats' });
  }
};

/**
 * GET /api/admin/ai/priority/analytics
 * Get priority scoring analytics
 */
const getPriorityAnalytics = async (req, res) => {
  try {
    if (!aiServices?.priorityService) {
      return res.status(503).json({ error: 'Priority service not available' });
    }

    const { Complaint } = require('../models');

    // Get complaints from last 30 days
    const recentComplaints = await Complaint.find({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).select('title description category priority').lean();

    // Score all complaints
    const scores = aiServices.priorityService.batchScorePriority(recentComplaints);
    const stats = aiServices.priorityService.getPriorityStats(scores);

    // Compare AI scores with actual priorities
    let matches = 0;
    scores.forEach((s, i) => {
      if (s.priority === recentComplaints[i].priority) {
        matches++;
      }
    });

    const matchRate = scores.length > 0
      ? (matches / scores.length * 100).toFixed(1)
      : 'N/A';

    res.json({
      success: true,
      data: {
        totalAnalyzed: scores.length,
        aiMatchRate: `${matchRate}%`,
        distribution: stats,
        priorityLevels: Object.keys(aiServices.priorityService.PRIORITY_WEIGHTS)
      }
    });
  } catch (error) {
    console.error('Priority analytics error:', error);
    res.status(500).json({ error: 'Failed to get priority analytics' });
  }
};

/**
 * POST /api/admin/ai/test/classification
 * Test AI classification on sample text
 */
const testClassification = async (req, res) => {
  try {
    if (!aiServices?.classifierService) {
      return res.status(503).json({ error: 'Classification service not available' });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const startTime = Date.now();
    const result = await aiServices.classifierService.classify(text);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        input: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        latencyMs,
        ...result
      }
    });
  } catch (error) {
    console.error('Test classification error:', error);
    res.status(500).json({ error: 'Failed to test classification' });
  }
};

/**
 * POST /api/admin/ai/test/priority
 * Test priority scoring on sample text
 */
const testPriorityScoring = async (req, res) => {
  try {
    if (!aiServices?.priorityService) {
      return res.status(503).json({ error: 'Priority service not available' });
    }

    const { title, description, category } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description is required' });
    }

    const startTime = Date.now();
    const result = aiServices.priorityService.scorePriority(title, description, category);
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        latencyMs,
        ...result
      }
    });
  } catch (error) {
    console.error('Test priority scoring error:', error);
    res.status(500).json({ error: 'Failed to test priority scoring' });
  }
};

/**
 * POST /api/admin/ai/test/duplicates
 * Test duplicate detection
 */
const testDuplicateDetection = async (req, res) => {
  try {
    if (!aiServices?.duplicateService) {
      return res.status(503).json({ error: 'Duplicate detection service not available' });
    }

    const { text, category } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const startTime = Date.now();
    const results = await aiServices.duplicateService.findSimilar(text, req.user?.id, {
      category,
      maxResults: 5
    });
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        latencyMs,
        similarCount: results.length,
        similar: results
      }
    });
  } catch (error) {
    console.error('Test duplicate detection error:', error);
    res.status(500).json({ error: 'Failed to test duplicate detection' });
  }
};

// ============================================================
// PHASE 2 ENDPOINTS
// ============================================================

/**
 * GET /api/admin/ai/search
 * Semantic search across content
 */
const semanticSearch = async (req, res) => {
  try {
    if (!aiServices?.searchService) {
      return res.status(503).json({ error: 'Search service not available' });
    }

    const { q, types, limit } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query (q) is required' });
    }

    const results = await aiServices.searchService.search(q, {
      types: types ? types.split(',') : undefined,
      maxResults: parseInt(limit) || 10
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * POST /api/admin/ai/search/reindex
 * Rebuild search index
 */
const rebuildSearchIndex = async (req, res) => {
  try {
    if (!aiServices?.searchService) {
      return res.status(503).json({ error: 'Search service not available' });
    }

    const result = await aiServices.searchService.refreshIndex();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Search index rebuild error:', error);
    res.status(500).json({ error: 'Failed to rebuild index' });
  }
};

/**
 * GET /api/admin/ai/search/stats
 * Get search index statistics
 */
const getSearchStats = async (req, res) => {
  try {
    if (!aiServices?.searchService) {
      return res.status(503).json({ error: 'Search service not available' });
    }

    const stats = aiServices.searchService.getIndexStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Search stats error:', error);
    res.status(500).json({ error: 'Failed to get search stats' });
  }
};

/**
 * POST /api/admin/ai/templates/suggest
 * Get response template suggestions for a complaint
 */
const getTemplateSuggestions = async (req, res) => {
  try {
    if (!aiServices?.templatesService) {
      return res.status(503).json({ error: 'Templates service not available' });
    }

    const { complaint, newStatus } = req.body;

    if (!complaint || !newStatus) {
      return res.status(400).json({ error: 'Complaint and newStatus are required' });
    }

    const suggestions = aiServices.templatesService.getSuggestions(complaint, newStatus);

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });
  } catch (error) {
    console.error('Template suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
};

/**
 * GET /api/admin/ai/templates/stats
 * Get template statistics
 */
const getTemplateStats = async (req, res) => {
  try {
    if (!aiServices?.templatesService) {
      return res.status(503).json({ error: 'Templates service not available' });
    }

    const stats = aiServices.templatesService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Template stats error:', error);
    res.status(500).json({ error: 'Failed to get template stats' });
  }
};

/**
 * GET /api/admin/ai/templates/:category
 * Get templates for a specific category
 */
const getTemplatesForCategory = async (req, res) => {
  try {
    if (!aiServices?.templatesService) {
      return res.status(503).json({ error: 'Templates service not available' });
    }

    const { category } = req.params;
    const templates = aiServices.templatesService.getTemplatesForCategory(category);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
};

/**
 * GET /api/admin/ai/trends
 * Get complaint trend analysis
 */
const getTrendAnalysis = async (req, res) => {
  try {
    if (!aiServices?.trendsService) {
      return res.status(503).json({ error: 'Trends service not available' });
    }

    const analysis = await aiServices.trendsService.analyzeTrends();

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Trend analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze trends' });
  }
};

/**
 * GET /api/admin/ai/trends/quick
 * Get quick trend stats for dashboard
 */
const getQuickTrendStats = async (req, res) => {
  try {
    if (!aiServices?.trendsService) {
      return res.status(503).json({ error: 'Trends service not available' });
    }

    const stats = await aiServices.trendsService.getQuickStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Quick trend stats error:', error);
    res.status(500).json({ error: 'Failed to get quick stats' });
  }
};

/**
 * POST /api/admin/ai/verify-user
 * Calculate verification score for a user
 */
const verifyUser = async (req, res) => {
  try {
    if (!aiServices?.verificationService) {
      return res.status(503).json({ error: 'Verification service not available' });
    }

    const { userData, checkDuplicates } = req.body;

    if (!userData) {
      return res.status(400).json({ error: 'User data is required' });
    }

    let existingUsers = [];
    if (checkDuplicates) {
      const { User } = require('../models');
      existingUsers = await User.find({ status: { $ne: 'rejected' } })
        .select('email phone name')
        .lean();
    }

    const result = await aiServices.verificationService.calculateScore(userData, existingUsers);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('User verification error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
};

/**
 * POST /api/admin/ai/verify-user/quick
 * Quick validation without duplicate check
 */
const quickVerifyUser = async (req, res) => {
  try {
    if (!aiServices?.verificationService) {
      return res.status(503).json({ error: 'Verification service not available' });
    }

    const { userData } = req.body;

    if (!userData) {
      return res.status(400).json({ error: 'User data is required' });
    }

    const result = aiServices.verificationService.quickValidate(userData);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Quick verification error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
};

// ============================================================
// PHASE 3 ENDPOINTS - Engineering Maturity
// ============================================================

// Import Phase 3 modules
let metricsModule = null;
let queueModule = null;
let batchModule = null;
let cleanupModule = null;
let versioningModule = null;
let warmupModule = null;
let translationBundle = null;

try { metricsModule = require('../ai/workers/metrics'); } catch (e) { console.warn('Metrics module not loaded'); }
try { queueModule = require('../ai/workers/queue'); } catch (e) { console.warn('Queue module not loaded'); }
try { batchModule = require('../ai/workers/batch'); } catch (e) { console.warn('Batch module not loaded'); }
try { cleanupModule = require('../ai/workers/cleanup'); } catch (e) { console.warn('Cleanup module not loaded'); }
try { versioningModule = require('../ai/workers/versioning'); } catch (e) { console.warn('Versioning module not loaded'); }
try { warmupModule = require('../ai/workers/warmup'); } catch (e) { console.warn('Warmup module not loaded'); }
try { translationBundle = require('../ai/workers/translations.bundle'); } catch (e) { console.warn('Translation bundle not loaded'); }

/**
 * GET /api/admin/system/health
 * System health check with all checks
 */
const getSystemHealth = async (req, res) => {
  try {
    const health = metricsModule ? metricsModule.getHealth() : { status: 'unknown' };

    // Add warmup status
    if (warmupModule) {
      health.warmup = warmupModule.getWarmupStatus();
    }

    // Add basic memory info
    const mem = process.memoryUsage();
    health.memory = {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024)
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ error: 'Failed to get system health' });
  }
};

/**
 * GET /api/admin/system/metrics
 * Full system metrics
 */
const getSystemMetrics = async (req, res) => {
  try {
    const metrics = metricsModule ? metricsModule.getMetrics() : {};

    // Add queue status if available
    if (queueModule) {
      metrics.queues = queueModule.getAllQueuesStatus();
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('System metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
};

/**
 * GET /api/admin/system/alerts
 * Current system alerts
 */
const getSystemAlerts = async (req, res) => {
  try {
    const alerts = metricsModule ? metricsModule.getAlerts() : { count: 0, alerts: [] };

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('System alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
};

/**
 * GET /api/admin/system/queues
 * Queue status for all queues
 */
const getQueueStatus = async (req, res) => {
  try {
    if (!queueModule) {
      return res.status(503).json({ error: 'Queue system not available' });
    }

    const status = queueModule.getAllQueuesStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
};

/**
 * GET /api/admin/system/queues/:name/dead-letter
 * Get dead letter jobs for a queue
 */
const getDeadLetterJobs = async (req, res) => {
  try {
    if (!queueModule) {
      return res.status(503).json({ error: 'Queue system not available' });
    }

    const { name } = req.params;
    const queue = queueModule.getQueue(name);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const jobs = queue.getDeadLetterJobs();

    res.json({
      success: true,
      data: {
        queue: name,
        count: jobs.length,
        jobs
      }
    });
  } catch (error) {
    console.error('Dead letter jobs error:', error);
    res.status(500).json({ error: 'Failed to get dead letter jobs' });
  }
};

/**
 * POST /api/admin/system/queues/:name/dead-letter/:jobId/retry
 * Retry a dead letter job
 */
const retryDeadLetterJob = async (req, res) => {
  try {
    if (!queueModule) {
      return res.status(503).json({ error: 'Queue system not available' });
    }

    const { name, jobId } = req.params;
    const queue = queueModule.getQueue(name);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const success = queue.retryDeadLetter(jobId);

    res.json({
      success,
      message: success ? 'Job re-queued for retry' : 'Job not found in dead letter queue'
    });
  } catch (error) {
    console.error('Retry dead letter error:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
};

/**
 * GET /api/admin/system/batch
 * Batch processing status
 */
const getBatchStatus = async (req, res) => {
  try {
    if (!batchModule) {
      return res.status(503).json({ error: 'Batch system not available' });
    }

    const status = batchModule.getBatchStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Batch status error:', error);
    res.status(500).json({ error: 'Failed to get batch status' });
  }
};

/**
 * POST /api/admin/system/batch/daily
 * Trigger daily batch manually
 */
const triggerDailyBatch = async (req, res) => {
  try {
    if (!batchModule) {
      return res.status(503).json({ error: 'Batch system not available' });
    }

    const result = await batchModule.runDailyBatch();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Daily batch trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger daily batch' });
  }
};

/**
 * POST /api/admin/system/batch/weekly
 * Trigger weekly batch manually
 */
const triggerWeeklyBatch = async (req, res) => {
  try {
    if (!batchModule) {
      return res.status(503).json({ error: 'Batch system not available' });
    }

    const result = await batchModule.runWeeklyBatch();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Weekly batch trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger weekly batch' });
  }
};

/**
 * POST /api/admin/system/batch/pause
 * Pause batch processing
 */
const pauseBatch = async (req, res) => {
  try {
    if (!batchModule) {
      return res.status(503).json({ error: 'Batch system not available' });
    }

    const result = batchModule.pauseBatch();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Pause batch error:', error);
    res.status(500).json({ error: 'Failed to pause batch' });
  }
};

/**
 * POST /api/admin/system/batch/resume
 * Resume batch processing
 */
const resumeBatch = async (req, res) => {
  try {
    if (!batchModule) {
      return res.status(503).json({ error: 'Batch system not available' });
    }

    const result = batchModule.resumeBatch();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Resume batch error:', error);
    res.status(500).json({ error: 'Failed to resume batch' });
  }
};

/**
 * GET /api/admin/system/cleanup
 * Cleanup statistics and status
 */
const getCleanupStatus = async (req, res) => {
  try {
    if (!cleanupModule) {
      return res.status(503).json({ error: 'Cleanup system not available' });
    }

    const stats = cleanupModule.getCleanupStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Cleanup status error:', error);
    res.status(500).json({ error: 'Failed to get cleanup status' });
  }
};

/**
 * POST /api/admin/system/cleanup/run
 * Trigger full cleanup manually
 */
const triggerCleanup = async (req, res) => {
  try {
    if (!cleanupModule) {
      return res.status(503).json({ error: 'Cleanup system not available' });
    }

    const result = await cleanupModule.runFullCleanup();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Trigger cleanup error:', error);
    res.status(500).json({ error: 'Failed to trigger cleanup' });
  }
};

/**
 * GET /api/admin/system/cleanup/data-size
 * Get database size estimates
 */
const getDataSize = async (req, res) => {
  try {
    if (!cleanupModule) {
      return res.status(503).json({ error: 'Cleanup system not available' });
    }

    const sizes = await cleanupModule.getDataSizeEstimates();

    res.json({
      success: true,
      data: sizes
    });
  } catch (error) {
    console.error('Data size error:', error);
    res.status(500).json({ error: 'Failed to get data size' });
  }
};

/**
 * GET /api/admin/system/versions
 * Get system version information
 */
const getVersions = async (req, res) => {
  try {
    if (!versioningModule) {
      return res.status(503).json({ error: 'Versioning system not available' });
    }

    const versions = versioningModule.getVersions();
    const history = versioningModule.getVersionHistory();

    res.json({
      success: true,
      data: {
        current: versions,
        history
      }
    });
  } catch (error) {
    console.error('Versions error:', error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
};

/**
 * GET /api/admin/system/versions/manifest
 * Export version manifest
 */
const getVersionManifest = async (req, res) => {
  try {
    if (!versioningModule) {
      return res.status(503).json({ error: 'Versioning system not available' });
    }

    const manifest = versioningModule.exportManifest();

    res.json({
      success: true,
      data: manifest
    });
  } catch (error) {
    console.error('Version manifest error:', error);
    res.status(500).json({ error: 'Failed to get version manifest' });
  }
};

/**
 * GET /api/admin/system/warmup
 * Get warmup status
 */
const getWarmupStatus = async (req, res) => {
  try {
    if (!warmupModule) {
      return res.status(503).json({ error: 'Warmup system not available' });
    }

    const status = warmupModule.getWarmupStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Warmup status error:', error);
    res.status(500).json({ error: 'Failed to get warmup status' });
  }
};

/**
 * POST /api/admin/system/warmup/run
 * Trigger warmup manually
 */
const triggerWarmup = async (req, res) => {
  try {
    if (!warmupModule) {
      return res.status(503).json({ error: 'Warmup system not available' });
    }

    const result = await warmupModule.runWarmup();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Warmup trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger warmup' });
  }
};

/**
 * GET /api/admin/system/translations/:lang
 * Get offline translation bundle for a language
 */
const getTranslationBundle = async (req, res) => {
  try {
    if (!translationBundle) {
      return res.status(503).json({ error: 'Translation bundles not available' });
    }

    const { lang } = req.params;
    const bundle = translationBundle.getBundle(lang);

    res.json({
      success: true,
      data: bundle
    });
  } catch (error) {
    console.error('Translation bundle error:', error);
    res.status(500).json({ error: 'Failed to get translation bundle' });
  }
};

/**
 * GET /api/admin/system/translations/stats
 * Get translation bundle statistics
 */
const getTranslationBundleStats = async (req, res) => {
  try {
    if (!translationBundle) {
      return res.status(503).json({ error: 'Translation bundles not available' });
    }

    const stats = translationBundle.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Translation bundle stats error:', error);
    res.status(500).json({ error: 'Failed to get bundle stats' });
  }
};

// ============ PHASE 4: ADVANCED AI FEATURES ============

/**
 * POST /api/admin/ai/enrich
 * Test context enrichment on a complaint
 */
const testEnrichment = async (req, res) => {
  try {
    if (!aiServices?.enrichmentService) {
      return res.status(503).json({ error: 'Enrichment service not available' });
    }

    const { title, description, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const result = await aiServices.enrichmentService.enrichComplaint({
      title,
      description,
      category
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Enrichment test error:', error);
    res.status(500).json({ error: 'Failed to test enrichment' });
  }
};

/**
 * GET /api/admin/ai/enrichment/stats
 * Get enrichment service statistics
 */
const getEnrichmentStats = async (req, res) => {
  try {
    if (!aiServices?.enrichmentService) {
      return res.status(503).json({ error: 'Enrichment service not available' });
    }

    const stats = await aiServices.enrichmentService.getEnrichmentStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Enrichment stats error:', error);
    res.status(500).json({ error: 'Failed to get enrichment stats' });
  }
};

/**
 * POST /api/admin/ai/semantic-duplicates
 * Test semantic duplicate detection
 */
const testSemanticDuplicates = async (req, res) => {
  try {
    if (!aiServices?.semanticDuplicateService) {
      return res.status(503).json({ error: 'Semantic duplicate service not available' });
    }

    const { text, userId, category, threshold } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await aiServices.semanticDuplicateService.findSemanticDuplicates(
      text,
      userId || null,
      { category, threshold }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Semantic duplicate test error:', error);
    res.status(500).json({ error: 'Failed to test semantic duplicates' });
  }
};

/**
 * GET /api/admin/ai/semantic-duplicates/stats
 * Get semantic duplicate detection statistics
 */
const getSemanticDuplicateStats = async (req, res) => {
  try {
    if (!aiServices?.semanticDuplicateService) {
      return res.status(503).json({ error: 'Semantic duplicate service not available' });
    }

    const stats = await aiServices.semanticDuplicateService.getSemanticDuplicateStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Semantic duplicate stats error:', error);
    res.status(500).json({ error: 'Failed to get semantic duplicate stats' });
  }
};

/**
 * PUT /api/admin/ai/semantic-duplicates/threshold
 * Update duplicate detection threshold
 */
const updateDuplicateThreshold = async (req, res) => {
  try {
    if (!aiServices?.semanticDuplicateService) {
      return res.status(503).json({ error: 'Semantic duplicate service not available' });
    }

    const { band, value } = req.body;

    if (!band || value === undefined) {
      return res.status(400).json({ error: 'Band and value are required' });
    }

    const result = aiServices.semanticDuplicateService.updateThreshold(band, value);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Update threshold error:', error);
    res.status(500).json({ error: 'Failed to update threshold' });
  }
};

/**
 * POST /api/admin/ai/semantic-duplicates/override
 * Mark detected duplicates as non-duplicates (admin override)
 */
const overrideDuplicate = async (req, res) => {
  try {
    if (!aiServices?.semanticDuplicateService) {
      return res.status(503).json({ error: 'Semantic duplicate service not available' });
    }

    const { complaintId1, complaintId2 } = req.body;

    if (!complaintId1 || !complaintId2) {
      return res.status(400).json({ error: 'Both complaint IDs are required' });
    }

    const result = await aiServices.semanticDuplicateService.markNotDuplicate(
      complaintId1,
      complaintId2,
      req.user.id
    );

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Override duplicate error:', error);
    res.status(500).json({ error: 'Failed to override duplicate' });
  }
};

/**
 * GET /api/admin/ai/summarize/:complaintId
 * Get automated summary for a complaint
 */
const getSummarization = async (req, res) => {
  try {
    if (!aiServices?.summarizationService) {
      return res.status(503).json({ error: 'Summarization service not available' });
    }

    const { complaintId } = req.params;
    const { forceRegenerate } = req.query;

    const result = await aiServices.summarizationService.summarizeComplaint(
      complaintId,
      { forceRegenerate: forceRegenerate === 'true' }
    );

    if (result.error) {
      return res.status(404).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
};

/**
 * POST /api/admin/ai/summarize/batch
 * Get summaries for multiple complaints
 */
const batchSummarize = async (req, res) => {
  try {
    if (!aiServices?.summarizationService) {
      return res.status(503).json({ error: 'Summarization service not available' });
    }

    const { complaintIds } = req.body;

    if (!complaintIds || !Array.isArray(complaintIds)) {
      return res.status(400).json({ error: 'complaintIds array is required' });
    }

    if (complaintIds.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 complaints per batch' });
    }

    const result = await aiServices.summarizationService.summarizeMultiple(complaintIds);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Batch summarization error:', error);
    res.status(500).json({ error: 'Failed to batch summarize' });
  }
};

/**
 * DELETE /api/admin/ai/summarize/:complaintId
 * Invalidate cached summary for a complaint
 */
const invalidateSummary = async (req, res) => {
  try {
    if (!aiServices?.summarizationService) {
      return res.status(503).json({ error: 'Summarization service not available' });
    }

    const { complaintId } = req.params;

    const result = await aiServices.summarizationService.invalidateSummary(complaintId);

    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Invalidate summary error:', error);
    res.status(500).json({ error: 'Failed to invalidate summary' });
  }
};

/**
 * GET /api/admin/ai/summarization/stats
 * Get summarization service statistics
 */
const getSummarizationStats = async (req, res) => {
  try {
    if (!aiServices?.summarizationService) {
      return res.status(503).json({ error: 'Summarization service not available' });
    }

    const stats = await aiServices.summarizationService.getSummarizationStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Summarization stats error:', error);
    res.status(500).json({ error: 'Failed to get summarization stats' });
  }
};

/**
 * GET /api/admin/ai/phase4/overview
 * Get Phase 4 services overview
 */
const getPhase4Overview = async (req, res) => {
  try {
    const overview = {
      enrichment: {
        available: !!aiServices?.enrichmentService,
        stats: null
      },
      semanticDuplicate: {
        available: !!aiServices?.semanticDuplicateService,
        stats: null
      },
      summarization: {
        available: !!aiServices?.summarizationService,
        stats: null
      }
    };

    // Fetch stats if services available
    if (aiServices?.enrichmentService) {
      try {
        overview.enrichment.stats = await aiServices.enrichmentService.getEnrichmentStats();
      } catch (e) { overview.enrichment.error = e.message; }
    }

    if (aiServices?.semanticDuplicateService) {
      try {
        overview.semanticDuplicate.stats = await aiServices.semanticDuplicateService.getSemanticDuplicateStats();
      } catch (e) { overview.semanticDuplicate.error = e.message; }
    }

    if (aiServices?.summarizationService) {
      try {
        overview.summarization.stats = await aiServices.summarizationService.getSummarizationStats();
      } catch (e) { overview.summarization.error = e.message; }
    }

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Phase 4 overview error:', error);
    res.status(500).json({ error: 'Failed to get Phase 4 overview' });
  }
};

// ============ PHASE 5: VALIDATION & MONITORING ============

/**
 * GET /api/admin/ai/quality/dashboard
 * Get full AI quality dashboard
 */
const getQualityDashboard = async (req, res) => {
  try {
    if (!aiServices?.dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }

    const dashboard = await aiServices.dashboardService.getFullDashboard();

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Quality dashboard error:', error);
    res.status(500).json({ error: 'Failed to get quality dashboard' });
  }
};

/**
 * GET /api/admin/ai/quality/health
 * Get quick health status
 */
const getQualityHealth = async (req, res) => {
  try {
    if (!aiServices?.dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }

    const health = await aiServices.dashboardService.getQuickHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Quality health error:', error);
    res.status(500).json({ error: 'Failed to get quality health' });
  }
};

/**
 * GET /api/admin/ai/quality/trends
 * Get accuracy trends
 */
const getAccuracyTrends = async (req, res) => {
  try {
    if (!aiServices?.dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }

    const trends = await aiServices.dashboardService.getAccuracyTrends();

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Accuracy trends error:', error);
    res.status(500).json({ error: 'Failed to get accuracy trends' });
  }
};

/**
 * GET /api/admin/ai/quality/errors
 * Get error analysis
 */
const getErrorAnalysis = async (req, res) => {
  try {
    if (!aiServices?.dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }

    const analysis = await aiServices.dashboardService.getErrorAnalysis();

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error analysis error:', error);
    res.status(500).json({ error: 'Failed to get error analysis' });
  }
};

/**
 * GET /api/admin/ai/quality/report
 * Generate health report
 */
const generateQualityReport = async (req, res) => {
  try {
    if (!aiServices?.dashboardService) {
      return res.status(503).json({ error: 'Dashboard service not available' });
    }

    const report = await aiServices.dashboardService.generateHealthReport();

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Quality report error:', error);
    res.status(500).json({ error: 'Failed to generate quality report' });
  }
};

/**
 * POST /api/admin/ai/feedback
 * Submit feedback for an AI prediction
 */
const submitFeedback = async (req, res) => {
  try {
    if (!aiServices?.feedbackService) {
      return res.status(503).json({ error: 'Feedback service not available' });
    }

    const result = await aiServices.feedbackService.submitFeedback({
      ...req.body,
      userId: req.user?.id,
      userRole: 'admin'
    });

    res.json(result);
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

/**
 * GET /api/admin/ai/feedback/summary
 * Get feedback summary
 */
const getFeedbackSummary = async (req, res) => {
  try {
    if (!aiServices?.feedbackService) {
      return res.status(503).json({ error: 'Feedback service not available' });
    }

    const summary = await aiServices.feedbackService.getFeedbackSummary();

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Feedback summary error:', error);
    res.status(500).json({ error: 'Failed to get feedback summary' });
  }
};

/**
 * GET /api/admin/ai/feedback/recent
 * Get recent feedback
 */
const getRecentFeedback = async (req, res) => {
  try {
    if (!aiServices?.feedbackService) {
      return res.status(503).json({ error: 'Feedback service not available' });
    }

    const { targetType, helpful, limit } = req.query;
    const feedback = await aiServices.feedbackService.getRecentFeedback({
      targetType,
      helpful: helpful === 'true' ? true : helpful === 'false' ? false : undefined,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Recent feedback error:', error);
    res.status(500).json({ error: 'Failed to get recent feedback' });
  }
};

/**
 * GET /api/admin/ai/evaluation/summary
 * Get evaluation metrics summary
 */
const getEvaluationSummary = async (req, res) => {
  try {
    if (!aiServices?.evaluationService) {
      return res.status(503).json({ error: 'Evaluation service not available' });
    }

    const summary = await aiServices.evaluationService.getQualitySummary();

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Evaluation summary error:', error);
    res.status(500).json({ error: 'Failed to get evaluation summary' });
  }
};

/**
 * GET /api/admin/ai/evaluation/errors/:service
 * Get error queue for a service
 */
const getEvaluationErrors = async (req, res) => {
  try {
    if (!aiServices?.evaluationService) {
      return res.status(503).json({ error: 'Evaluation service not available' });
    }

    const { service } = req.params;
    const { errorType, limit } = req.query;

    const errors = await aiServices.evaluationService.getErrorQueue(
      service,
      errorType || 'all',
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: errors
    });
  } catch (error) {
    console.error('Evaluation errors error:', error);
    res.status(500).json({ error: 'Failed to get evaluation errors' });
  }
};

/**
 * POST /api/admin/ai/evaluation/run
 * Run daily evaluation
 */
const runEvaluation = async (req, res) => {
  try {
    if (!aiServices?.evaluationService) {
      return res.status(503).json({ error: 'Evaluation service not available' });
    }

    const results = await aiServices.evaluationService.runDailyEvaluation();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Run evaluation error:', error);
    res.status(500).json({ error: 'Failed to run evaluation' });
  }
};

/**
 * GET /api/admin/ai/drift/status
 * Get drift detection status
 */
const getDriftStatus = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const stats = await aiServices.driftService.getDriftStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Drift status error:', error);
    res.status(500).json({ error: 'Failed to get drift status' });
  }
};

/**
 * GET /api/admin/ai/drift/alerts
 * Get active drift alerts
 */
const getDriftAlerts = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const { service, severity, limit } = req.query;
    const alerts = await aiServices.driftService.getActiveAlerts({
      service,
      severity,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Drift alerts error:', error);
    res.status(500).json({ error: 'Failed to get drift alerts' });
  }
};

/**
 * POST /api/admin/ai/drift/check
 * Run drift check
 */
const runDriftCheck = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const results = await aiServices.driftService.runDriftCheck();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Run drift check error:', error);
    res.status(500).json({ error: 'Failed to run drift check' });
  }
};

/**
 * PUT /api/admin/ai/drift/alerts/:alertId/acknowledge
 * Acknowledge a drift alert
 */
const acknowledgeDriftAlert = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const { alertId } = req.params;
    const result = await aiServices.driftService.acknowledgeAlert(alertId, req.user?.id);

    res.json(result);
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
};

/**
 * PUT /api/admin/ai/drift/alerts/:alertId/resolve
 * Resolve a drift alert
 */
const resolveDriftAlert = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const { alertId } = req.params;
    const { resolution } = req.body;
    const result = await aiServices.driftService.resolveAlert(alertId, req.user?.id, resolution);

    res.json(result);
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
};

/**
 * GET /api/admin/ai/drift/retraining
 * Get pending retraining requests
 */
const getRetrainingRequests = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const requests = await aiServices.driftService.getPendingRetrainingRequests();

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Retraining requests error:', error);
    res.status(500).json({ error: 'Failed to get retraining requests' });
  }
};

/**
 * POST /api/admin/ai/drift/retraining
 * Create retraining request
 */
const createRetrainingRequest = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const result = await aiServices.driftService.createRetrainingRequest({
      ...req.body,
      triggeredBy: 'manual'
    });

    res.json(result);
  } catch (error) {
    console.error('Create retraining request error:', error);
    res.status(500).json({ error: 'Failed to create retraining request' });
  }
};

/**
 * PUT /api/admin/ai/drift/retraining/:requestId
 * Review retraining request
 */
const reviewRetrainingRequest = async (req, res) => {
  try {
    if (!aiServices?.driftService) {
      return res.status(503).json({ error: 'Drift service not available' });
    }

    const { requestId } = req.params;
    const { decision, notes } = req.body;
    const result = await aiServices.driftService.reviewRetrainingRequest(
      requestId,
      decision,
      req.user?.id,
      notes
    );

    res.json(result);
  } catch (error) {
    console.error('Review retraining request error:', error);
    res.status(500).json({ error: 'Failed to review retraining request' });
  }
};

/**
 * GET /api/admin/ai/demo/scenarios
 * Get demo scenarios
 */
const getDemoScenarios = async (req, res) => {
  try {
    if (!aiServices?.demoService) {
      return res.status(503).json({ error: 'Demo service not available' });
    }

    const scenarios = aiServices.demoService.getDemoScenarios();

    res.json({
      success: true,
      data: scenarios
    });
  } catch (error) {
    console.error('Demo scenarios error:', error);
    res.status(500).json({ error: 'Failed to get demo scenarios' });
  }
};

/**
 * POST /api/admin/ai/demo/generate
 * Generate synthetic complaints
 */
const generateSyntheticComplaints = async (req, res) => {
  try {
    if (!aiServices?.demoService) {
      return res.status(503).json({ error: 'Demo service not available' });
    }

    const { count, category } = req.body;
    const batch = aiServices.demoService.generateBatch(count || 10, { category });

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    console.error('Generate complaints error:', error);
    res.status(500).json({ error: 'Failed to generate complaints' });
  }
};

/**
 * GET /api/admin/ai/demo/edge-cases
 * Get edge case test data
 */
const getEdgeCases = async (req, res) => {
  try {
    if (!aiServices?.demoService) {
      return res.status(503).json({ error: 'Demo service not available' });
    }

    const { type } = req.query;
    const edgeCases = aiServices.demoService.getEdgeCases(type || 'all');

    res.json({
      success: true,
      data: edgeCases
    });
  } catch (error) {
    console.error('Edge cases error:', error);
    res.status(500).json({ error: 'Failed to get edge cases' });
  }
};

/**
 * POST /api/admin/ai/demo/test
 * Run test suite
 */
const runTestSuite = async (req, res) => {
  try {
    if (!aiServices?.demoService) {
      return res.status(503).json({ error: 'Demo service not available' });
    }

    const results = await aiServices.demoService.runTestSuite();

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Test suite error:', error);
    res.status(500).json({ error: 'Failed to run test suite' });
  }
};

/**
 * POST /api/admin/ai/demo/stress
 * Run stress test
 */
const runStressTest = async (req, res) => {
  try {
    if (!aiServices?.demoService) {
      return res.status(503).json({ error: 'Demo service not available' });
    }

    const { iterations, service, concurrency } = req.body;
    const results = await aiServices.demoService.runStressTest({
      iterations: parseInt(iterations) || 50,
      service: service || 'all',
      concurrency: parseInt(concurrency) || 20
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Stress test error:', error);
    res.status(500).json({ error: 'Failed to run stress test' });
  }
};

/**
 * GET /api/admin/ai/phase5/overview
 * Get Phase 5 services overview
 */
const getPhase5Overview = async (req, res) => {
  try {
    const overview = {
      evaluation: {
        available: !!aiServices?.evaluationService,
        stats: null
      },
      feedback: {
        available: !!aiServices?.feedbackService,
        stats: null
      },
      dashboard: {
        available: !!aiServices?.dashboardService,
        health: null
      },
      demo: {
        available: !!aiServices?.demoService
      },
      drift: {
        available: !!aiServices?.driftService,
        stats: null
      }
    };

    // Fetch stats if services available
    if (aiServices?.evaluationService) {
      try {
        overview.evaluation.stats = await aiServices.evaluationService.getEvaluationStats();
      } catch (e) { overview.evaluation.error = e.message; }
    }

    if (aiServices?.feedbackService) {
      try {
        overview.feedback.stats = await aiServices.feedbackService.getFeedbackStats();
      } catch (e) { overview.feedback.error = e.message; }
    }

    if (aiServices?.dashboardService) {
      try {
        overview.dashboard.health = await aiServices.dashboardService.getQuickHealth();
      } catch (e) { overview.dashboard.error = e.message; }
    }

    if (aiServices?.driftService) {
      try {
        overview.drift.stats = await aiServices.driftService.getDriftStats();
      } catch (e) { overview.drift.error = e.message; }
    }

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Phase 5 overview error:', error);
    res.status(500).json({ error: 'Failed to get Phase 5 overview' });
  }
};

/**
 * GET /api/admin/ai/reliability
 * Get reliability telemetry snapshot for translation and summarization
 */
const getAIReliability = async (req, res) => {
  try {
    if (!reliabilityTelemetry) {
      return res.status(503).json({ error: 'Reliability telemetry not available' });
    }

    const telemetry = reliabilityTelemetry.getSnapshot();

    let translationCacheStats = null;
    if (aiServices?.translationCache?.getCacheStats) {
      try {
        translationCacheStats = await aiServices.translationCache.getCacheStats();
      } catch (e) {
        translationCacheStats = { error: e.message };
      }
    }

    res.json({
      success: true,
      data: {
        telemetry,
        translationCache: translationCacheStats
      }
    });
  } catch (error) {
    console.error('AI reliability error:', error);
    res.status(500).json({ error: 'Failed to fetch AI reliability snapshot' });
  }
};

module.exports = {
  // Phase 1
  getAIOverview,
  getAIMetrics,
  getTranslationCacheStats,
  clearTranslationCache,
  getDuplicateStats,
  getClassificationStats,
  getPriorityAnalytics,
  testClassification,
  testPriorityScoring,
  testDuplicateDetection,
  // Phase 2
  semanticSearch,
  rebuildSearchIndex,
  getSearchStats,
  getTemplateSuggestions,
  getTemplateStats,
  getTemplatesForCategory,
  getTrendAnalysis,
  getQuickTrendStats,
  verifyUser,
  quickVerifyUser,
  // Phase 3
  getSystemHealth,
  getSystemMetrics,
  getSystemAlerts,
  getQueueStatus,
  getDeadLetterJobs,
  retryDeadLetterJob,
  getBatchStatus,
  triggerDailyBatch,
  triggerWeeklyBatch,
  pauseBatch,
  resumeBatch,
  getCleanupStatus,
  triggerCleanup,
  getDataSize,
  getVersions,
  getVersionManifest,
  getWarmupStatus,
  triggerWarmup,
  getTranslationBundle,
  getTranslationBundleStats,
  // Phase 4
  testEnrichment,
  getEnrichmentStats,
  testSemanticDuplicates,
  getSemanticDuplicateStats,
  updateDuplicateThreshold,
  overrideDuplicate,
  getSummarization,
  batchSummarize,
  invalidateSummary,
  getSummarizationStats,
  getPhase4Overview,
  // Phase 5
  getQualityDashboard,
  getQualityHealth,
  getAccuracyTrends,
  getErrorAnalysis,
  generateQualityReport,
  submitFeedback,
  getFeedbackSummary,
  getRecentFeedback,
  getEvaluationSummary,
  getEvaluationErrors,
  runEvaluation,
  getDriftStatus,
  getDriftAlerts,
  runDriftCheck,
  acknowledgeDriftAlert,
  resolveDriftAlert,
  getRetrainingRequests,
  createRetrainingRequest,
  reviewRetrainingRequest,
  getDemoScenarios,
  generateSyntheticComplaints,
  getEdgeCases,
  runTestSuite,
  runStressTest,
  getPhase5Overview,
  getAIReliability
};

