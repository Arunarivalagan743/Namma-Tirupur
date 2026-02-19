/**
 * Automated Complaint Summarization Service
 *
 * Phase 4 Feature 3: Summarize long complaint histories
 *
 * Capabilities:
 * - Generate timeline of events
 * - Extract key actions taken
 * - Show current status summary
 * - Work on complaint threads, admin remarks, status changes
 *
 * Rules:
 * - Local processing preferred
 * - Rule-based fallback
 * - Cached results
 * - Regenerate only on change
 *
 * Target latency: <60ms
 */

const preprocessor = require('./preprocessor');
const cache = require('./cache');
const crypto = require('crypto');
const axios = require('axios');
const { createLogger } = require('../utils/logger');
const reliabilityTelemetry = require('./reliability.telemetry');

const logger = createLogger('SummarizationService');

// Configuration
const CONFIG = {
  maxHistoryItems: 50,
  maxSummaryLength: 500,
  maxLlmPromptChars: 4000,
  llmTimeoutMs: 2500,
  cachePrefix: 'summary:',
  llmCachePrefix: 'summary:llm:',
  cacheTtlMs: 60 * 60 * 1000,  // 1 hour
  llmCacheTtlMs: 6 * 60 * 60 * 1000,
  versionPrefix: 'v:',
  llmEnabled: process.env.SUMMARIZATION_LLM_ENABLED !== 'false',
  llmConfidenceThreshold: Number(process.env.SUMMARIZATION_LLM_CONFIDENCE_THRESHOLD || 0.65)
};

// Status transition labels
const STATUS_LABELS = {
  pending: { label: 'Submitted', icon: '📝', color: 'blue' },
  in_progress: { label: 'Under Review', icon: '🔄', color: 'yellow' },
  resolved: { label: 'Resolved', icon: '✅', color: 'green' },
  rejected: { label: 'Rejected', icon: '❌', color: 'red' }
};

// Action keywords for extraction
const ACTION_KEYWORDS = {
  inspection: ['inspected', 'visited', 'site visit', 'checked', 'verified', 'inspection', 'surveyed'],
  field_visit: ['field visit', 'on-site', 'onsite', 'spot visit', 'visited location'],
  assignment: ['assigned', 'forwarded', 'transferred', 'escalated', 'referred'],
  work_order: ['work order', 'issued order', 'maintenance order', 'contractor assigned'],
  work: ['work started', 'repair', 'fixed', 'completed', 'done', 'resolved', 'rectified'],
  citizen_followup: ['citizen follow-up', 'followed up', 'citizen contacted', 'beneficiary contacted'],
  response: ['responded', 'replied', 'contacted', 'called', 'informed', 'notified'],
  escalation: ['escalated', 'urgent', 'priority', 'supervisor', 'higher authority'],
  pending: ['pending', 'waiting', 'on hold', 'delayed', 'awaiting']
};

/**
 * Format date for timeline display
 */
const formatDate = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Calculate time between two dates
 */
const calculateDuration = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end - start;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return 'Less than an hour';
};

/**
 * Extract action type from remarks
 */
const extractActionType = (remarks) => {
  if (!remarks) return 'update';

  const lowerRemarks = remarks.toLowerCase();

  for (const [actionType, keywords] of Object.entries(ACTION_KEYWORDS)) {
    if (keywords.some(kw => lowerRemarks.includes(kw))) {
      return actionType;
    }
  }

  return 'update';
};

/**
 * Generate summary text from remarks
 */
const summarizeRemarks = (remarks, maxLength = 100) => {
  if (!remarks) return '';

  // Clean the text
  let summary = remarks
    .replace(/\s+/g, ' ')
    .trim();

  // Truncate if needed
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength);
    const lastSpace = summary.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      summary = summary.substring(0, lastSpace);
    }
    summary += '...';
  }

  return summary;
};

