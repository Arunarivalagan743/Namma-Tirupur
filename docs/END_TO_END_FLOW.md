# END_TO_END_FLOW - Complete Request Tracing

## 🔄 User Story: Citizen Submits a Complaint

### Complete Journey from Button Click to Database

---

## 📍 Step-by-Step Execution Trace

### **STEP 1: User Action** (Frontend - Browser)

**User fills the form on NewComplaint page**:

```
Title: "Street light broken near market"
Description: "The street light has been non-functional for 3 days causing safety issues at night"
Category: "Street Lights"
Ward: "Ward 5"
Location: "Main Street, near vegetable market"
Contact: "9876543210"
Images: [uploaded 2 photos]
```

---

### **STEP 2: Client-Side Validation** (React Component)

**Location**: `frontend/src/pages/citizen/NewComplaint.jsx`

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // 1. Validate required fields
  if (!formData.title || !formData.description || !formData.category) {
    toast.error('Please fill all required fields');
    return; // ❌ Stop execution
  }
  
  if (formData.title.length < 10) {
    toast.error('Title must be at least 10 characters');
    return; // ❌ Stop execution
  }
  
  if (!formData.wardNumber) {
    toast.error('Ward number is required');
    return; // ❌ Stop execution
  }
  
  if (!formData.contactPhone) {
    toast.error('Contact phone is required');
    return; // ❌ Stop execution
  }
  
  // ✅ All validations passed, proceed...
  setLoading(true);
  
  try {
    // Make API call...
  } catch (error) {
    // Handle error...
  }
};
```

---

### **STEP 3: API Service Call** (Frontend Service Layer)

**Location**: `frontend/src/services/complaint.service.js`

```javascript
// API service wraps axios calls
export const complaintService = {
  createComplaint: async (data) => {
    const response = await api.post('/complaints', data);
    return response.data;
  }
};
```

**What happens**:
```javascript
// 1. api.post triggers axios instance
// 2. Request interceptor adds Authorization header
// 3. Firebase gets current user's JWT token
// 4. Token is attached to request headers
```

---

### **STEP 4: HTTP Request Sent** (Network Layer)

**HTTP Request Details**:

```http
POST https://namsev-backend.vercel.app/api/complaints HTTP/1.1
Host: namsev-backend.vercel.app
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjE4MmU...
Content-Length: 456

{
  "title": "Street light broken near market",
  "description": "The street light has been non-functional for 3 days causing safety issues at night",
  "category": "Street Lights",
  "location": "Main Street, near vegetable market",
  "wardNumber": "W05",
  "contactPhone": "9876543210",
  "imageUrls": [
    "https://cloudinary.com/image1.jpg",
    "https://cloudinary.com/image2.jpg"
  ],
  "isPublic": false
}
```

**Network Journey**:
```
User's Browser 
→ ISP 
→ Internet 
→ Vercel CDN (Edge Network) 
→ Vercel Serverless Function 
→ Backend Express App
```

---

### **STEP 5: Server Receives Request** (Backend Entry Point)

**Location**: `backend/src/server.js`

```javascript
// 1. Request enters Express app
app.use(cors(corsOptions)); // ✅ CORS check passes

// 2. Body parser processes JSON
app.use(express.json()); // ✅ Parses body into req.body

// 3. Database connection middleware (for serverless)
app.use('/api', async (req, res, next) => {
  await connectDB(); // ✅ Ensures MongoDB connection
  next();
});

// 4. Route matching
app.use('/api/complaints', complaintRoutes); // ✅ Routes to complaint routes
```

---

### **STEP 6: Route Handler** (Express Router)

**Location**: `backend/src/routes/complaint.routes.js`

```javascript
const router = express.Router();

