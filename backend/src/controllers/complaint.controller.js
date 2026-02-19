const { Complaint, ComplaintHistory, User } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Import AI services for intelligent processing
let aiServices = null;
try {
  aiServices = require('../ai');
  console.log('✅ AI services loaded for complaint processing');
} catch (err) {
  console.log('⚠️ AI services not available:', err.message);
}

const COMPLAINT_CATEGORIES = [
  'Road & Infrastructure',
  'Water Supply',
  'Electricity',
  'Sanitation',
  'Street Lights',
  'Drainage',
  'Public Health',
  'Encroachment',
  'Noise Pollution',
  'Other'
];

const PRIORITY_LEVELS = ['low', 'normal', 'high', 'urgent'];

const ESTIMATED_DAYS = {
  'Road & Infrastructure': 15,
  'Water Supply': 3,
  'Electricity': 2,
  'Sanitation': 5,
  'Street Lights': 7,
  'Drainage': 10,
  'Public Health': 5,
  'Encroachment': 20,
  'Noise Pollution': 7,
  'Other': 10
};

/**
 * Create new complaint with AI-enhanced features
 * - Auto-priority scoring
 * - Duplicate detection
 * - Category suggestion (if not provided)
 */
const createComplaint = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      title, 
      description, 
      category, 
      location, 
      priority,
      imageUrls = [],
      contactPhone,
      wardNumber,
      isPublic = false
    } = req.body;

    // Debug logging
    console.log('📝 Creating complaint with data:', {
      title,
      category,
      priority,
      imageUrls,
      location,
      wardNumber
    });

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: 'Title, description, and category are required' 
      });
    }

    // Validate category
    if (!COMPLAINT_CATEGORIES.includes(category)) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: 'Invalid category',
        validCategories: COMPLAINT_CATEGORIES
      });
    }

    const normalizedWardNumber = (wardNumber || '').trim();
    const normalizedContactPhone = (contactPhone || '').trim();

    if (!normalizedWardNumber) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Ward number is required'
      });
    }

    if (!normalizedContactPhone) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Alternate contact number is required'
      });
    }

    const phoneRegex = /^[0-9+\-\s]{7,15}$/;
    if (!phoneRegex.test(normalizedContactPhone)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Alternate contact number must be 7-15 digits'
      });
    }

    // AI-enhanced processing
    let aiProcessing = null;
    let finalPriority = priority || 'normal';
    let similarComplaints = [];

    if (aiServices) {
      try {
        const text = [title, description, location].filter(Boolean).join(' ');

        // AI Priority scoring (if not manually set)
        if (!priority) {
          const priorityResult = aiServices.priorityService.scorePriority(title, description, category);
          finalPriority = priorityResult.priority;
          aiProcessing = {
            priorityScored: true,
            priorityConfidence: priorityResult.confidence,
            priorityReason: priorityResult.reason
          };
          console.log(`🤖 AI Priority: ${finalPriority} (${priorityResult.confidence * 100}% confidence)`);
        }

        // Duplicate detection
        similarComplaints = await aiServices.duplicateService.findSimilar(text, userId, {
          category,
          maxResults: 3
        });

        if (similarComplaints.length > 0) {
          console.log(`🔍 Found ${similarComplaints.length} similar complaints`);
          aiProcessing = aiProcessing || {};
          aiProcessing.duplicatesFound = similarComplaints.length;
          aiProcessing.topSimilarity = similarComplaints[0]?.similarity;
        }
      } catch (aiError) {
        console.warn('AI processing error (non-fatal):', aiError.message);
      }
    }

    // Validate final priority
    if (!PRIORITY_LEVELS.includes(finalPriority)) {
      finalPriority = 'normal';
    }

    // Generate complaint ID and tracking ID
    const complaintId = uuidv4();
    const trackingId = `TRP-${Date.now().toString(36).toUpperCase()}`;
    const estimatedDays = ESTIMATED_DAYS[category] || 10;

    // Handle image URLs (up to 3)
    const [imageUrl1, imageUrl2, imageUrl3] = [
      imageUrls[0] || null,
      imageUrls[1] || null,
      imageUrls[2] || null
    ];

    // Create new complaint
    const newComplaint = new Complaint({
      _id: complaintId,
      trackingId,
      userId,
      title,
      description,
      category,
      priority: finalPriority,
      location: location || null,
      imageUrl: imageUrl1,
      imageUrl2: imageUrl2,
      imageUrl3: imageUrl3,
      contactPhone: normalizedContactPhone,
      wardNumber: normalizedWardNumber,
      isPublic: isPublic || false,
      estimatedResolutionDays: estimatedDays,
      status: 'pending'
    });

    await newComplaint.save();

    // Create initial history entry
    const historyEntry = new ComplaintHistory({
      _id: uuidv4(),
      complaintId,
      status: 'pending',
      remarks: aiProcessing?.priorityScored
        ? `Complaint submitted. Priority auto-set to ${finalPriority} by AI.`
        : 'Complaint submitted successfully'
    });

    await historyEntry.save();

    // Build response
    const response = {
      success: true,
      message: 'Complaint submitted successfully',
      complaint: {
        id: complaintId,
        trackingId,
        title,
        category,
        priority: finalPriority,
        status: 'pending',
        estimatedResolutionDays: estimatedDays,
        createdAt: new Date()
      }
    };

    // Include AI insights if available
    if (aiProcessing) {
      response.aiInsights = aiProcessing;
    }

    // Warn about similar complaints
    if (similarComplaints.length > 0) {
      response.similarComplaints = similarComplaints.map(s => ({
        trackingId: s.trackingId,
        title: s.title,
        similarity: Math.round(s.similarity * 100) + '%',
        status: s.status
      }));
      response.warning = `Found ${similarComplaints.length} similar complaint(s). Your complaint has been submitted but may be a duplicate.`;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
};