const getChronologicalHistory = (history = []) => {
  return [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const extractTimelineSignals = (complaint, history) => {
  const sortedHistory = getChronologicalHistory(history);
  const signals = {
    createdDate: complaint.createdAt,
    assignmentEvents: [],
    escalationEvents: [],
    updateEvents: [],
    resolutionEvent: null
  };

  if (complaint.assignedTo) {
    signals.assignmentEvents.push({
      date: complaint.updatedAt || complaint.createdAt,
      details: `Assigned to ${complaint.assignedTo}`
    });
  }

  for (const item of sortedHistory) {
    const actionType = extractActionType(item.remarks);
    const update = {
      date: item.createdAt,
      status: item.status,
      actionType,
      remarks: summarizeRemarks(item.remarks, 120)
    };

    if (actionType === 'assignment') {
      signals.assignmentEvents.push(update);
    }

    if (actionType === 'escalation') {
      signals.escalationEvents.push(update);
    }

    signals.updateEvents.push(update);

    if (item.status === 'resolved') {
      signals.resolutionEvent = update;
    }
  }

  return signals;
};

const calculateSummaryConfidence = (complaint, history, keyActions, timelineSignals) => {
  let score = 0;

  if (complaint?.description?.trim()) score += 0.2;
  if (complaint?.category) score += 0.15;
  if (complaint?.status) score += 0.15;
  if (history.length > 0) score += 0.2;
  if (keyActions.length > 0) score += 0.15;
  if (timelineSignals.updateEvents.length > 0) score += 0.1;
  if (complaint?.adminRemarks?.trim()) score += 0.05;

  const normalized = Math.min(1, Math.max(0, score));
  const level = normalized >= 0.8 ? 'high' : normalized >= 0.6 ? 'medium' : 'low';

  return {
    score: Number(normalized.toFixed(2)),
    level,
    hasEnoughContext: normalized >= 0.6
  };
};

const derivePendingSteps = (complaint, statusSummary, keyActions) => {
  if (complaint.status === 'resolved') {
    return ['Close the complaint after citizen confirmation.'];
  }

  if (complaint.status === 'rejected') {
    return ['Provide a clear rejection reason and reopen path to citizen if applicable.'];
  }

  const steps = [];
  const actionTypes = new Set(keyActions.map(action => action.type));

  if (!actionTypes.has('inspection') && !actionTypes.has('field_visit')) {
    steps.push('Conduct or record an on-site inspection.');
  }

  if (!actionTypes.has('work_order') && !actionTypes.has('work')) {
    steps.push('Issue work order and assign execution owner.');
  }

  if (!actionTypes.has('citizen_followup') && !actionTypes.has('response')) {
    steps.push('Send citizen follow-up with progress update.');
  }

  if (statusSummary.isOverdue) {
    steps.push('Escalate to higher authority due to overdue timeline.');
  }

  if (steps.length === 0) {
    steps.push('Continue active monitoring until closure criteria are met.');
  }

  return steps;
};

const tryEnhanceWithGemini = async (cacheKey, prompt) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  if (!CONFIG.llmEnabled || !geminiApiKey) {
    return null;
  }

  const llmCache = cache.getCache('summaries_llm');
  const fullCacheKey = `${CONFIG.llmCachePrefix}${cacheKey}`;
  const cached = await llmCache.get(fullCacheKey);

  if (cached?.textSummary) {
    return { textSummary: cached.textSummary, fromCache: true };
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt.substring(0, CONFIG.maxLlmPromptChars) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 220
        }
      },
      { timeout: CONFIG.llmTimeoutMs }
    );

    const textSummary = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!textSummary) {
      return null;
    }

    await llmCache.set(fullCacheKey, { textSummary }, {
      l1TtlMs: CONFIG.llmCacheTtlMs,
      l2TtlMs: CONFIG.llmCacheTtlMs
    });

    return { textSummary, fromCache: false };
  } catch (error) {
    logger.debug('Gemini enhancement unavailable, using local summary', {
      message: error.message
    });
    return null;
  }
};

