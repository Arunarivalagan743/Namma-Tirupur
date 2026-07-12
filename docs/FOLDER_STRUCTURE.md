# FOLDER STRUCTURE - NamSev Code Organization

## 📁 Complete Project Structure

```
NammaTirupur/
├── LICENSE                          # MIT License
├── README.md                        # Project overview
├── backend/                         # Backend Node.js application
│   ├── package.json                # Backend dependencies
│   ├── vercel.json                 # Vercel serverless configuration
│   ├── firebase-service-account.json # Firebase credentials
│   ├── database/                   # Database scripts (deprecated)
│   ├── scripts/                    # Utility scripts
│   │   ├── create-test-user.js    # Create test user
│   │   ├── insertMockData.js      # Seed database with mock data
│   │   └── reset-test-credentials.js # Reset test account
│   └── src/                        # Source code
│       ├── server.js              # Main entry point, Express app setup
│       ├── ai/                    # AI/ML Services (17 services)
│       ├── config/                # Configuration files
│       ├── controllers/           # Request handlers (MVC-C)
│       ├── middleware/            # Express middleware
│       ├── models/                # Mongoose schemas (MVC-M)
│       ├── routes/                # API route definitions
│       └── utils/                 # Utility functions
├── docs/                           # Documentation
│   ├── API_REFERENCE.md           # API endpoints documentation
│   ├── ARCHITECTURE.md            # System architecture
│   ├── CHANGELOG.md               # Version history
│   ├── DEPLOYMENT.md              # Deployment guide
│   ├── INDEX.md                   # Documentation index
│   ├── OPERATIONS.md              # Operations guide
│   └── SECURITY.md                # Security guidelines
└── frontend/                       # Frontend React application
    ├── index.html                 # HTML entry point
    ├── package.json               # Frontend dependencies
    ├── postcss.config.js          # PostCSS configuration
    ├── tailwind.config.js         # Tailwind CSS configuration
    ├── vercel.json                # Vercel frontend configuration
    ├── vite.config.js             # Vite build configuration
    ├── public/                    # Static assets
    └── src/                       # Source code
        ├── App.jsx                # Root component
        ├── index.css              # Global styles
        ├── main.jsx               # React entry point
        ├── components/            # Reusable UI components
        ├── config/                # Configuration files
        ├── context/               # React Context providers
        ├── hooks/                 # Custom React hooks
        ├── layouts/               # Page layouts
        ├── pages/                 # Page components
        └── services/              # API integration services
```

---

## 🗂️ Backend Deep Dive

### `/backend/src/server.js` - Main Entry Point

**Purpose**: Express app initialization, middleware setup, route registration

**Key Responsibilities**:
```javascript
1. Load environment variables (dotenv)
2. Initialize Phase 3 systems (warmup, batch, cleanup, metrics)
3. Apply CORS middleware
4. Register API routes
5. Database connection for serverless
6. Error handling
7. Export app for Vercel serverless
```

**Code Structure**:
```javascript
// Import routes
const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');

// CORS configuration
app.use(cors(corsOptions));

// Body parsers
app.use(express.json());

// Database connection middleware
app.use('/api', async (req, res, next) => { await connectDB(); });

// Route registration
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);

// Error handler
app.use((err, req, res, next) => { ... });

// Export for Vercel
module.exports = app;
```

---

### `/backend/src/ai/` - AI Services (17 Services)

**Purpose**: Intelligent assistance for complaint processing

**File Structure**:
```
ai/
├── index.js                        # Main AI service aggregator
├── preprocessor.js                 # Text preprocessing (tokenization, stopwords)
├── cache/                          # Two-layer caching system
│   ├── lru.js                     # L1: In-memory LRU cache
│   └── mongo.js                   # L2: MongoDB persistent cache
├── workers/                        # Background job processors
│   ├── queue.js                   # Job queue implementation
│   ├── batch.js                   # Batch processing scheduler
│   ├── cleanup.js                 # Data lifecycle management
│   ├── metrics.js                 # Performance monitoring
│   └── warmup.js                  # Cold-start optimization
├── classifier.service.js           # [PHASE 1] Category classification
├── duplicate.service.js            # [PHASE 1] Duplicate detection (TF-IDF + Jaccard)
├── priority.service.js             # [PHASE 1] Priority scoring (rule-based)
├── translation.cache.js            # [PHASE 1] Translation caching
├── search.service.js               # [PHASE 2] Semantic search (TF-IDF)
├── templates.service.js            # [PHASE 2] Admin response templates
├── trends.service.js               # [PHASE 2] Trend detection (Z-score)
├── verification.service.js         # [PHASE 2] User identity verification
├── enrichment.service.js           # [PHASE 4] Context enrichment
├── semantic-duplicate.service.js   # [PHASE 4] Vector similarity
├── summarization.service.js        # [PHASE 4] Auto-summarization
├── evaluation.service.js           # [PHASE 5] AI accuracy tracking
├── feedback.service.js             # [PHASE 5] User/admin feedback
├── dashboard.service.js            # [PHASE 5] AI health dashboard
├── demo.service.js                 # [PHASE 5] Demo mode
└── drift.service.js                # [PHASE 5] AI drift detection
```