/**
 * Get user's complaints with enhanced details
 */
const getUserComplaints = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const priority = req.query.priority;
    const skip = (page - 1) * limit;

    let filter = { userId };

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    // Get complaints with pagination
    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Transform complaints to include 'id' field and snake_case for frontend
    const transformedComplaints = complaints.map(c => ({
      ...c,
      id: c._id,
      tracking_id: c.trackingId,
      image_url: c.imageUrl,
      image_url_2: c.imageUrl2,
      image_url_3: c.imageUrl3,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      admin_remarks: c.adminRemarks,
      contact_phone: c.contactPhone,
      ward_number: c.wardNumber
    }));

    // Get total count
    const total = await Complaint.countDocuments(filter);

    // Get summary stats for user
    const statsAggregation = await Complaint.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
        }
      }
    ]);

    const stats = statsAggregation[0] || {
      total: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0
    };

    res.json({
      complaints: transformedComplaints,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to get complaints' });
  }
};

/**
 * Get single complaint with full history timeline
 */
const getComplaint = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get complaint with user details - try both _id match and check userId
    const complaint = await Complaint.findOne({ _id: id, userId }).lean();

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Get user details
    const user = await User.findById(userId).lean();

    // Get status history/timeline
    const history = await ComplaintHistory.find({ complaintId: id })
      .sort({ createdAt: 1 })
      .lean();

    // Transform complaint with proper field names
    const complaintWithUser = {
      ...complaint,
      id: complaint._id,
      tracking_id: complaint.trackingId,
      image_url: complaint.imageUrl,
      image_url_2: complaint.imageUrl2,
      image_url_3: complaint.imageUrl3,
      created_at: complaint.createdAt,
      updated_at: complaint.updatedAt,
      admin_remarks: complaint.adminRemarks,
      contact_phone: complaint.contactPhone,
      ward_number: complaint.wardNumber,
      user_name: user?.name || 'Unknown',
      user_phone: user?.phone || ''
    };

    // Transform history to timeline with proper field names
    const transformedTimeline = history.map(h => ({
      ...h,
      id: h._id,
      created_at: h.createdAt,
      updated_by: h.updatedBy
    }));

    res.json({
      complaint: complaintWithUser,
      timeline: transformedTimeline, // Frontend expects 'timeline'
      history: transformedTimeline  // Keep for backward compatibility
    });

  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ error: 'Failed to get complaint' });
  }
};