/**
 * Build timeline from complaint history
 */
const buildTimeline = (complaint, history) => {
  const timeline = [];
  const sortedHistory = getChronologicalHistory(history);

  // Add creation event
  timeline.push({
    date: complaint.createdAt,
    formattedDate: formatDate(complaint.createdAt),
    type: 'created',
    status: 'pending',
    statusInfo: STATUS_LABELS.pending,
    action: 'Complaint submitted',
    details: complaint.title,
    isStart: true
  });

  // Add history events
  sortedHistory.forEach((item, index) => {
    const prevStatus = index > 0 ? sortedHistory[index - 1].status : 'pending';
    const statusChanged = item.status !== prevStatus;
    const actionType = extractActionType(item.remarks);

    timeline.push({
      date: item.createdAt,
      formattedDate: formatDate(item.createdAt),
      type: statusChanged ? 'status_change' : 'update',
      status: item.status,
      statusInfo: STATUS_LABELS[item.status] || STATUS_LABELS.pending,
      action: statusChanged
        ? `Status changed to ${STATUS_LABELS[item.status]?.label || item.status}`
        : actionType,
      actionType,
      details: summarizeRemarks(item.remarks),
      adminId: item.adminId,
      isStatusChange: statusChanged
    });
  });

  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Mark last item
  if (timeline.length > 0) {
    timeline[timeline.length - 1].isLatest = true;
  }

  return timeline;
};

/**
 * Extract key actions from history
 */
const extractKeyActions = (history) => {
  const keyActions = [];
  const seenTypes = new Set();
  const sortedHistory = getChronologicalHistory(history);

  // Prioritize status changes and unique action types
  sortedHistory.forEach(item => {
    const actionType = extractActionType(item.remarks);

    // Always include status changes
    if (item.status === 'in_progress' && !seenTypes.has('started')) {
      keyActions.push({
        type: 'started',
        label: 'Processing Started',
        date: item.createdAt,
        formattedDate: formatDate(item.createdAt)
      });
      seenTypes.add('started');
    }

    if (item.status === 'resolved' && !seenTypes.has('resolved')) {
      keyActions.push({
        type: 'resolved',
        label: 'Issue Resolved',
        date: item.createdAt,
        formattedDate: formatDate(item.createdAt)
      });
      seenTypes.add('resolved');
    }

    if (item.status === 'rejected' && !seenTypes.has('rejected')) {
      keyActions.push({
        type: 'rejected',
        label: 'Issue Rejected',
        date: item.createdAt,
        formattedDate: formatDate(item.createdAt)
      });
      seenTypes.add('rejected');
    }

    // Add unique action types
    if (!seenTypes.has(actionType) && actionType !== 'update') {
      keyActions.push({
        type: actionType,
        label: actionType.charAt(0).toUpperCase() + actionType.slice(1),
        date: item.createdAt,
        formattedDate: formatDate(item.createdAt),
        details: summarizeRemarks(item.remarks, 50)
      });
      seenTypes.add(actionType);
    }
  });

  // Sort by date
  keyActions.sort((a, b) => new Date(a.date) - new Date(b.date));

  return keyActions;
};

/**
 * Generate current status summary
 */