#### Key AI Services Explained:

**1. preprocessor.js** - Text Preprocessing
```javascript
// Functions:
- tokenize(text)           // Split into words, lowercase
- removeStopwords(tokens)  // Remove "the", "is", "a", etc.
- preprocess(text)         // Full pipeline

// Example:
"The street light is broken" 
→ ["street", "light", "broken"]
```

**2. priority.service.js** - Priority Scoring
```javascript
// Algorithm: Rule-based keyword matching
- URGENT_KEYWORDS: ['fire', 'flood', 'accident']
- HIGH_KEYWORDS: ['no water', 'power cut']
- NORMAL_KEYWORDS: ['pothole', 'maintenance']
- CATEGORY_PRIORITY: { 'Water Supply': 'high' }

// Returns:
{
  priority: 'urgent',
  score: 100,
  confidence: 0.95,
  reason: "Urgent keyword detected: 'fire'"
}
```

**3. duplicate.service.js** - Duplicate Detection
```javascript
// Algorithm: TF-IDF + Jaccard similarity
- Step 1: Preprocess both complaints
- Step 2: Build TF-IDF vectors
- Step 3: Calculate cosine similarity
- Step 4: Threshold: 0.6 (60% similarity)

// Returns:
[
  {
    complaint: { title, description, ... },
    similarity: 0.82,
    method: 'tfidf'
  }
]
```

**4. classifier.service.js** - Category Classification
```javascript
// Algorithm: Keyword → Category mapping
const CATEGORY_KEYWORDS = {
  'Water Supply': ['water', 'pipe', 'tank', 'tap'],
  'Electricity': ['power', 'electricity', 'blackout'],
  'Street Lights': ['light', 'lamp', 'dark']
};

// Fallback: If no match, return 'Other'
```

**5. enrichment.service.js** - Context Enrichment
```javascript
// Purpose: Help citizens write better complaints
// Example:
Input: "Light not working"
Output: {
  enriched: true,
  suggestions: [
    "Specify which street or landmark",
    "Mention ward number",
    "Add when you noticed the issue"
  ]
}
```

**6. trends.service.js** - Trend Detection
```javascript
// Algorithm: Z-score anomaly detection
- Step 1: Get complaint count per category (last 30 days)
- Step 2: Calculate mean and std deviation
- Step 3: Z-score = (current - mean) / std
- Step 4: If |Z-score| > 2, flag as anomaly

// Returns:
{
  category: 'Water Supply',
  count: 45,
  average: 20,
  zscore: 3.2,
  status: 'increasing'
}
```

---

### `/backend/src/config/` - Configuration Files

```
config/
├── database.js                     # MongoDB connection logic
├── firebase.js                     # Firebase Admin SDK initialization
├── firebase-service-account.json   # Firebase credentials (gitignored)
└── google-translate-service-account.json # Translation API credentials
```

#### database.js
```javascript
// Purpose: Manage MongoDB connection for serverless
let cachedDb = null;

const connectDB = async () => {
  if (cachedDb) return cachedDb; // Reuse connection
  
  const connection = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10
  });
  
  cachedDb = connection;
  return cachedDb;
};
```

#### firebase.js
```javascript
// Purpose: Initialize Firebase Admin SDK
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  })
});

module.exports = { admin };
```

---

### `/backend/src/controllers/` - Request Handlers (MVC-C)

```
controllers/
├── auth.controller.js              # Authentication endpoints
├── complaint.controller.js         # Complaint CRUD operations
├── admin.controller.js             # Admin dashboard & management
├── ai.admin.controller.js          # AI admin controls
├── announcement.controller.js      # Announcements
├── engagement.controller.js        # Community engagement (polls, meetings)
├── super-admin.controller.js       # Multi-tenant management
├── tenant.controller.js            # Tenant-specific operations
├── translate.controller.js         # Translation endpoints
└── user.controller.js              # User management
```

#### complaint.controller.js - Key Functions:

| Function | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| `createComplaint` | POST | `/api/complaints` | Create new complaint with AI |
| `getMyComplaints` | GET | `/api/complaints/my-complaints` | Get user's complaints |
| `getComplaintById` | GET | `/api/complaints/:id` | Get single complaint |
| `updateComplaint` | PUT | `/api/complaints/:id` | Update complaint status |
| `deleteComplaint` | DELETE | `/api/complaints/:id` | Soft delete complaint |
| `findDuplicates` | POST | `/api/complaints/find-duplicates` | Check for duplicates |
| `enrichContext` | POST | `/api/complaints/enrich` | AI context enrichment |

**Example: createComplaint Flow**
```javascript
const createComplaint = async (req, res) => {
  // 1. Extract userId from middleware (req.user)
  const userId = req.user.id;
  
  // 2. Validate input
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  // 3. Generate tracking ID
  const trackingId = await generateTrackingId();
  
  // 4. AI Processing (parallel)
  const [priorityResult, duplicates] = await Promise.all([
    aiServices.scorePriority(title, description, category),
    aiServices.findDuplicates(title, description, category)
  ]);
  
  // 5. Create complaint document
  const complaint = new Complaint({ ... });
  await complaint.save();
  
  // 6. Create history entry
  await ComplaintHistory.create({ ... });
  
  // 7. Return response
  res.status(201).json({ success: true, data: complaint });
};
```

---

### `/backend/src/middleware/` - Express Middleware

```
middleware/
├── auth.middleware.js              # JWT verification & authorization
├── super-admin.middleware.js       # Role-based access control
├── tenant.middleware.js            # Multi-tenant isolation
└── ai-firewall.js                  # PII masking & rate limiting
```

#### auth.middleware.js - Functions:

**1. verifyToken(req, res, next)**
```javascript
// Purpose: Validate Firebase JWT token
// Attaches req.user to request
const token = req.headers.authorization.split('Bearer ')[1];
const decodedToken = await admin.auth().verifyIdToken(token);
const user = await User.findOne({ firebaseUid: decodedToken.uid });
req.user = user;
next();
```

**2. requireApprovedUser(req, res, next)**
```javascript
// Purpose: Check if user.status === 'approved'
if (req.user.status !== 'approved') {
  return res.status(403).json({ error: 'Pending Approval' });
}
next();
```

**3. requireAdmin(req, res, next)**
```javascript
// Purpose: Check if user.role === 'admin'
if (req.user.role !== 'admin') {
  return res.status(403).json({ error: 'Admin access required' });
}
next();
```

---

### `/backend/src/models/` - Database Schemas (MVC-M)

```
models/
├── index.js                        # Model aggregator (exports all models)
├── User.js                         # User schema
├── Complaint.js                    # Complaint schema
├── ComplaintHistory.js             # Audit trail
├── Announcement.js                 # Announcements
├── Meeting.js                      # Meeting/Sabha
├── Poll.js                         # Community polls
├── Scheme.js                       # Government schemes
├── CommunityEvent.js               # Events
├── PanchayatWork.js                # Public works
├── Budget.js                       # Budget transparency
├── Suggestion.js                   # Citizen suggestions
├── FAQ.js                          # Frequently asked questions
├── News.js                         # News updates
├── EmergencyAlert.js               # Emergency notifications
├── Tenant.js                       # Multi-tenant support
├── TenantConfig.js                 # Tenant configuration
├── TenantAuditLog.js               # Tenant audit trail
├── TenantBilling.js                # Tenant billing
└── SuperAdmin.js                   # Super admin users
```

#### User.js - Schema Breakdown:

```javascript
const userSchema = new mongoose.Schema({
  _id: String,                      // UUID
  firebaseUid: String (unique),     // Firebase Auth UID
  email: String (unique),           // Email address
  name: String,                     // Full name
  phone: String,                    // Contact number
  address: String,                  // Residential address
  aadhaarLast4: String,             // Last 4 digits of Aadhaar (privacy)
  panchayatCode: String,            // Panchayat identifier (multi-tenant)
  role: String (enum),              // 'citizen' | 'admin'
  status: String (enum),            // 'pending' | 'approved' | 'rejected'
  rejectionReason: String           // Reason if rejected
}, { timestamps: true });

// Indexes:
- firebaseUid (unique)
- email (unique)
- status (for filtering)
- panchayatCode (for multi-tenant queries)
```

#### Complaint.js - Schema Breakdown:

```javascript
const complaintSchema = new mongoose.Schema({
  _id: String,                      // UUID
  trackingId: String (unique),      // COMP-2024-001234
  userId: String (ref: 'User'),     // Who submitted
  title: String (max: 200),         // Complaint title
  description: String,              // Detailed description
  category: String (enum),          // 10 categories
  location: String,                 // Incident location
  status: String (enum),            // 'pending' | 'in_progress' | 'resolved' | 'rejected'
  priority: String (enum),          // 'low' | 'normal' | 'high' | 'urgent'
  adminRemarks: String,             // Admin notes
  imageUrl: String,                 // Image 1 URL
  imageUrl2: String,                // Image 2 URL
  imageUrl3: String,                // Image 3 URL
  contactPhone: String,             // Contact number
  wardNumber: String,               // Ward identifier
  isPublic: Boolean,                // Show in public board
  estimatedResolutionDays: Number,  // SLA
  resolvedAt: Date,                 // Resolution timestamp
  assignedTo: String,               // Assigned admin
  feedback: {                       // Embedded feedback
    rating: Number (1-5),
    comment: String,
    submittedAt: Date
  }
}, { timestamps: true });

// Indexes:
- trackingId (unique)
- userId (for "my complaints")
- status (for filtering)
- category (for analytics)
- createdAt (for sorting)
- isPublic (for public board)
```

---

### `/backend/src/routes/` - API Route Definitions

```
routes/
├── auth.routes.js                  # /api/auth/*
├── complaint.routes.js             # /api/complaints/*
├── admin.routes.js                 # /api/admin/*
├── announcement.routes.js          # /api/announcements/*
├── engagement.routes.js            # /api/engagement/*
├── tenant.routes.js                # /api/tenant/*
├── super-admin.routes.js           # /api/super-admin/*
├── translate.routes.js             # /api/translate/*
└── user.routes.js                  # /api/users/*
```

#### complaint.routes.js - Route Table:

```javascript
const router = express.Router();

// Public routes (no auth)
router.post('/track', trackComplaint);              // Track by trackingId
router.get('/public', getPublicComplaints);         // Public complaint board

// Citizen routes (auth + approved)
router.post('/', verifyToken, requireApprovedUser, createComplaint);
router.get('/my-complaints', verifyToken, requireApprovedUser, getMyComplaints);
router.get('/:id', verifyToken, requireApprovedUser, getComplaintById);
router.put('/:id', verifyToken, requireApprovedUser, updateComplaint);
router.delete('/:id', verifyToken, requireApprovedUser, deleteComplaint);

// AI routes
router.post('/find-duplicates', verifyToken, findDuplicates);
router.post('/enrich', verifyToken, enrichContext);

// Admin routes
router.get('/admin/all', verifyToken, requireAdmin, getAllComplaints);
router.put('/admin/:id/assign', verifyToken, requireAdmin, assignComplaint);
router.put('/admin/:id/status', verifyToken, requireAdmin, updateComplaintStatus);
```

---

### `/backend/src/utils/` - Utility Functions

```
utils/
└── logger.js                       # Logging utilities
```

---

## 🎨 Frontend Deep Dive

### `/frontend/src/` - Source Code

```
src/
├── App.jsx                         # Root component, route definitions
├── main.jsx                        # React entry point, ReactDOM.render()
├── index.css                       # Global Tailwind imports
├── components/                     # Reusable UI components
│   ├── auth/                      # Authentication components
│   ├── common/                    # Shared components
│   ├── dashboard/                 # Dashboard widgets
│   └── engagement/                # Engagement components
├── config/                         # Configuration
│   └── firebase.js                # Firebase client SDK
├── context/                        # React Context API
│   ├── AuthContext.jsx            # Authentication state
│   └── TranslationContext.jsx     # Multi-language state
├── hooks/                          # Custom React hooks
│   ├── useAuth.js                 # Auth hook (wrapper for AuthContext)
│   └── useTranslation.js          # Translation hook
├── layouts/                        # Page layouts
│   ├── PublicLayout.jsx           # Layout for public pages
│   ├── DashboardLayout.jsx        # Layout for citizen pages
│   └── AdminLayout.jsx            # Layout for admin pages
├── pages/                          # Page components (routes)
│   ├── HomePage.jsx               # Landing page
│   ├── auth/                      # Auth pages
│   ├── citizen/                   # Citizen pages
│   ├── admin/                     # Admin pages
│   ├── engagement/                # Engagement pages
│   ├── public/                    # Public pages
│   └── status/                    # Status pages
└── services/                       # API integration
    └── api.js                     # Axios instance with interceptors
```

---

