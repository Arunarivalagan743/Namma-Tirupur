# ARCHITECTURE_DETAILED - NamSev Complete System Design

## 🏗️ Complete High-Level Architecture

### System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Browser    │  │    Mobile    │  │   Tablet     │            │
│  │  (Chrome/    │  │   Safari/    │  │   Safari/    │            │
│  │   Firefox)   │  │   Chrome)    │  │   Chrome)    │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                   HTTPS (Port 443)                               │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│                       (React Frontend)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  React 18 SPA (Single Page Application)                │    │
│  │  - Vite Dev Server / Production Build                  │    │
│  │  - Component Tree: Pages → Layouts → Components        │    │
│  │  - React Router (Client-side routing)                  │    │
│  │  - Context API (Global state: Auth, Translation)       │    │
│  │  - Axios (HTTP client)                                 │    │
│  └──────────────────────────┬─────────────────────────────┘    │
│                             │                                    │
│                    REST API Calls                                │
│                  (Authorization: Bearer <JWT>)                   │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                   (Express.js Router)                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  CORS Middleware (Cross-Origin Resource Sharing)       │    │
│  │  - Whitelist: localhost, vercel.app domains            │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  Body Parser (JSON/URL-encoded)                        │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  Route Definitions:                                     │    │
│  │  - /api/auth       → auth.routes.js                    │    │
│  │  - /api/complaints → complaint.routes.js               │    │
│  │  - /api/admin      → admin.routes.js                   │    │
│  │  - /api/engagement → engagement.routes.js              │    │
│  │  - /api/translate  → translate.routes.js               │    │
│  └──────────────────────────┬─────────────────────────────┘    │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MIDDLEWARE LAYER                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  auth.middleware.js                                     │    │
│  │  - verifyToken(): Validate Firebase JWT                │    │
│  │  - requireApprovedUser(): Check status='approved'      │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  super-admin.middleware.js                              │    │
│  │  - checkAdminRole(): role === 'admin'                  │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  ai-firewall.js                                         │    │
│  │  - PII masking (phone, aadhaar)                        │    │
│  │  - Rate limiting for AI services                       │    │
│  └──────────────────────────┬─────────────────────────────┘    │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER (MVC-C)                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  complaint.controller.js                                │    │
│  │  - createComplaint()                                    │    │
│  │  - getMyComplaints()                                    │    │
│  │  - getComplaintById()                                   │    │
│  │  - updateComplaint()                                    │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  auth.controller.js                                     │    │
│  │  - register()                                           │    │
│  │  - getCurrentUser()                                     │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │  admin.controller.js                                    │    │
│  │  - getDashboard()                                       │    │
│  │  - approveUser()                                        │    │
│  │  - assignComplaint()                                    │    │
│  └──────────────────────────┬─────────────────────────────┘    │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
┌──────────────────┐ ┌────────────┐ ┌───────────────────┐
│  SERVICE LAYER   │ │ MODEL LAYER│ │ EXTERNAL SERVICES │
│   (AI Services)  │ │  (MongoDB) │ │    (Firebase)     │
└──────────────────┘ └────────────┘ └───────────────────┘
```

---

## 🔄 Request-Response Lifecycle (Complete Trace)

### Example: Citizen Submits a Complaint

**Step 1: User Action (Frontend)**
```
Citizen fills form on NewComplaint.jsx:
- Title: "Street light broken in Ward 5"
- Description: "Dark at night, need urgent repair"
- Category: "Street Lights"
- Location: "Main Street, Ward 5"
- Ward Number: "5"
- Contact: "9876543210"
- Images: [uploaded files]
```

**Step 2: Client-Side Validation**
```javascript
// frontend/src/pages/citizen/NewComplaint.jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validate required fields
  if (!title || !description || !category) {
    toast.error('Please fill all required fields');
    return;
  }
  
  // Call API
  await api.post('/complaints', formData);
}
```

**Step 3: HTTP Request**
```http
POST https://namsev-backend.vercel.app/api/complaints
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6...
Content-Type: application/json

{
  "title": "Street light broken in Ward 5",
  "description": "Dark at night, need urgent repair",
  "category": "Street Lights",
  "location": "Main Street, Ward 5",
  "wardNumber": "5",
  "contactPhone": "9876543210",
  "imageUrls": ["https://..."]
}
```

**Step 4: Express Router**
```javascript
// backend/src/server.js
app.use('/api/complaints', complaintRoutes);
```
Routes to:
```javascript
// backend/src/routes/complaint.routes.js
router.post('/', verifyToken, requireApprovedUser, createComplaint);
```

**Step 5: Middleware Execution (Chain)**

```javascript
// 1. verifyToken (auth.middleware.js)
const token = req.headers.authorization.split('Bearer ')[1];
const decodedToken = await admin.auth().verifyIdToken(token);
const user = await User.findOne({ firebaseUid: decodedToken.uid });
req.user = user; // Attach to request
next();