const generateStatusSummary = (complaint, history) => {
  const currentStatus = complaint.status;
  const statusInfo = STATUS_LABELS[currentStatus] || STATUS_LABELS.pending;
  const sortedHistory = getChronologicalHistory(history);

  // Calculate durations
  const totalDuration = calculateDuration(complaint.createdAt,
    currentStatus === 'resolved' ? complaint.resolvedAt : null);

  // Find time in current status
  const lastStatusChange = history
    .filter(h => h.status === currentStatus)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  const timeInStatus = lastStatusChange
    ? calculateDuration(lastStatusChange.createdAt)
    : totalDuration;

  // Get latest update
  const latestUpdate = sortedHistory.length > 0
    ? sortedHistory[sortedHistory.length - 1]
    : null;

  // Build summary
  const summary = {
    status: currentStatus,
    statusLabel: statusInfo.label,
    statusIcon: statusInfo.icon,
    statusColor: statusInfo.color,
    totalDuration,
    timeInStatus,
    updateCount: history.length,
    lastUpdated: latestUpdate?.createdAt || complaint.createdAt,
    lastUpdatedFormatted: formatDate(latestUpdate?.createdAt || complaint.createdAt),
    latestRemarks: latestUpdate?.remarks || null,
    assignedTo: complaint.assignedTo || null,
    isOverdue: false,
    overdueBy: null
  };

  // Check if overdue (only for non-resolved)
  if (currentStatus !== 'resolved' && currentStatus !== 'rejected') {
    const estimatedDays = complaint.estimatedResolutionDays || 10;
    const daysSinceCreation = Math.floor(
      (new Date() - new Date(complaint.createdAt)) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation > estimatedDays) {
      summary.isOverdue = true;
      summary.overdueBy = `${daysSinceCreation - estimatedDays} days`;
    }
  }

  return summary;
};

/**
 * Generate full text summary
 */
const generateTextSummary = (complaint, history, timeline, keyActions, statusSummary, contextSummary) => {
  const parts = [];

  // Opening
  parts.push(`Issue: "${complaint.title}" (${complaint.category}) reported ${formatDate(complaint.createdAt)}.`);

  // Context
  parts.push(`Priority is ${complaint.priority || 'normal'} and current status is ${statusSummary.statusLabel}.`);

  // What has been done
  if (history.length === 0) {
    parts.push('No administrative updates have been recorded yet.');
  } else {
    parts.push(`${history.length} update${history.length > 1 ? 's' : ''} recorded so far.`);
  }

  // Key actions
  if (keyActions.length > 0) {
    const actionsSummary = keyActions
      .map(a => `${a.label} (${a.formattedDate})`)
      .join(', ');
    parts.push(`Actions completed: ${actionsSummary}.`);
  }

  // Current status and elapsed time
  parts.push(`Current position: ${statusSummary.statusLabel}, active for ${statusSummary.timeInStatus}, total elapsed ${statusSummary.totalDuration}.`);

  // Overdue warning
  if (statusSummary.isOverdue) {
    parts.push(`⚠️ This complaint is overdue by ${statusSummary.overdueBy}.`);
  }

  // Latest update
  if (statusSummary.latestRemarks) {
    parts.push(`Latest update: "${summarizeRemarks(statusSummary.latestRemarks, 100)}"`);
  }

  if (contextSummary.pendingSteps.length > 0) {
    parts.push(`Next steps: ${contextSummary.pendingSteps.join(' ')}`);
  }

  return parts.join(' ');
};

/**
 * Calculate summary version hash
 * Used to determine if summary needs regeneration
 */
const calculateVersionHash = (complaint, history) => {
  const sortedHistory = getChronologicalHistory(history);
  const historySignature = sortedHistory.map(item => ({
    id: item._id,
    status: item.status,
    remarks: item.remarks || '',
    createdAt: item.createdAt?.toISOString ? item.createdAt.toISOString() : String(item.createdAt || '')
  }));

  const versionData = {
    status: complaint.status,
    assignedTo: complaint.assignedTo || null,
    adminRemarks: complaint.adminRemarks || null,
    resolvedAt: complaint.resolvedAt?.toISOString() || null,
    historyCount: sortedHistory.length,
    lastHistoryId: sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1]._id : null,
    timelineSignature: historySignature,
    updatedAt: complaint.updatedAt?.toISOString() || complaint.createdAt?.toISOString()
  };

  return crypto.createHash('sha256')
    .update(JSON.stringify(versionData))
    .digest('hex')
    .slice(0, 24);
};

