const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const aiAdminController = require('../controllers/ai.admin.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

// Apply admin middleware to all routes
router.use(verifyToken, requireAdmin);

// Dashboard statistics
router.get('/dashboard', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/pending', adminController.getPendingUsers);
router.put('/users/:id/approve', adminController.approveUser);
router.put('/users/:id/reject', adminController.rejectUser);

// Complaint management
router.get('/complaints', adminController.getAllComplaints);
router.put('/complaints/:id/status', adminController.updateComplaintStatus);
router.patch('/complaints/:id/visibility', adminController.toggleComplaintVisibility);
router.get('/complaints/analytics', adminController.getComplaintAnalytics);

// ============ AI MANAGEMENT ROUTES ============
// AI Overview and Metrics (Phase 1)
router.get('/ai/overview', aiAdminController.getAIOverview);
router.get('/ai/metrics', aiAdminController.getAIMetrics);

// Translation cache management (Phase 1)
router.get('/ai/translation-cache/stats', aiAdminController.getTranslationCacheStats);
router.delete('/ai/translation-cache', aiAdminController.clearTranslationCache);

// AI Analytics (Phase 1)
router.get('/ai/duplicates/stats', aiAdminController.getDuplicateStats);
router.get('/ai/classification/stats', aiAdminController.getClassificationStats);
router.get('/ai/priority/analytics', aiAdminController.getPriorityAnalytics);

// AI Testing endpoints (Phase 1)
router.post('/ai/test/classification', aiAdminController.testClassification);
router.post('/ai/test/priority', aiAdminController.testPriorityScoring);
router.post('/ai/test/duplicates', aiAdminController.testDuplicateDetection);

// ============ PHASE 2: PRODUCTIVITY FEATURES ============
// Semantic Search
router.get('/ai/search', aiAdminController.semanticSearch);
router.post('/ai/search/reindex', aiAdminController.rebuildSearchIndex);
router.get('/ai/search/stats', aiAdminController.getSearchStats);

// Response Templates
router.post('/ai/templates/suggest', aiAdminController.getTemplateSuggestions);
router.get('/ai/templates/stats', aiAdminController.getTemplateStats);
router.get('/ai/templates/:category', aiAdminController.getTemplatesForCategory);

// Trend Detection
router.get('/ai/trends', aiAdminController.getTrendAnalysis);
router.get('/ai/trends/quick', aiAdminController.getQuickTrendStats);

// User Verification
router.post('/ai/verify-user', aiAdminController.verifyUser);
router.post('/ai/verify-user/quick', aiAdminController.quickVerifyUser);

// ============ PHASE 3: SYSTEM MANAGEMENT ============
// Health & Metrics
router.get('/system/health', aiAdminController.getSystemHealth);
router.get('/system/metrics', aiAdminController.getSystemMetrics);
router.get('/system/alerts', aiAdminController.getSystemAlerts);

// Queue Management
router.get('/system/queues', aiAdminController.getQueueStatus);
router.get('/system/queues/:name/dead-letter', aiAdminController.getDeadLetterJobs);
router.post('/system/queues/:name/dead-letter/:jobId/retry', aiAdminController.retryDeadLetterJob);

// Batch Processing
router.get('/system/batch', aiAdminController.getBatchStatus);
router.post('/system/batch/daily', aiAdminController.triggerDailyBatch);
router.post('/system/batch/weekly', aiAdminController.triggerWeeklyBatch);
router.post('/system/batch/pause', aiAdminController.pauseBatch);
router.post('/system/batch/resume', aiAdminController.resumeBatch);

// Cleanup & Archiving
router.get('/system/cleanup', aiAdminController.getCleanupStatus);
router.post('/system/cleanup/run', aiAdminController.triggerCleanup);
router.get('/system/cleanup/data-size', aiAdminController.getDataSize);

// Versioning
router.get('/system/versions', aiAdminController.getVersions);
router.get('/system/versions/manifest', aiAdminController.getVersionManifest);

// Warmup
router.get('/system/warmup', aiAdminController.getWarmupStatus);
router.post('/system/warmup/run', aiAdminController.triggerWarmup);

// Offline Translation Bundles
router.get('/system/translations/stats', aiAdminController.getTranslationBundleStats);
router.get('/system/translations/:lang', aiAdminController.getTranslationBundle);

// ============ PHASE 4: ADVANCED AI FEATURES ============
// Phase 4 Overview
router.get('/ai/phase4/overview', aiAdminController.getPhase4Overview);

// Context Enrichment
router.post('/ai/enrich', aiAdminController.testEnrichment);
router.get('/ai/enrichment/stats', aiAdminController.getEnrichmentStats);

// Semantic Duplicate Detection
router.post('/ai/semantic-duplicates', aiAdminController.testSemanticDuplicates);
router.get('/ai/semantic-duplicates/stats', aiAdminController.getSemanticDuplicateStats);
router.put('/ai/semantic-duplicates/threshold', aiAdminController.updateDuplicateThreshold);
router.post('/ai/semantic-duplicates/override', aiAdminController.overrideDuplicate);

// Complaint Summarization
router.get('/ai/summarize/:complaintId', aiAdminController.getSummarization);
router.post('/ai/summarize/batch', aiAdminController.batchSummarize);
router.delete('/ai/summarize/:complaintId', aiAdminController.invalidateSummary);
router.get('/ai/summarization/stats', aiAdminController.getSummarizationStats);

// ============ PHASE 5: VALIDATION & MONITORING ============
// Phase 5 Overview
router.get('/ai/phase5/overview', aiAdminController.getPhase5Overview);

// Quality Dashboard
router.get('/ai/quality/dashboard', aiAdminController.getQualityDashboard);
router.get('/ai/quality/health', aiAdminController.getQualityHealth);
router.get('/ai/quality/trends', aiAdminController.getAccuracyTrends);
router.get('/ai/quality/errors', aiAdminController.getErrorAnalysis);
router.get('/ai/quality/report', aiAdminController.generateQualityReport);
router.get('/ai/reliability', aiAdminController.getAIReliability);

// Feedback
router.post('/ai/feedback', aiAdminController.submitFeedback);
router.get('/ai/feedback/summary', aiAdminController.getFeedbackSummary);
router.get('/ai/feedback/recent', aiAdminController.getRecentFeedback);

// Evaluation
router.get('/ai/evaluation/summary', aiAdminController.getEvaluationSummary);
router.get('/ai/evaluation/errors/:service', aiAdminController.getEvaluationErrors);
router.post('/ai/evaluation/run', aiAdminController.runEvaluation);

// Drift Detection
router.get('/ai/drift/status', aiAdminController.getDriftStatus);
router.get('/ai/drift/alerts', aiAdminController.getDriftAlerts);
router.post('/ai/drift/check', aiAdminController.runDriftCheck);
router.put('/ai/drift/alerts/:alertId/acknowledge', aiAdminController.acknowledgeDriftAlert);
router.put('/ai/drift/alerts/:alertId/resolve', aiAdminController.resolveDriftAlert);

// Retraining Management
router.get('/ai/drift/retraining', aiAdminController.getRetrainingRequests);
router.post('/ai/drift/retraining', aiAdminController.createRetrainingRequest);
router.put('/ai/drift/retraining/:requestId', aiAdminController.reviewRetrainingRequest);

// Demo & Testing
router.get('/ai/demo/scenarios', aiAdminController.getDemoScenarios);
router.post('/ai/demo/generate', aiAdminController.generateSyntheticComplaints);
router.get('/ai/demo/edge-cases', aiAdminController.getEdgeCases);
router.post('/ai/demo/test', aiAdminController.runTestSuite);
router.post('/ai/demo/stress', aiAdminController.runStressTest);

module.exports = router;