// 2. requireApprovedUser (auth.middleware.js)
if (req.user.status !== 'approved') {
  return res.status(403).json({ error: 'Pending Approval' });
}
next();

// 3. createComplaint (controller)
```

**Step 6: Controller Receives Request**
```javascript
// backend/src/controllers/complaint.controller.js
const createComplaint = async (req, res) => {
  const userId = req.user.id; // From middleware
  const { title, description, category } = req.body;
  
  // Generate unique tracking ID
  const trackingId = await generateTrackingId();
  // Result: COMP-2024-001234
  
  // Call AI services...
}
```

**Step 7: AI Processing (Parallel)**

```javascript
// Priority Scoring
const priorityResult = aiServices.scorePriority(title, description, category);
// Result: { priority: 'normal', score: 60, confidence: 0.85 }

// Duplicate Detection
const duplicates = await aiServices.findDuplicates(title, description, category);
// Result: [{ complaint: {}, similarity: 0.82 }]

// Classification (if category missing)
const categoryResult = aiServices.classifyComplaint(title, description);
// Result: { category: 'Street Lights', confidence: 0.92 }
```

**AI Priority Service Internal Flow:**
```javascript
// backend/src/ai/priority.service.js
const scorePriority = (title, description, category) => {
  const text = `${title} ${description}`.toLowerCase();
  
  // Check urgent keywords
  if (text.includes('urgent') || text.includes('fire')) {
    return { priority: 'urgent', score: 100 };
  }
  
  // Check category defaults
  if (category === 'Electricity') {
    return { priority: 'high', score: 75 };
  }
  
  return { priority: 'normal', score: 50 };
}
```

**Step 8: Database Write**
```javascript
// Create complaint document
const complaint = new Complaint({
  _id: uuidv4(),
  trackingId: 'COMP-2024-001234',
  userId: req.user.id,
  title: "Street light broken in Ward 5",
  description: "Dark at night, need urgent repair",
  category: "Street Lights",
  priority: 'normal', // From AI
  status: 'pending',
  location: "Main Street, Ward 5",
  wardNumber: "5",
  imageUrl: "https://...",
  estimatedResolutionDays: 7 // From category defaults
});

await complaint.save(); // MongoDB write
```

**Step 9: Create History Entry**
```javascript
// backend/src/controllers/complaint.controller.js
await ComplaintHistory.create({
  complaintId: complaint._id,
  action: 'created',
  performedBy: userId,
  newValues: { status: 'pending', priority: 'normal' }
});
```

**Step 10: Response Sent**
```javascript
res.status(201).json({
  success: true,
  message: 'Complaint created successfully',
  data: {
    complaint: complaint,
    trackingId: complaint.trackingId,
    duplicates: duplicates.length > 0 ? duplicates : null
  }
});
```

**Step 11: Frontend Receives Response**
```javascript
// frontend/src/pages/citizen/NewComplaint.jsx
const response = await api.post('/complaints', formData);