/**
 * Main summarization function
 *
 * @param {string} complaintId - Complaint ID
 * @param {Object} options - Summarization options
 * @returns {Object} Complete summary with timeline, actions, and status
 */
const summarizeComplaint = async (complaintId, options = {}) => {
  const startTime = Date.now();

  const {
    includeTimeline = true,
    includeKeyActions = true,
    includeTextSummary = true,
    includeConfidence = true,
    allowLlmEnhancement = true,
    forceRegenerate = false
  } = options;

  const result = {
    complaintId,
    generated: true,
    fromCache: false,
    versionHash: null,
    latencyMs: 0,
    complaint: null,
    timeline: null,
    keyActions: null,
    statusSummary: null,
    contextSummary: null,
    confidence: null,
    summarySource: 'local',
    textSummary: null,
    error: null
  };

  try {
    // Import models
    const { Complaint, ComplaintHistory } = require('../models');

    // Get complaint
    const complaint = await Complaint.findById(complaintId).lean();
    if (!complaint) {
      result.error = 'Complaint not found';
      result.latencyMs = Date.now() - startTime;
      return result;
    }

    // Get history
    const history = await ComplaintHistory.find({ complaintId })
      .sort({ createdAt: 1 })
      .limit(CONFIG.maxHistoryItems)
      .lean();
    const sortedHistory = getChronologicalHistory(history);

    // Calculate version hash
    result.versionHash = calculateVersionHash(complaint, history);

    // Check cache (unless force regenerate)
    if (!forceRegenerate) {
      const summaryCache = cache.getCache('summaries');
      const cacheKey = `${CONFIG.cachePrefix}${complaintId}`;
      const cached = await summaryCache.get(cacheKey);

      if (cached && cached.versionHash === result.versionHash) {
        const cachedResult = {
          ...cached,
          fromCache: true,
          latencyMs: Date.now() - startTime
        };

        reliabilityTelemetry.recordSummarization({
          latencyMs: cachedResult.latencyMs,
          fromCache: true,
          summarySource: cachedResult.summarySource,
          confidenceScore: cachedResult.confidence?.score,
          error: cachedResult.error
        });

        return cachedResult;
      }
    }

    // Store basic complaint info
    result.complaint = {
      id: complaint._id,
      trackingId: complaint.trackingId,
      title: complaint.title,
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status,
      location: complaint.location,
      createdAt: complaint.createdAt,
      resolvedAt: complaint.resolvedAt
    };

    // Generate timeline
    if (includeTimeline) {
      result.timeline = buildTimeline(complaint, sortedHistory);
    }

    // Extract key actions
    if (includeKeyActions) {
      result.keyActions = extractKeyActions(sortedHistory);
    }

    // Generate status summary
    result.statusSummary = generateStatusSummary(complaint, sortedHistory);

    const timelineSignals = extractTimelineSignals(complaint, sortedHistory);
    const keyActions = result.keyActions || [];
    const pendingSteps = derivePendingSteps(complaint, result.statusSummary, keyActions);

    result.contextSummary = {
      issue: complaint.description ? summarizeRemarks(complaint.description, 180) : complaint.title,
      category: complaint.category,
      keyActions,
      latestStatus: result.statusSummary.statusLabel,
      timeElapsed: result.statusSummary.totalDuration,
      pendingSteps,
      timelineSignals
    };

    if (includeConfidence) {
      result.confidence = calculateSummaryConfidence(
        complaint,
        sortedHistory,
        keyActions,
        timelineSignals
      );
    }

    // Generate text summary
    if (includeTextSummary) {
      result.textSummary = generateTextSummary(
        complaint,
        sortedHistory,
        result.timeline,
        result.keyActions,
        result.statusSummary,
        result.contextSummary
      );

      const shouldUseLlm = allowLlmEnhancement &&
        includeConfidence &&
        (result.confidence?.score || 0) < CONFIG.llmConfidenceThreshold;

      if (shouldUseLlm) {
        const llmPrompt = [
          'Create a concise civic complaint summary answering:',
          '1) What is the issue?',
          '2) What has been done?',
          '3) What is current status?',
          '4) What happens next?',
          `Title: ${complaint.title}`,
          `Category: ${complaint.category}`,
          `Description: ${complaint.description || ''}`,
          `Status: ${result.statusSummary.statusLabel}`,
          `Time elapsed: ${result.statusSummary.totalDuration}`,
          `Recent updates: ${sortedHistory.slice(-5).map(item => `${formatDate(item.createdAt)} - ${item.status} - ${(item.remarks || '').trim()}`).join(' | ')}`,
          `Pending steps: ${pendingSteps.join(' ')}`
        ].join('\n');

        const llmEnhanced = await tryEnhanceWithGemini(result.versionHash, llmPrompt);
        if (llmEnhanced?.textSummary) {
          result.textSummary = summarizeRemarks(llmEnhanced.textSummary, CONFIG.maxSummaryLength);
          result.summarySource = llmEnhanced.fromCache ? 'gemini_cache' : 'gemini';
        }
      }
    }

    result.latencyMs = Date.now() - startTime;

    // Cache result
    const summaryCache = cache.getCache('summaries');
    const cacheKey = `${CONFIG.cachePrefix}${complaintId}`;
    await summaryCache.set(cacheKey, result, { l1TtlMs: CONFIG.cacheTtlMs });

    reliabilityTelemetry.recordSummarization({
      latencyMs: result.latencyMs,
      fromCache: false,
      summarySource: result.summarySource,
      confidenceScore: result.confidence?.score,
      error: null
    });

  } catch (error) {
    result.error = error.message;
    result.generated = false;
    result.latencyMs = Date.now() - startTime;

    reliabilityTelemetry.recordSummarization({
      latencyMs: result.latencyMs,
      fromCache: false,
      summarySource: 'local',
      confidenceScore: result.confidence?.score,
      error: result.error
    });
  }

  return result;
};