/**
 * Track complaint by tracking ID (PUBLIC - no auth required)
 */
const trackComplaint = async (req, res) => {
  try {
    const { trackingId } = req.params;

    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID is required' });
    }

    const complaint = await Complaint.findOne({ 
      trackingId: trackingId.toUpperCase() 
    }).lean();

    if (!complaint) {
      return res.status(404).json({ 
        error: 'Complaint not found',
        message: 'No complaint found with this tracking ID. Please check the ID and try again.'
      });
    }

    // Get timeline (limited info for public view)
    const history = await ComplaintHistory.find({ 
      complaintId: complaint._id 
    })
      .select('status remarks createdAt updatedBy')
      .sort({ createdAt: 1 })
      .lean();

    const createdAt = new Date(complaint.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

    // Generate status message
    let statusMessage = '';
    switch (complaint.status) {
      case 'pending':
        statusMessage = 'Your complaint is pending review by our officials.';
        break;
      case 'in_progress':
        statusMessage = 'Your complaint is being actively worked on.';
        break;
      case 'resolved':
        statusMessage = 'Your complaint has been resolved successfully.';
        break;
      case 'rejected':
        statusMessage = 'Your complaint could not be processed.';
        break;
    }

    // Transform complaint with proper field names
    const transformedComplaint = {
      ...complaint,
      id: complaint._id,
      tracking_id: complaint.trackingId,
      image_url: complaint.imageUrl,
      image_url_2: complaint.imageUrl2,
      image_url_3: complaint.imageUrl3,
      created_at: complaint.createdAt,
      updated_at: complaint.updatedAt,
      admin_remarks: complaint.adminRemarks,
      daysSinceCreation,
      statusMessage
    };

    // Transform timeline with proper field names
    const transformedTimeline = history.map(h => ({
      ...h,
      id: h._id,
      created_at: h.createdAt,
      updated_by: h.updatedBy
    }));

    res.json({
      complaint: transformedComplaint,
      timeline: transformedTimeline
    });

  } catch (error) {
    console.error('Track complaint error:', error);
    res.status(500).json({ error: 'Failed to track complaint' });
  }
};

/**
 * Submit feedback for resolved complaint
 */
const submitFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, feedbackText } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if complaint exists and is resolved
    const complaint = await Complaint.findOne({ _id: id, userId });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint.status !== 'resolved') {
      return res.status(400).json({ error: 'Feedback can only be submitted for resolved complaints' });
    }

    // Update complaint with feedback
    await Complaint.findByIdAndUpdate(id, {
      feedback: {
        rating,
        comment: feedbackText,
        submittedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

/**
 * Get wards list
 */
const getWards = async (req, res) => {
  try {
    // Return default wards for Tirupur
    res.json({
      wards: [
        { id: 'W01', name: 'Ward 1 - Avinashi Road' },
        { id: 'W02', name: 'Ward 2 - Kumaran Road' },
        { id: 'W03', name: 'Ward 3 - Palladam Road' },
        { id: 'W04', name: 'Ward 4 - Dharapuram Road' },
        { id: 'W05', name: 'Ward 5 - Kangeyam Road' },
        { id: 'W06', name: 'Ward 6 - Mangalam Road' },
        { id: 'W07', name: 'Ward 7 - Kongu Main Road' },
        { id: 'W08', name: 'Ward 8 - Veerapandi' },
        { id: 'W09', name: 'Ward 9 - Nallur' },
        { id: 'W10', name: 'Ward 10 - Angeripalayam' },
        { id: 'W11', name: 'Ward 11 - Iduvampalayam' },
        { id: 'W12', name: 'Ward 12 - Perumanallur' }
      ]
    });
  } catch (error) {
    console.error('Get wards error:', error);
    res.status(500).json({ error: 'Failed to get wards' });
  }
};

/**
 * Get public complaints with timeline (PUBLIC - no auth required)
 * Shows resolved complaints that users have made public to build trust
 */
const getPublicComplaints = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    // Build filter - only show public complaints
    let filter = { isPublic: true };
    
    if (category) {
      filter.category = category;
    }
    
    // By default show resolved, but allow filtering
    if (status) {
      filter.status = status;
    }

    const complaints = await Complaint.find(filter)
      .populate('userId', 'name')
      .select('trackingId title description category location status priority wardNumber imageUrl imageUrl2 imageUrl3 createdAt updatedAt resolvedAt adminRemarks feedback isPublic')
      .sort({ resolvedAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Complaint.countDocuments(filter);

    // Get timelines for all complaints
    const complaintsWithTimelines = await Promise.all(
      complaints.map(async (complaint) => {
        const history = await ComplaintHistory.find({ complaintId: complaint._id })
          .select('status remarks createdAt updatedBy')
          .sort({ createdAt: 1 })
          .lean();

        return {
          id: complaint._id,
          trackingId: complaint.trackingId,
          title: complaint.title,
          description: complaint.description,
          category: complaint.category,
          location: complaint.location,
          status: complaint.status,
          priority: complaint.priority,
          wardNumber: complaint.wardNumber,
          imageUrl: complaint.imageUrl,
          imageUrl2: complaint.imageUrl2,
          imageUrl3: complaint.imageUrl3,
          userName: complaint.userId?.name || 'Anonymous Citizen',
          createdAt: complaint.createdAt,
          updatedAt: complaint.updatedAt,
          resolvedAt: complaint.resolvedAt,
          adminRemarks: complaint.adminRemarks,
          feedback: complaint.feedback,
          timeline: history.map(h => ({
            id: h._id,
            status: h.status,
            remarks: h.remarks,
            createdAt: h.createdAt,
            updatedBy: h.updatedBy
          }))
        };
      })
    );

    // Get statistics for public complaints
    const stats = await Complaint.aggregate([
      { $match: { isPublic: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          avgRating: { $avg: '$feedback.rating' }
        }
      }
    ]);

    res.json({
      success: true,
      complaints: complaintsWithTimelines,
      stats: stats[0] || { total: 0, resolved: 0, inProgress: 0, pending: 0, avgRating: null },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get public complaints error:', error);
    res.status(500).json({ error: 'Failed to get public complaints' });
  }
};

/**
 * Toggle complaint public visibility (for user's own complaints)
 */
const toggleComplaintVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { isPublic } = req.body;

    const complaint = await Complaint.findOne({ _id: id, userId });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    complaint.isPublic = isPublic;
    await complaint.save();

    res.json({
      success: true,
      message: isPublic ? 'Complaint is now public' : 'Complaint is now private',
      isPublic: complaint.isPublic
    });

  } catch (error) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
};

/**
 * Preview complaint enrichment before submission (Phase 4)
 * Non-blocking suggestions for improving complaint quality
 */
const previewEnrichment = async (req, res) => {
  try {
    const { title, description, category, location } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description is required' });
    }

    // Check if enrichment service is available
    if (!aiServices?.enrichmentService) {
      return res.json({
        success: true,
        enrichment: null,
        message: 'Enrichment service not available'
      });
    }

    const enrichment = await aiServices.enrichmentService.enrichComplaint({
      title: title || '',
      description: description || '',
      category: category || 'Other'
    });

    res.json({
      success: true,
      enrichment: {
        completenessScore: enrichment.completenessScore,
        suggestions: enrichment.suggestions,
        missingContext: enrichment.missingContext,
        qualityIssues: enrichment.qualityIssues,
        normalizedText: enrichment.normalizedText,
        normalizationChanges: enrichment.normalizationChanges,
        language: enrichment.language,
        latencyMs: enrichment.latencyMs
      }
    });

  } catch (error) {
    console.error('Enrichment preview error:', error);
    // Non-blocking - return success even if enrichment fails
    res.json({
      success: true,
      enrichment: null,
      error: 'Enrichment preview failed'
    });
  }
};

/**
 * Check for duplicate complaints before submission (Phase 4)
 * Uses semantic similarity for better accuracy
 */
const checkDuplicates = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, category, location } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: 'Title or description is required' });
    }

    const text = [title, description, location]
      .filter(part => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim();

    // Check semantic duplicate service first (Phase 4)
    if (aiServices?.semanticDuplicateService) {
      const result = await aiServices.semanticDuplicateService.findSemanticDuplicates(
        text,
        userId,
        { category, maxResults: 5 }
      );

      return res.json({
        success: true,
        method: 'semantic',
        hasDuplicates: result.hasDuplicates,
        highestSimilarity: result.highestSimilarity,
        confidenceBand: result.confidenceBand,
        recommendation: result.recommendation,
        duplicates: result.duplicates,
        latencyMs: result.latencyMs
      });
    }

    // Fallback to basic duplicate service
    if (aiServices?.duplicateService) {
      const duplicates = await aiServices.duplicateService.findSimilar(text, userId, {
        category,
        maxResults: 5
      });

      return res.json({
        success: true,
        method: 'basic',
        hasDuplicates: duplicates.length > 0,
        duplicates,
        message: duplicates.length > 0
          ? `Found ${duplicates.length} similar complaint(s)`
          : 'No similar complaints found'
      });
    }

    // No duplicate service available
    res.json({
      success: true,
      method: null,
      hasDuplicates: false,
      message: 'Duplicate detection not available'
    });

  } catch (error) {
    console.error('Duplicate check error:', error);
    // Non-blocking
    res.json({
      success: true,
      hasDuplicates: false,
      error: 'Duplicate check failed'
    });
  }
};