// Match POST /api/complaints
router.post(
  '/',                      // Path: /api/complaints
  verifyToken,              // Middleware 1: Verify JWT
  requireApprovedUser,      // Middleware 2: Check user status
  createComplaint           // Final handler
);
```

**Middleware Chain Execution**: `verifyToken → requireApprovedUser → createComplaint`

---

### **STEP 7: Middleware 1 - JWT Verification** (Authentication)

**Location**: `backend/src/middleware/auth.middleware.js`

```javascript
const verifyToken = async (req, res, next) => {
  // 1. Extract token from header
  const authHeader = req.headers.authorization;
  // "Bearer eyJhbGciOiJSUzI1NiIs..."
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
    // ❌ Stop execution, return 401
  }
  
  const token = authHeader.split('Bearer ')[1];
  // "eyJhbGciOiJSUzI1NiIs..."
  
  try {
    // 2. Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    // ✅ Firebase validates token signature, expiry, etc.
    
    // decodedToken = {
    //   uid: "firebase_user_123",
    //   email: "user@example.com",
    //   exp: 1234567890,
    //   ...
    // }
    
    // 3. Find user in MongoDB by Firebase UID
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // User in Firebase but not in our database
      req.user = {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        isRegistered: false
      };
    } else {
      // User exists in our database
      req.user = {
        id: user._id,               // MongoDB _id
        firebaseUid: decodedToken.uid,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,            // 'citizen' or 'admin'
        status: user.status,        // 'pending', 'approved', 'rejected'
        isRegistered: true
      };
    }
    
    // ✅ Attach user to request object
    // req.user is now available in next middleware/controller
    
    next(); // ✅ Continue to next middleware
    
  } catch (firebaseError) {
    console.error('Firebase verification failed:', firebaseError);
    return res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
    // ❌ Stop execution, return 401
  }
};
```

---

### **STEP 8: Middleware 2 - Check User Approval** (Authorization)

**Location**: `backend/src/middleware/auth.middleware.js`

```javascript
const requireApprovedUser = async (req, res, next) => {
  // req.user was set by verifyToken middleware
  
  if (!req.user || !req.user.isRegistered) {
    return res.status(403).json({ 
      error: 'User not registered in system' 
    });
    // ❌ Stop execution, return 403
  }
  
  if (req.user.status !== 'approved') {
    return res.status(403).json({ 
      error: 'Pending Approval',
      message: 'Your account is pending admin approval' 
    });
    // ❌ Stop execution, return 403
  }
  
  // ✅ User is approved, continue
  next();
};
```

---

### **STEP 9: Controller - createComplaint** (Business Logic)

**Location**: `backend/src/controllers/complaint.controller.js`

```javascript
const createComplaint = async (req, res) => {
  try {
    // 1. Extract userId from middleware
    const userId = req.user.id; // Set by verifyToken middleware
    
    // 2. Extract form data from request body
    const { 
      title, 
      description, 
      category, 
      location,
      imageUrls,
      contactPhone,
      wardNumber,
      isPublic = false
    } = req.body;
    
    // 3. Server-side validation
    if (!title || !description || !category) {
      return res.status(400).json({ 
        error: 'Validation Error',
        message: 'Title, description, and category are required' 
      });
    }
    
    if (!COMPLAINT_CATEGORIES.includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        validCategories: COMPLAINT_CATEGORIES
      });
    }
    
    if (!wardNumber) {
      return res.status(400).json({
        error: 'Ward number is required'
      });
    }
    
    // ✅ All validations passed
    
    // 4. Generate unique tracking ID
    const trackingId = await generateTrackingId();
    // Result: "COMP-2024-001234"
    
    // 5. AI Processing (Parallel execution for speed)
    let priorityResult = { priority: 'normal', score: 50 };
    let duplicates = [];
    let categoryResult = null;
    
    if (aiServices) {
      try {
        // Run AI services in parallel using Promise.all
        const [priority, dups, catSuggestion] = await Promise.all([
          // AI: Score priority based on keywords
          aiServices.scorePriority(title, description, category),
          
          // AI: Check for duplicates
          aiServices.findDuplicates(title, description, category),
          
          // AI: Verify category (optional)
          category ? null : aiServices.classifyComplaint(title, description)
        ]);
        
        priorityResult = priority;
        duplicates = dups || [];
        categoryResult = catSuggestion;
        
        console.log('AI Results:', {
          priority: priorityResult,
          duplicateCount: duplicates.length,
          categoryConfidence: categoryResult?.confidence
        });
        
      } catch (aiError) {
        console.error('AI processing error:', aiError);
        // Graceful degradation: Continue without AI
      }
    }
    
    // 6. Prepare complaint data
    const complaintData = {
      _id: uuidv4(),                          // Generate UUID
      trackingId,                             // COMP-2024-001234
      userId,                                  // From req.user
      title,
      description,
      category,
      location: location || '',
      status: 'pending',                       // Initial status
      priority: priorityResult.priority,       // From AI or default
      wardNumber,
      contactPhone,
      imageUrl: imageUrls[0] || null,
      imageUrl2: imageUrls[1] || null,
      imageUrl3: imageUrls[2] || null,
      isPublic,
      estimatedResolutionDays: ESTIMATED_DAYS[category] || 10
    };
    
    // 7. Create complaint in MongoDB
    const complaint = new Complaint(complaintData);
    await complaint.save();
    // ✅ MongoDB INSERT operation
    
    console.log('✅ Complaint created:', complaint._id);
    
    // 8. Create history entry (audit trail)
    await ComplaintHistory.create({
      _id: uuidv4(),
      complaintId: complaint._id,
      action: 'created',
      performedBy: userId,
      performedByType: 'citizen',
      previousValues: {},
      newValues: {
        status: 'pending',
        priority: priorityResult.priority,
        category
      },
      remarks: 'Complaint submitted by citizen'
    });
    // ✅ MongoDB INSERT operation
    
    console.log('✅ History entry created');
    
    // 9. Return success response
    return res.status(201).json({
      success: true,
      message: 'Complaint created successfully',
      data: {
        complaint: {
          _id: complaint._id,
          trackingId: complaint.trackingId,
          title: complaint.title,
          category: complaint.category,
          priority: complaint.priority,
          status: complaint.status,
          createdAt: complaint.createdAt
        },
        ai: {
          priorityScore: priorityResult.score,
          priorityReason: priorityResult.reason,
          duplicatesFound: duplicates.length
        },
        duplicates: duplicates.length > 0 ? duplicates : null
      }
    });
    
  } catch (error) {
    console.error('Complaint creation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
```

---

### **STEP 10: AI Service - Priority Scoring** (AI Processing)

**Location**: `backend/src/ai/priority.service.js`

```javascript
const scorePriority = (title, description, category) => {
  // 1. Combine title and description
  const text = `${title || ''} ${description || ''}`.trim().toLowerCase();
  
  if (!text) {
    return {
      priority: 'normal',
      score: 50,
      confidence: 0.5,
      reason: 'No text provided',
      method: 'default'
    };
  }
  
  // 2. Check URGENT keywords
  const urgentCheck = containsKeyword(text, URGENT_KEYWORDS);
  if (urgentCheck.found) {
    return {
      priority: 'urgent',
      score: 100,
      confidence: 0.95,
      reason: `Urgent keyword detected: "${urgentCheck.keyword}"`,
      method: 'keyword',
      detectedLanguage: urgentCheck.language
    };
  }
  
  // 3. Check HIGH priority keywords
  const highCheck = containsKeyword(text, HIGH_KEYWORDS);
  if (highCheck.found) {
    return {
      priority: 'high',
      score: 75,
      confidence: 0.85,
      reason: `High priority keyword: "${highCheck.keyword}"`,
      method: 'keyword'
    };
  }
  
  // 4. Check category-based defaults
  if (CATEGORY_PRIORITY[category]) {
    const catPriority = CATEGORY_PRIORITY[category];
    return {
      priority: catPriority,
      score: PRIORITY_WEIGHTS[catPriority],
      confidence: 0.7,
      reason: `Category "${category}" defaults to ${catPriority}`,
      method: 'category'
    };
  }
  
  // 5. Default to normal
  return {
    priority: 'normal',
    score: 50,
    confidence: 0.6,
    reason: 'No priority indicators found',
    method: 'default'
  };
};

// Keyword detection helper
const containsKeyword = (text, keywordMap) => {
  const lowerText = text.toLowerCase();
  
  for (const lang of Object.keys(keywordMap)) {
    for (const keyword of keywordMap[lang]) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return { found: true, keyword, language: lang };
      }
    }
  }
  
  return { found: false };
};
```

---

### **STEP 11: AI Service - Duplicate Detection** (AI Processing)

**Location**: `backend/src/ai/duplicate.service.js`

```javascript
const findDuplicates = async (title, description, category) => {
  try {
    // 1. Get recent complaints from same category (last 30 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - RECENT_DAYS);
    
    const candidates = await Complaint.find({
      category,
      createdAt: { $gte: recentDate },
      status: { $ne: 'resolved' } // Exclude resolved
    })
    .limit(MAX_CANDIDATES)
    .lean(); // Lean query for performance
    
    if (!candidates || candidates.length === 0) {
      return []; // No candidates to compare
    }
    
    // 2. Preprocess new complaint text
    const newText = `${title} ${description}`.trim();
    
    // 3. Find similar using TF-IDF
    const similarities = findSimilarTFIDF(newText, candidates);
    
    // 4. Filter by threshold (60% similarity)
    const duplicates = similarities.filter(s => s.similarity >= SIMILARITY_THRESHOLD);
    
    console.log(`Found ${duplicates.length} duplicates out of ${candidates.length} candidates`);
    
    return duplicates; // Array of { complaint, similarity, method }
    
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return [];
  }
};