/**
 * Summarize multiple complaints (batch)
 */
const summarizeMultiple = async (complaintIds, options = {}) => {
  const results = await Promise.all(
    complaintIds.map(id => summarizeComplaint(id, options))
  );

  return {
    total: complaintIds.length,
    successful: results.filter(r => r.generated).length,
    fromCache: results.filter(r => r.fromCache).length,
    summaries: results,
    avgLatencyMs: Math.round(
      results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
    )
  };
};

/**
 * Invalidate cached summary for a complaint
 */
const invalidateSummary = async (complaintId) => {
  const summaryCache = cache.getCache('summaries');
  const cacheKey = `${CONFIG.cachePrefix}${complaintId}`;
  await summaryCache.delete(cacheKey);
  return { success: true, complaintId };
};

/**
 * Get summarization statistics
 */
const getSummarizationStats = async () => {
  const summaryCache = cache.getCache('summaries');

  return {
    cache: await summaryCache.getStats(),
    config: {
      maxHistoryItems: CONFIG.maxHistoryItems,
      maxSummaryLength: CONFIG.maxSummaryLength,
      cacheTtlMs: CONFIG.cacheTtlMs
    },
    statusLabels: STATUS_LABELS,
    actionTypes: Object.keys(ACTION_KEYWORDS)
  };
};

module.exports = {
  summarizeComplaint,
  summarizeMultiple,
  buildTimeline,
  extractKeyActions,
  generateStatusSummary,
  generateTextSummary,
  invalidateSummary,
  getSummarizationStats,
  getReliabilitySnapshot: () => reliabilityTelemetry.getSnapshot(),
  resetReliabilitySnapshot: () => reliabilityTelemetry.reset(),
  // Export for testing
  CONFIG,
  STATUS_LABELS,
  ACTION_KEYWORDS,
  formatDate,
  calculateDuration
};