/**
 * Get complaint summary with timeline (Phase 4)
 * Returns automated summary of complaint history
 */
const getComplaintSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify user owns the complaint
    const complaint = await Complaint.findOne({ _id: id, userId }).lean();

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Check if summarization service is available
    if (!aiServices?.summarizationService) {
      return res.json({
        success: true,
        summary: null,
        message: 'Summarization service not available'
      });
    }

    const summary = await aiServices.summarizationService.summarizeComplaint(id);

    if (summary.error) {
      return res.status(404).json({ error: summary.error });
    }

    res.json({
      success: true,
      summary: {
        complaint: summary.complaint,
        timeline: summary.timeline,
        keyActions: summary.keyActions,
        statusSummary: summary.statusSummary,
        contextSummary: summary.contextSummary,
        confidence: summary.confidence,
        summarySource: summary.summarySource,
        textSummary: summary.textSummary,
        fromCache: summary.fromCache,
        latencyMs: summary.latencyMs
      }
    });

  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
};

/**
 * Submit feedback for AI suggestions (Phase 5)
 * Non-blocking - allows users to rate AI helpfulness
 */
const submitAIFeedback = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetType, targetId, complaintId, helpful, reason, reasonCategory } = req.body;

    if (!targetType || !targetId) {
      return res.status(400).json({ error: 'targetType and targetId are required' });
    }

    // Check if feedback service is available
    if (!aiServices?.feedbackService) {
      return res.json({
        success: true,
        message: 'Feedback recorded (service not available)',
        stored: false
      });
    }

    const result = await aiServices.feedbackService.submitFeedback({
      targetType,
      targetId,
      complaintId,
      userId,
      userRole: 'citizen',
      feedbackType: helpful ? 'helpful' : 'not_helpful',
      helpful,
      reason,
      reasonCategory
    });

    res.json({
      success: result.success,
      feedbackId: result.feedbackId,
      message: 'Thank you for your feedback'
    });

  } catch (error) {
    console.error('AI feedback error:', error);
    // Non-blocking - still return success
    res.json({
      success: true,
      message: 'Feedback noted',
      error: 'Failed to store feedback'
    });
  }
};

module.exports = {
  createComplaint,
  getUserComplaints,
  getComplaint,
  trackComplaint,
  submitFeedback,
  getWards,
  getPublicComplaints,
  toggleComplaintVisibility,
  // Phase 4
  previewEnrichment,
  checkDuplicates,
  getComplaintSummary,
  // Phase 5
  submitAIFeedback,
  COMPLAINT_CATEGORIES,
  PRIORITY_LEVELS
};