// TF-IDF Similarity
const findSimilarTFIDF = (text, candidates) => {
  // 1. Tokenize all documents
  const allTexts = [text, ...candidates.map(c => `${c.title} ${c.description}`)];
  
  // 2. Build TF-IDF vectors
  const { vectors } = buildTFIDF(allTexts);
  
  const newVector = vectors[0]; // New complaint vector
  const similarities = [];
  
  // 3. Calculate cosine similarity with each candidate
  for (let i = 1; i < vectors.length; i++) {
    const similarity = cosineSimilarity(newVector, vectors[i]);
    
    if (similarity >= SIMILARITY_THRESHOLD) {
      similarities.push({
        complaint: candidates[i - 1],
        similarity: Math.round(similarity * 100) / 100,
        method: 'tfidf'
      });
    }
  }
  
  // 4. Sort by similarity (highest first)
  return similarities.sort((a, b) => b.similarity - a.similarity);
};
```

---

### **STEP 12: Database Write** (MongoDB)

```javascript
// Mongoose save() triggers MongoDB INSERT
await complaint.save();

// MongoDB Operation:
db.complaints.insertOne({
  _id: "abc-123-def-456",
  trackingId: "COMP-2024-001234",
  userId: "user-uuid",
  title: "Street light broken near market",
  description: "The street light has been non-functional for 3 days...",
  category: "Street Lights",
  location: "Main Street, near vegetable market",
  status: "pending",
  priority: "normal",
  wardNumber: "W05",
  contactPhone: "9876543210",
  imageUrl: "https://cloudinary.com/image1.jpg",
  imageUrl2: "https://cloudinary.com/image2.jpg",
  createdAt: ISODate("2024-02-10T10:30:00Z"),
  updatedAt: ISODate("2024-02-10T10:30:00Z")
})