if (response.data.success) {
  toast.success('Complaint submitted successfully!');
  navigate('/citizen/my-complaints');
}
```

**Step 12: UI Update**
```javascript
// React re-renders, shows success toast
// Navigate to MyComplaints page
// User sees new complaint with trackingId
```

---

## 🔧 Technology Stack Details

### Frontend Stack

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| **React** | 18.2.0 | UI library | Modern hooks, concurrent rendering, component reusability |
| **Vite** | 5.0.8 | Build tool | 10x faster than Webpack, HMR in 50ms, ES modules |
| **React Router** | 6.20.1 | Client routing | Nested routes, lazy loading, protected routes |
| **Axios** | 1.6.2 | HTTP client | Interceptors for auth, automatic JSON parsing |
| **Tailwind CSS** | 3.3.6 | Styling | Utility-first, responsive design, small bundle |
| **React Hot Toast** | 2.4.1 | Notifications | Lightweight, customizable toasts |
| **Firebase SDK** | 10.7.0 | Authentication | Email/password auth, JWT tokens |

### Backend Stack

| Technology | Version | Purpose | Why Chosen |
|------------|---------|---------|------------|
| **Node.js** | 18+ | Runtime | Async I/O, JavaScript everywhere, NPM ecosystem |
| **Express.js** | 4.18.2 | Web framework | Minimal, fast, middleware-based |
| **MongoDB** | 8.21.0 | Database | Document model, flexible schema, Atlas free tier |
| **Mongoose** | 8.21.0 | ODM | Schema validation, middleware hooks, population |
| **Firebase Admin** | 11.11.0 | Auth verification | Server-side JWT validation |
| **bcryptjs** | 2.4.3 | Password hashing | Salted hashing (10 rounds) |
| **Google Translate** | 9.3.0 | Translation | Multi-language support (Tamil, Hindi, etc.) |
| **UUID** | 9.0.1 | ID generation | Unique tracking IDs |

---

## 📊 Database Architecture

### Database Type: **NoSQL (MongoDB)**

### Why MongoDB?

1. **Document Model Fits Complaint Data**:
   ```javascript
   // Complaints have variable fields (imageUrl, imageUrl2, imageUrl3)
   // No need for rigid schema
   {
     title: "...",
     description: "...",
     imageUrl: "..." // May or may not exist
   }
   ```

2. **Flexible Schema Evolution**: Easy to add new fields (e.g., videoUrl) without migrations

3. **JSON-Like Structure**: Matches JavaScript objects perfectly

4. **Embedded Documents**: Can store feedback as subdocument
   ```javascript
   feedback: {
     rating: 4,
     comment: "Fixed quickly",
     submittedAt: Date
   }
   ```

5. **Atlas Free Tier**: 512 MB storage, perfect for MVP

---

## 🔐 Third-Party Services

### 1. Firebase Authentication

**Purpose**: User authentication & authorization

**Why Firebase?**
- ✅ Free tier (50K MAU)
- ✅ Email verification built-in
- ✅ JWT tokens (industry standard)
- ✅ No custom auth logic needed
- ✅ Security rules managed by Google

**Integration Flow**:
```
Frontend                    Firebase Auth               Backend
   │                             │                         │
   │─── signUp(email, pass) ────▶│                         │
   │◀──── JWT token ─────────────│                         │
   │                             │                         │
   │─── API call with JWT ───────┼───────────────────────▶ │
   │                             │                         │
   │                             │◀─── verifyIdToken() ────│
   │                             │                         │
   │                             │──── decoded user ──────▶│
   │◀──────────────── response ──────────────────────────  │
```

### 2. Google Cloud Translation (Optional)

**Purpose**: Real-time translation for multi-language support

**Current Implementation**: 
- Translation caching (stores translations in MongoDB)
- Reduces API calls by 80%

**Languages Supported**:
- English (en)
- Tamil (ta)
- Hindi (hi)
- Telugu (te)
- Kannada (kn)
- Malayalam (ml)

---

## 🧠 AI Services Architecture

### AI Service Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     PHASE 1: CORE SERVICES                   │
├─────────────────────────────────────────────────────────────┤
│  - Priority Scoring (Rule-based keyword detection)          │
│  - Classification (Category suggestion)                     │
│  - Duplicate Detection (TF-IDF + Jaccard similarity)        │
│  - Translation Cache (Two-layer LRU + MongoDB)              │
│  - Preprocessor (Tokenization, stopword removal)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   PHASE 2: PRODUCTIVITY                      │
├─────────────────────────────────────────────────────────────┤
│  - Semantic Search (TF-IDF vector search)                   │
│  - Response Templates (Admin reply suggestions)             │
│  - Trend Detection (Z-score anomaly detection)              │
│  - User Verification (Fuzzy matching for Aadhaar)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 PHASE 3: ENGINEERING                         │
├─────────────────────────────────────────────────────────────┤
│  - Job Queue (Async task processing)                        │
│  - Batch Processing (Scheduled operations)                  │
│  - Cleanup (Data lifecycle management)                      │
│  - Metrics (Performance monitoring)                         │
│  - Warmup (Cold-start optimization for serverless)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  PHASE 4: ADVANCED AI                        │
├─────────────────────────────────────────────────────────────┤
│  - Context Enrichment (Improve vague complaints)            │
│  - Semantic Duplicates (Vector similarity - future ONNX)    │
│  - Summarization (Auto-generate complaint summaries)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              PHASE 5: VALIDATION & MONITORING                │
├─────────────────────────────────────────────────────────────┤
│  - Evaluation (AI accuracy tracking)                        │
│  - Feedback (User/admin ratings)                            │
│  - Dashboard (AI health metrics)                            │
│  - Demo Mode (Testing tools)                                │
│  - Drift Detection (Monitor AI performance over time)       │
└─────────────────────────────────────────────────────────────┘
```

### AI Service Design Principles