### `/frontend/src/App.jsx` - Root Component

**Purpose**: Define all routes and layouts

```javascript
function App() {
  return (
    <TranslationProvider>
      <AuthProvider>
        <Router>
          <Toaster />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Citizen Routes (Protected) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
              <Route path="/citizen/my-complaints" element={<MyComplaints />} />
              <Route path="/citizen/new-complaint" element={<NewComplaint />} />
            </Route>
            
            {/* Admin Routes (Admin Only) */}
            <Route element={<AdminRoute />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/manage-complaints" element={<ManageComplaints />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </TranslationProvider>
  );
}
```

---

### `/frontend/src/context/AuthContext.jsx` - Authentication State

**Purpose**: Manage global authentication state

```javascript
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    isAdmin,
    login,
    signup,
    logout,
    registerProfile,
    fetchUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

---

### `/frontend/src/services/api.js` - Axios Instance

**Purpose**: Centralized HTTP client with interceptors

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000
});

// Request interceptor: Add Authorization header
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      toast.error('Session expired. Please login again.');
      // Redirect to login
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### `/frontend/src/pages/` - Page Components

#### Citizen Pages:
```
pages/citizen/
├── Dashboard.jsx                   # Overview stats
├── MyComplaints.jsx                # List user's complaints
├── NewComplaint.jsx                # Submit new complaint
├── ComplaintDetail.jsx             # View single complaint
├── Announcements.jsx               # View announcements
└── Profile.jsx                     # User profile settings
```

#### Admin Pages:
```
pages/admin/
├── Dashboard.jsx                   # Admin overview
├── ManageUsers.jsx                 # Approve/reject users
├── ManageComplaints.jsx            # All complaints management
├── ManageAnnouncements.jsx         # Create/edit announcements
├── ManageEngagement.jsx            # Manage polls, meetings, etc.
└── Analytics.jsx                   # Charts and insights
```

---

### `/frontend/src/components/` - Reusable Components

#### Common Components:
```
components/common/
├── Header.jsx                      # App header
├── Footer.jsx                      # App footer
├── Navbar.jsx                      # Navigation bar
├── Sidebar.jsx                     # Side navigation
├── LoadingSpinner.jsx              # Loading indicator
├── ErrorBoundary.jsx               # Error handling
├── Modal.jsx                       # Reusable modal
├── Card.jsx                        # Card container
├── Button.jsx                      # Styled button
└── Badge.jsx                       # Status badges
```

#### Auth Components:
```
components/auth/
├── ProtectedRoute.jsx              # Require authentication
├── AdminRoute.jsx                  # Require admin role
└── LoginForm.jsx                   # Login form fields
```

---

## 📚 Design Patterns Used

### 1. **MVC (Model-View-Controller)**
- **Model**: `/backend/src/models/` - Mongoose schemas
- **View**: `/frontend/src/pages/` - React components
- **Controller**: `/backend/src/controllers/` - Request handlers

### 2. **Service Layer Pattern**
- AI services separated from controllers
- Business logic in `/backend/src/ai/`

### 3. **Middleware Pattern**
- Express middleware for cross-cutting concerns
- Auth, logging, error handling

### 4. **Repository Pattern**
- Mongoose models abstract database operations

### 5. **Context Provider Pattern**
- React Context API for global state
- AuthContext, TranslationContext

### 6. **Higher-Order Components (HOC)**
- ProtectedRoute, AdminRoute

### 7. **Factory Pattern**
- AI service initialization with graceful loading

---

## 🎯 Key Takeaways for Interviews

**When asked "Explain your folder structure":**

> "I organized the project into a modular structure following MVC architecture with an additional service layer for AI. 
>
> The **backend** has clear separation: 
> - Routes define endpoints
> - Middleware handles auth and validation
> - Controllers handle requests
> - Models define schemas
> - AI services contain business logic (17 intelligent services in phases)
>
> The **frontend** follows component-based architecture:
> - Pages are route components
> - Components are reusable UI elements
> - Context provides global state
> - Services handle API calls with interceptors
> - Layouts define page templates
>
> This structure makes it easy to test, scale, and maintain. For example, I can test AI services independently without touching controllers, and I can swap out authentication without changing route logic."

---

## 🔗 Related Documentation

- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Project summary
- [ARCHITECTURE_DETAILED.md](./ARCHITECTURE_DETAILED.md) - System architecture
- [BACKEND_DETAILED.md](./BACKEND_DETAILED.md) - Backend deep dive
- [FRONTEND_DETAILED.md](./FRONTEND_DETAILED.md) - Frontend deep dive