// Index used: { trackingId: 1 } (unique index)
// Execution time: ~15ms
```

---

### **STEP 13: HTTP Response Sent** (Network Layer)

```http
HTTP/1.1 201 Created
Content-Type: application/json
Date: Sat, 10 Feb 2024 10:30:00 GMT
X-Powered-By: Express
Content-Length: 587

{
  "success": true,
  "message": "Complaint created successfully",
  "data": {
    "complaint": {
      "_id": "abc-123-def-456",
      "trackingId": "COMP-2024-001234",
      "title": "Street light broken near market",
      "category": "Street Lights",
      "priority": "normal",
      "status": "pending",
      "createdAt": "2024-02-10T10:30:00.000Z"
    },
    "ai": {
      "priorityScore": 50,
      "priorityReason": "Category 'Street Lights' defaults to normal",
      "duplicatesFound": 0
    },
    "duplicates": null
  }
}
```

---

### **STEP 14: Frontend Receives Response** (React Component)

```javascript
// NewComplaint.jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    const response = await complaintService.createComplaint(formData);
    // response.data = { success: true, message: "...", data: {...} }
    
    if (response.success) {
      // 1. Show success toast
      toast.success(
        `Complaint submitted! Tracking ID: ${response.data.complaint.trackingId}`,
        { duration: 5000 }
      );
      
      // 2. Check for duplicates warning
      if (response.data.ai.duplicatesFound > 0) {
        toast.warning(
          `Note: ${response.data.ai.duplicatesFound} similar complaint(s) already exist`,
          { duration: 7000 }
        );
      }
      
      // 3. Navigate to My Complaints page
      navigate('/citizen/my-complaints');
      
      // 4. Clear form (optional if navigating away)
      setFormData({
        title: '',
        description: '',
        category: '',
        location: '',
        wardNumber: '',
        contactPhone: '',
        imageUrls: []
      });
    }
    
  } catch (error) {
    // Error handled by axios interceptor
    // Toast already shown
    console.error('Submission error:', error);
    
  } finally {
    setLoading(false);
  }
};
```

---

### **STEP 15: UI Update** (React Re-render)

```javascript
// 1. React detects state change (loading: true → false)
// 2. Component re-renders with updated state
// 3. React Hot Toast shows success message (green checkmark)
// 4. React Router navigates to /citizen/my-complaints
// 5. MyComplaints component mounts
// 6. useEffect in MyComplaints calls API to fetch complaints
// 7. New complaint appears at top of list (sorted by createdAt desc)
```

---

## ⏱️ Performance Metrics

### End-to-End Timing Breakdown:

```
User clicks Submit
├─ 0ms     │ Client validation (instant)
├─ 50ms    │ Network request sent
├─ 100ms   │ Reaches Vercel edge network
├─ 120ms   │ Cold start / warm function (0-500ms)
├─ 150ms   │ Middleware chain (JWT + Auth)
├─ 180ms   │ AI priority scoring (30ms)
├─ 220ms   │ AI duplicate detection (40ms - TF-IDF)
├─ 235ms   │ MongoDB INSERT (15ms)
├─ 240ms   │ History entry INSERT (5ms)
├─ 250ms   │ Response sent
├─ 300ms   │ Response received by client
├─ 310ms   │ Toast notification shown
└─ 500ms   │ Navigation complete