1. **Local-First Processing**: No external API dependencies (no OpenAI, no Anthropic)
2. **Graceful Degradation**: App works even if AI services fail
3. **Two-Layer Caching**: L1 (LRU in-memory) + L2 (MongoDB)
4. **Privacy-Preserving**: PII masking before AI processing
5. **Modular & Testable**: Each service can be tested independently

---

## 🎯 Deployment Architecture

### Deployment Platform: **Vercel (Serverless)**

**Why Vercel?**
- ✅ Free tier for hobby projects
- ✅ Automatic HTTPS
- ✅ Global CDN (faster response times)
- ✅ Git-based deployments (push to deploy)
- ✅ Serverless functions (auto-scaling)

### Serverless Adaptations

**Challenge**: Traditional Node.js apps expect long-running processes

**Solutions**:
1. **Database Connection Pooling**:
   ```javascript
   // Reuse MongoDB connection across invocations
   let cachedDb = null;
   const connectDB = async () => {
     if (cachedDb) return cachedDb;
     cachedDb = await mongoose.connect(URI);
   };
   ```

2. **No Background Jobs in Production**:
   ```javascript
   if (process.env.VERCEL !== '1') {
     startScheduler(); // Only in local development
   }
   ```

3. **Warm-up Strategy**:
   ```javascript
   // Pre-load AI models on cold start
   warmupModule.runWarmup();
   ```

---

## 🔄 Communication Patterns

### Frontend ↔ Backend

**Pattern**: REST API over HTTPS

**Authentication**: Bearer token in Authorization header

**Request Format**:
```http
POST /api/complaints
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{ "title": "...", "description": "..." }
```

**Response Format**:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Format**:
```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": { ... }
}
```

### Backend ↔ Database

**Pattern**: Mongoose ODM (Object-Document Mapping)

**Example**:
```javascript
// Find user
const user = await User.findOne({ email: 'user@example.com' });

// Create complaint
const complaint = new Complaint({ ... });
await complaint.save();

// Update with history
await complaint.updateOne({ status: 'resolved' });
```

### Backend ↔ Firebase

**Pattern**: Admin SDK (Server-side authentication)

**Token Verification**:
```javascript
const decodedToken = await admin.auth().verifyIdToken(idToken);
```

---

## 🎨 Component Communication (Frontend)

### Pattern: Props + Context API

**Context Providers**:
1. **AuthContext**: User authentication state
2. **TranslationContext**: Multi-language state

**Component Hierarchy**:
```
App.jsx
├─ AuthProvider (wraps entire app)
│  └─ TranslationProvider
│     └─ Router
│        ├─ Public Routes
│        ├─ Protected Routes (RequireAuth)
│        │  └─ Citizen Dashboard
│        │     ├─ MyComplaints
│        │     ├─ NewComplaint
│        │     └─ ComplaintDetail
│        └─ Admin Routes (RequireAdmin)
│           └─ Admin Dashboard
│              ├─ ManageUsers
│              ├─ ManageComplaints
│              └─ Analytics
```

**Data Flow**:
```
Login → AuthContext.login() → Firebase Auth → Store user in context
↓
All protected routes access: const { currentUser } = useAuth()
↓
Components re-render when auth state changes
```

---

## 🚀 Performance Optimizations

1. **Frontend**:
   - Lazy loading routes
   - Image optimization (compression before upload)
   - Debounced search inputs
   - Memoization of expensive computations

2. **Backend**:
   - Database indexing (userId, status, trackingId)
   - Two-layer caching (LRU + MongoDB)
   - Connection pooling
   - Async/await for parallel operations

3. **Database**:
   - Compound indexes for common queries
   - TTL indexes for auto-cleanup
   - Lean queries (no Mongoose overhead)

---

## 📈 Scalability Considerations

### Current Limits:
- **Users**: 10K-50K per panchayat (well within MongoDB + Vercel limits)
- **Complaints**: 100K+ documents (indexed efficiently)
- **Concurrent Requests**: Vercel auto-scales serverless functions

### Future Scaling:
1. **Horizontal Scaling**: Add read replicas for MongoDB
2. **Caching Layer**: Redis for frequently accessed data
3. **Microservices**: Extract AI services into separate deployments
4. **CDN**: CloudFront for static assets
5. **Queue System**: Bull/Redis for async jobs

---

## 🔗 Next Steps

Read these related documentation files:
- [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) - Detailed code organization
- [END_TO_END_FLOW.md](./END_TO_END_FLOW.md) - Complete request tracing
- [SECURITY_ANALYSIS.md](./SECURITY_ANALYSIS.md) - Security implementation