Total: ~500ms (0.5 seconds) ✅
```

**Note**: Cold start can add 200-500ms on first request after idle period.

---

## 🎯 Interview Question: "Walk me through a complete user flow"

**Answer**:

> "When a citizen submits a complaint in NamSev, here's what happens:
>
> **Frontend**: User fills the form, client validates required fields, then makes an HTTP POST request to `/api/complaints` with their Firebase JWT token in the Authorization header.
>
> **Backend**: The request hits our Express server which first runs CORS middleware, then body parsing. It routes to the complaint routes where two middleware run: 
> 1. `verifyToken` validates the JWT with Firebase Admin SDK and attaches the user to the request
> 2. `requireApprovedUser` checks if their status is 'approved'
>
> **Controller**: The `createComplaint` controller validates inputs, generates a unique tracking ID like 'COMP-2024-001234', then calls our AI services in parallel:
> - Priority scoring checks for urgent keywords ('fire', 'flood') in Tamil/Hindi/English
> - Duplicate detection uses TF-IDF to find similar complaints from the last 30 days
> - Results in under 100ms
>
> **Database**: We create the complaint document in MongoDB with the AI-suggested priority, then create an audit trail entry in ComplaintHistory. Both use UUID primary keys.
>
> **Response**: We return 201 with the tracking ID, AI insights, and duplicate warnings if any. The frontend shows a success toast and navigates to MyComplaints where the new complaint appears at the top.
>
> **Total time**: Typically 300-500ms end-to-end. The key optimizations are parallel AI processing, MongoDB indexing on userId and trackingId, and connection pooling for serverless."

---

## 🔗 Related Documentation

- [ARCHITECTURE_DETAILED.md](./ARCHITECTURE_DETAILED.md) - System architecture
- [BACKEND_DETAILED.md](./BACKEND_DETAILED.md) - Backend deep dive
- [FRONTEND_DETAILED.md](./FRONTEND_DETAILED.md) - Frontend deep dive
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) - Database schema
- [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) - Interview questions
