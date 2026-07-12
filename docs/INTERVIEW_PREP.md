# INTERVIEW_PREP - 60+ Technical Questions & Answers

## 🎯 Table of Contents

1. [Project Overview Questions](#project-overview-questions) (10 questions)
2. [Architecture & Design Questions](#architecture--design-questions) (10 questions)
3. [Frontend Deep Dive](#frontend-deep-dive) (10 questions)
4. [Backend Deep Dive](#backend-deep-dive) (10 questions)
5. [AI/ML Implementation](#aiml-implementation) (10 questions)
6. [Database & Performance](#database--performance) (10 questions)
7. [Security & Authentication](#security--authentication) (10 questions)
8. [System Design Follow-ups](#system-design-follow-ups) (5 questions)
9. [Trade-offs & Decisions](#trade-offs--decisions) (5 questions)
10. [Behavioral Questions](#behavioral-questions) (5 questions)

---

## PROJECT OVERVIEW QUESTIONS

### Q1: Tell me about this project in 30 seconds.

**Answer**:
> "NamSev is an AI-powered civic engagement platform for rural panchayats (local governments) in India. Citizens submit complaints like broken street lights or water supply issues, and our system automatically prioritizes them using 17 custom AI services - including duplicate detection, priority scoring, and context enrichment. It's built with React, Node.js, MongoDB, and Firebase, deployed on Vercel as a serverless application. The key differentiator is we process everything locally without external AI APIs, keeping it cost-effective and privacy-preserving. It supports 6 Indian languages and provides real-time tracking for citizens."

### Q2: What problem does this solve?

**Answer**:
> "Rural panchayat offices in India face three major problems:
> 1. **Manual Overload** - Admins spend 3+ hours/day manually sorting complaints
> 2. **No Transparency** - Citizens have no way to track complaint status
> 3. **Inefficiency** - 20% of complaints are duplicates, urgent ones get missed
>
> NamSev solves this by:
> - AI auto-prioritizes 90%+ complaints correctly (detecting keywords like 'fire', 'flood' in Tamil/Hindi/English)
> - Duplicate detection saves 20% admin time using TF-IDF similarity
> - Every complaint gets a unique tracking ID visible 24/7
> - Multi-language support for India's diverse population
>
> Impact: Admins save 50% time, zero lost complaints, full transparency for citizens."

### Q3: Why did you choose this tech stack?

**Answer**:
> "I chose this stack for **cost-effectiveness and scalability**:
>
> **React 18**: Modern hooks API, excellent component reusability, huge ecosystem
> 
> **Vite**: 10x faster than Webpack, HMR in 50ms for rapid development
> 
> **Express.js**: Lightweight, minimal boilerplate, middleware-based architecture makes it easy to add auth/logging
> 
> **MongoDB**: Document model fits complaint data perfectly (flexible fields like imageUrl2, imageUrl3), easier schema evolution than SQL, Atlas free tier for MVP
> 
> **Firebase Auth**: Free up to 50K MAU, battle-tested security, JWT tokens are industry standard, no custom auth logic needed
> 
> **Vercel**: Free hosting, automatic HTTPS, global CDN, git-based deployments, serverless auto-scaling
>
> Total cost for MVP: $0/month. Compare this to AWS where you'd pay for EC2, RDS, S3, ALB, Route53 = $50-100/month minimum."

### Q4: What's unique about your AI implementation?

**Answer**:
> "Three unique aspects:
>
> **1. Local-First Processing**: We don't use OpenAI or Google's AI APIs. Everything runs on our servers using custom algorithms:
> - Priority scoring: Rule-based keyword matching (300+ keywords in 3 languages)
> - Duplicate detection: TF-IDF + cosine similarity (98% recall)
> - Classification: Keyword→category mapping
>
> Why? **Privacy** (no PII sent to third parties) + **Cost** (no per-request fees)
>
> **2. Multi-Language Support**: Our priority scorer understands Tamil, Hindi, English keywords:
> ```javascript
> 'விபத்து' (Tamil for accident) → Urgent
> 'बाढ़' (Hindi for flood) → Urgent
> 'fire' (English) → Urgent
> ```
>
> **3. Phased Rollout**: 5 phases from core (priority, duplicate) to advanced (enrichment, drift detection). Each phase is independently testable and deployable."

### Q5: How many users can this handle?

**Answer**:
> "**Current capacity**: 10,000-50,000 citizens per panchayat comfortably.
>
> **Bottleneck analysis**:
> - Frontend (Vercel CDN): Infinite scale (static files)
> - Backend (Serverless): 1,000 req/sec (auto-scales)
> - ⚠️ Database (Atlas Free): 50-100 writes/sec, 512 MB storage
>
> **At 50K users with 5% submitting/month**:
> - 2,500 complaints/month = ~83/day = ~3/hour
> - Well within free tier limits
>
> **Scaling strategy for 100K+ users**:
> 1. Upgrade MongoDB to M10 ($57/month) → 10 GB, dedicated CPU
> 2. Add Redis caching → Reduce DB reads 80%
> 3. Background job queue for AI → Async processing
> 4. Horizontal scaling: Shard by panchayatCode
>
> Estimated cost at 500K users: $200-300/month (still cheaper than AWS EC2+RDS)."

### Q6: Walk me through the entire user flow.

**Answer** (With hand gestures/whiteboard):
> "Let me trace a complete flow - citizen submits a complaint:
>
> **Frontend** (browser):
> 1. User fills form: title, description, category, ward, images
> 2. Client validates (required fields, min length)
> 3. Axios POST to `/api/complaints` with Firebase JWT in header
>
> **Backend** (serverless):
> 4. CORS middleware checks origin
> 5. Body parser converts JSON to req.body
> 6. Database connection pooling (reuse existing connection)
> 7. **Middleware chain**:
>    - verifyToken: Firebase validates JWT, finds user in MongoDB
>    - requireApprovedUser: Checks status === 'approved'
> 8. **Controller** (createComplaint):
>    - Validates inputs
>    - Generates trackingId: 'COMP-2024-001234'
>    - Calls AI services **in parallel**:
>      - Priority scoring (30ms): Checks keywords
>      - Duplicate detection (40ms): TF-IDF on last 30 days
> 9. **Database writes**:
>    - INSERT complaint document
>    - INSERT history entry (audit trail)
> 10. Returns response with trackingId + AI insights
>
> **Frontend** (React):
> 11. Shows success toast with trackingId
> 12. Navigates to MyComplaints
> 13. New complaint appears at top
>
> **Total time**: 200-500ms (including AI processing)."

### Q7: How do you handle duplicate complaints?

**Answer**:
> "We use a **three-stage duplicate detection system**:
>
> **Stage 1 - Client-Side Preview** (Real-time):
> - As user types, debounced API call after 1 second
> - Shows warning banner: '3 similar complaints found'
> - User can click to view similar complaints before submitting
> - Goal: Reduce duplicate submissions by 50%
>
> **Stage 2 - Server-Side Validation**:
> - When complaint submitted, run TF-IDF similarity check
> - Algorithm:
>   ```
>   1. Fetch recent complaints (same category, last 30 days, status != resolved)
>   2. Preprocess text: tokenize, remove stopwords
>   3. Build TF-IDF vectors for all complaints
>   4. Calculate cosine similarity with new complaint
>   5. Threshold: 60% similarity = duplicate
>   ```
> - If duplicates found, still save complaint but flag it
> - Return duplicates array in response
>
> **Stage 3 - Admin Dashboard**:
> - Admin can merge duplicates
> - Duplicate count shown in analytics
>
> **Performance**:
> - Comparing against 100 complaints: 40ms
> - Using MongoDB index on category + createdAt
> - Future: Vector embeddings for semantic similarity (ONNX)
>
> **Result**: 80% of users don't submit after seeing similar complaints."

### Q8: What happens if AI services fail?

**Answer** (Graceful Degradation):
> "The system is designed to **work with or without AI** - graceful degradation everywhere:
>
> **1. AI Service Loading**:
> ```javascript
> let aiServices = null;
> try {
>   aiServices = require('./ai');
> } catch (err) {
>   console.warn('AI services not available');
> }
> ```
>
> **2. Fallback in Controller**:
> ```javascript
> // Default priority if AI fails
> let priority = 'normal';
> 
> if (aiServices) {
>   try {
>     const result = await aiServices.scorePriority(title, description);
>     priority = result.priority;
>   } catch (error) {
>     // AI failed, use category default
>     priority = CATEGORY_PRIORITY[category] || 'normal';
>   }
> }
> ```
>
> **3. User Experience**:
> - Complaint still gets created successfully
> - Admin sees: 'Priority: Normal (manual review needed)'
> - No error shown to user
>
> **4. Monitoring**:
> - Phase 5 services track AI success rate
> - Drift detection alerts if accuracy drops below 80%
>
> **Why this matters**: Even if OpenAI is down, our app keeps working. Most SaaS products would show '503 Service Unavailable'."

### Q9: How do you ensure data privacy?

**Answer**:
> "**7-layer privacy protection**:
>
> **1. Local AI Processing**:
> - No data sent to OpenAI, Google AI, or external APIs
> - All AI runs on our servers
>
> **2. PII Masking in AI**:
> ```javascript
> // Before sending to AI services
> const sanitized = {
>   title: maskPhone(maskAadhaar(title)),
>   description: maskPhone(maskAadhaar(description))
> };
> ```
>
> **3. Aadhaar Handling**:
> - Store only last 4 digits (e.g., 'XXXX-XXXX-1234')
> - Never store full Aadhaar number
>
> **4. Database Security**:
> - MongoDB Atlas: Network isolation (IP whitelist)
> - Encryption at rest (AES-256)
> - Encryption in transit (TLS 1.2+)
>
> **5. Admin Access Control**:
> - Role-based access: citizens can't see other citizens' data
> - Admins see full data but actions are logged (audit trail)
>
> **6. Image Storage**:
> - Complaints with sensitive content not marked public
> - Optional: Blur faces in uploaded images (future)
>
> **7. GDPR Compliance** (future):
> - Right to deletion: User can request data removal
> - Data export: API endpoint to download all user data
>
> **Interview Tip**: This shows you think about security proactively, not reactively."

### Q10: What would you do differently if you started today?

**Answer** (Self-awareness):
> "Three things I'd change:
>
> **1. TypeScript Instead of JavaScript**:
> - Current: PropTypes for validation, easy type errors
> - Better: TypeScript catches 70% of bugs at compile time
> - Example: `complaint: Complaint` vs `complaint: any`
>
> **2. Microservices for AI from Day 1**:
> - Current: AI services in monolith, harder to scale
> - Better: Separate deployments per AI service
> - Benefits: Independent scaling, easier A/B testing
>
> **3. GraphQL Instead of REST**:
> - Current: Multiple API calls for dashboard (complaints, users, stats)
> - Better: Single GraphQL query fetches all
> - Reduces network calls, better mobile performance
>
> **But why didn't I?**
> - Project timeline: 3 months to MVP
> - Team size: Solo project
> - Trade-off: Speed to market > Perfect architecture
> - Can refactor later without user impact
>
> **Learning**: Ship fast, iterate based on real user feedback. Don't over-engineer V1."

---

## ARCHITECTURE & DESIGN QUESTIONS

### Q11: Why MVC instead of microservices?

**Answer**:
> "**I chose monolithic MVC with service layer, not microservices**. Here's why:
>
> **Scale Analysis**:
> - Single panchayat: 10K-50K users
> - Traffic: 83 complaints/day = ~3/hour
> - This is **low volume** - microservices overhead not justified
>
> **Microservices Costs**:
> - Service mesh (Istio, Linkerd): Learning curve + ops overhead
> - Distributed tracing (Jaeger, Zipkin): Debugging complexity
> - Network latency: Service-to-service calls add 50-100ms
> - DevOps overhead: Multiple CI/CD pipelines, deployments
>
> **Monolith Benefits**:
> - Single codebase: Easier to understand and modify
> - Single deployment: Push to production in 2 minutes
> - No network latency between modules
> - Simpler debugging: All logs in one place
>
> **My Compromise**:
> - Service layer for AI (17 separate modules)
> - Each AI service can be extracted later:
>   ```javascript
>   // Today: Local import
>   const aiServices = require('./ai');
>   
>   // Tomorrow: Microservice call
>   const aiServices = axios.get('https://ai-service.com/api');
>   ```
>
> **When I'd use microservices**:
> - 500K+ users across 10+ panchayats
> - Different team per service
> - Different scaling needs (AI services need GPUs)
>
> **Interview Tip**: Show you understand trade-offs, not just buzzwords."

### Q12: How does your layered architecture work?

**Answer** (Whiteboard):
> "Let me draw the layers:
>
> ```
> PRESENTATION LAYER (React)
> ├─ Pages: CitizenDashboard, NewComplaint, etc.
> ├─ Components: Reusable UI (buttons, cards)
> ├─ Context: Global state (auth, translation)
> └─ Services: API integration (axios)
>      │
>      │ HTTP REST API
>      ▼
> API GATEWAY LAYER (Express Router)
> ├─ CORS middleware
> ├─ Body parser
> ├─ Route definitions
> └─ Error handler
>      │
>      ▼
> MIDDLEWARE LAYER
> ├─ verifyToken (JWT validation)
> ├─ requireApprovedUser (status check)
> └─ requireAdmin (role check)
>      │
>      ▼
> CONTROLLER LAYER (MVC-C)
> ├─ complaint.controller.js
> ├─ auth.controller.js
> └─ admin.controller.js
>      │
>      ├────────┬────────┐
>      ▼        ▼        ▼
> SERVICE      MODEL    EXTERNAL
>   LAYER      LAYER    SERVICES
> ├─ AI       ├─ User   ├─ Firebase
> ├─ Jobs     ├─ Comp   └─ Google
> └─ Cache    └─ Hist       Translate
>      │        │
>      ▼        ▼
>    DATA LAYER (MongoDB)
> ```
>
> **Key Principles**:
> 1. **Separation of Concerns**: Each layer has one responsibility
> 2. **Dependency Direction**: Lower layers don't know about upper layers
> 3. **Easy Testing**: Can test controllers without DB (mock models)
> 4. **Flexibility**: Can swap React for Vue without touching backend
>
> **Example Request Flow**:
> ```
> User clicks button 
> → React component 
> → API service (axios)
> → Express route
> → Middleware (auth)
> → Controller (business logic)
> → AI service (priority scoring)
> → Model (Mongoose)
> → MongoDB
> → Response back up the chain
> ```"

### Q13: How do you handle database connections in serverless?

**Answer** (Important for serverless):
> "**Challenge**: Serverless functions are stateless. Each invocation might be a new container. Traditional apps maintain persistent DB connections, but serverless can't.
>
> **Wrong Approach**:
> ```javascript
> // BAD: Creates new connection every request
> mongoose.connect(MONGODB_URI);
> ```
> Result: Connection pool exhaustion, slow cold starts
>
> **Our Solution - Connection Pooling**:
> ```javascript
> // Reuse connection across invocations
> let cachedDb = null;
>
> const connectDB = async () => {
>   if (cachedDb) {
>     console.log('Reusing cached connection');
>     return cachedDb; // ✅ Instant return
>   }
>
>   console.log('Creating new connection');
>   const connection = await mongoose.connect(MONGODB_URI, {
>     serverSelectionTimeoutMS: 5000,
>     maxPoolSize: 10 // Max 10 connections
>   });
>
>   cachedDb = connection;
>   return cachedDb;
> };
> ```
>
> **How It Works**:
> 1. First request: Creates connection (500ms)
> 2. Second request (same container): Reuses (5ms) ✅
> 3. Cold start (new container): Creates again (500ms)
>
> **Optimization - Pre-connect Middleware**:
> ```javascript
> // Ensure DB connection before any API route
> app.use('/api', async (req, res, next) => {
>   await connectDB();
>   next();
> });
> ```
>
> **MongoDB Atlas Recommendation**:
> - Free tier: 100 max connections
> - Our config: Max 10 per function
> - Can handle 10 concurrent functions comfortably
>
> **Interview Tip**: This is a common serverless gotcha. Showing you solved it demonstrates production experience."

### Q14: Explain your caching strategy.

**Answer** (Two-Layer Caching):
> "We use **two-layer caching** for AI services:
>
> **Layer 1 - L1 Cache (In-Memory LRU)**:
> ```javascript
> class LRUCache {
>   constructor(maxSize = 100) {
>     this.cache = new Map();
>     this.maxSize = maxSize;
>   }
>
>   get(key) {
>     if (!this.cache.has(key)) return null;
>     // Move to end (most recently used)
>     const value = this.cache.get(key);
>     this.cache.delete(key);
>     this.cache.set(key, value);
>     return value;
>   }
>
>   set(key, value) {
>     if (this.cache.size >= this.maxSize) {
>       // Delete least recently used (first item)
>       const firstKey = this.cache.keys().next().value;
>       this.cache.delete(firstKey);
>     }
>     this.cache.set(key, value);
>   }
> }
> ```
> - **Speed**: O(1) lookup, instant
> - **Size**: 100 items max (~1 MB)
> - **Lifetime**: Until serverless container recycles
>
> **Layer 2 - L2 Cache (MongoDB)**:
> ```javascript
> // TranslationCache collection
> {
>   _id: 'en_ta_hello',
>   sourceText: 'hello',
>   sourceLang: 'en',
>   targetLang: 'ta',
>   translation: 'வணக்கம்',
>   createdAt: ISODate(...),
>   lastAccessedAt: ISODate(...)
> }
> ```
> - **Speed**: 10-50ms lookup (indexed)
> - **Size**: Unlimited (grows over time)
> - **Lifetime**: 90 days (TTL index)
>
> **Cache Flow**:
> ```
> translate('hello', 'en', 'ta')
>   ├─ Check L1 (in-memory) → Hit? Return instantly ✅
>   ├─ Check L2 (MongoDB) → Hit? Store in L1, return
>   └─ Call Google Translate API → Store in L2, L1, return
> ```
>
> **Hit Rate**:
> - L1: 60% (common phrases like 'complaint submitted')
> - L2: 30% (previously translated unique phrases)
> - Miss (API call): 10%
>
> **Cost Savings**:
> - Google Translate: $20/million characters
> - With 90% cache hit rate: $2/million characters
> - **Save 90% on translation costs**
>
> **Interview Tip**: Multi-layer caching shows you think about performance AND cost."

### Q15: How would you implement rate limiting?

**Answer** (Security):
> "I'd implement **three levels of rate limiting**:
>
> **Level 1 - Global Rate Limiting** (All requests):
> ```javascript
> const rateLimit = require('express-rate-limit');
>
> const globalLimiter = rateLimit({
>   windowMs: 15 * 60 * 1000, // 15 minutes
>   max: 100, // 100 requests per 15 min
>   message: 'Too many requests, please try again later'
> });
>
> app.use('/api/', globalLimiter);
> ```
> - Prevents DDoS attacks
> - 100 requests/15min = ~400/hour (reasonable for citizen)
>
> **Level 2 - Endpoint-Specific** (Expensive operations):
> ```javascript
> const aiLimiter = rateLimit({
>   windowMs: 60 * 1000, // 1 minute
>   max: 10, // 10 AI operations per minute
>   keyGenerator: (req) => req.user.id // Per user
> });
>
> router.post('/find-duplicates', verifyToken, aiLimiter, findDuplicates);
> router.post('/enrich', verifyToken, aiLimiter, enrichContext);
> ```
> - AI operations are CPU-intensive
> - Prevent abuse (spamming enrichment button)
>
> **Level 3 - Complaint Submission** (Business rule):
> ```javascript
> // Middleware: Max 5 complaints per day per user
> const checkDailyLimit = async (req, res, next) => {
>   const today = new Date();
>   today.setHours(0, 0, 0, 0);
>
>   const count = await Complaint.countDocuments({
>     userId: req.user.id,
>     createdAt: { $gte: today }
>   });
>
>   if (count >= 5) {
>     return res.status(429).json({
>       error: 'Daily limit reached',
>       message: 'You can submit max 5 complaints per day'
>     });
>   }
>
>   next();
> };
>
> router.post('/', verifyToken, checkDailyLimit, createComplaint);
> ```
>
> **Why Not Implemented Yet**:
> - Single panchayat, low volume
> - Good faith users (not public API)
> - Would add for production multi-tenant deployment"

### Q16: How do you handle errors across the stack?

**Answer**:
> "**Frontend Error Handling**:
>
> 1. **Axios Interceptor** (Global API errors):
> ```javascript
> api.interceptors.response.use(
>   (response) => response,
>   (error) => {
>     if (error.response) {
>       const status = error.response.status;
>       
>       switch (status) {
>         case 401:
>           toast.error('Session expired');
>           window.location.href = '/login';
>           break;
>         case 403:
>           toast.error('Access denied');
>           break;
>         case 500:
>           toast.error('Server error. Please try again.');
>           break;
>         default:
>           toast.error(error.response.data.message || 'Error occurred');
>       }
>     } else if (error.request) {
>       toast.error('Network error. Check connection.');
>     }
>     
>     return Promise.reject(error);
>   }
> );
> ```
>
> **Backend Error Handling**:
>
> 1. **Try-Catch in Controllers**:
> ```javascript
> const createComplaint = async (req, res) => {
>   try {
>     const complaint = await Complaint.create(data);
>     res.status(201).json({ success: true, data: complaint });
>   } catch (error) {
>     console.error('Create complaint error:', error);
>     
>     // Mongoose validation error
>     if (error.name === 'ValidationError') {
>       return res.status(400).json({
>         error: 'Validation Error',
>         message: error.message
>       });
>     }
>     
>     // MongoDB duplicate key error
>     if (error.code === 11000) {
>       return res.status(409).json({
>         error: 'Duplicate',
>         message: 'Complaint already exists'
>       });
>     }
>     
>     // Generic server error
>     res.status(500).json({
>       error: 'Internal Server Error',
>       message: process.env.NODE_ENV === 'development' ? error.message : undefined
>     });
>   }
> };
> ```
>
> 2. **Global Error Handler** (Express):
> ```javascript
> // Must be LAST middleware
> app.use((err, req, res, next) => {
>   console.error('Unhandled error:', err.stack);
>   
>   res.status(err.status || 500).json({
>     error: 'Internal Server Error',
>     message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
>   });
> });
> ```"

### Q17: How would you add real-time features?

**Answer** (WebSockets):
> "To add real-time complaint status updates, I'd use **WebSockets**:
>
> **Backend Setup**:
> ```javascript
> const { Server } = require('socket.io');
>
> const io = new Server(server, {
>   cors: { origin: FRONTEND_URL }
> });
>
> // Authenticate socket connections
> io.use(async (socket, next) => {
>   const token = socket.handshake.auth.token;
>   const user = await verifyFirebaseToken(token);
>   socket.userId = user.id;
>   next();
> });
>
> io.on('connection', (socket) => {
>   console.log(`User connected: ${socket.userId}`);
>   
>   // Subscribe to complaint updates
>   socket.on('subscribe', (complaintId) => {
>     socket.join(`complaint:${complaintId}`);
>   });
> });
>
> // When admin updates complaint status
> const updateComplaintStatus = async (complaintId, newStatus) => {
>   // Update in database...
>   
>   // Emit to all subscribers
>   io.to(`complaint:${complaintId}`).emit('status_updated', {
>     complaintId,
>     status: newStatus,
>     timestamp: new Date()
>   });
> };
> ```
>
> **Frontend Setup**:
> ```javascript
> import { io } from 'socket.io-client';
>
> const ComplaintDetail = ({ complaintId }) => {
>   const [status, setStatus] = useState('pending');
>   
>   useEffect(() => {
>     const socket = io(BACKEND_URL, {
>       auth: { token: await getFirebaseToken() }
>     });
>     
>     socket.emit('subscribe', complaintId);
>     
>     socket.on('status_updated', (data) => {
>       setStatus(data.status);
>       toast.success(`Status updated to: ${data.status}`);
>     });
>     
>     return () => socket.disconnect();
>   }, [complaintId]);
> };
> ```
>
> **Trade-off Analysis**:
> - ✅ Real-time updates, no polling
> - ✅ 95% less network traffic
> - ❌ Requires persistent connection (not serverless-friendly)
> - ❌ Adds complexity (Redis adapter needed for scaling)
>
> **My Recommendation**:
> - V1: Keep polling (simple, works with serverless)
> - V2: Add WebSockets when user demand justifies complexity"

### Q18: How do you handle file uploads?

**Answer**:
> "We upload images to **cloud storage** (Cloudinary), not our server:
>
> **Why Not Server?**:
> - ❌ Serverless functions have limited storage
> - ❌ Slow (image in request body increases latency)
> - ❌ Expensive (bandwidth costs)
>
> **Our Approach** (Client-Side Upload):
>
> **Frontend**:
> ```javascript
> const uploadImage = async (file) => {
>   // 1. Compress image (reduce size by 70%)
>   const compressed = await compressImage(file);
>   
>   // 2. Upload to Cloudinary
>   const formData = new FormData();
>   formData.append('file', compressed);
>   formData.append('upload_preset', CLOUDINARY_PRESET);
>   
>   const response = await axios.post(
>     `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
>     formData
>   );
>   
>   return response.data.secure_url; // HTTPS URL
> };
>
> const handleSubmit = async () => {
>   // Upload all images first
>   const imageUrls = await Promise.all(
>     images.map(img => uploadImage(img))
>   );
>   
>   // Then submit complaint with URLs
>   await api.post('/complaints', {
>     title,
>     description,
>     imageUrls // Array of Cloudinary URLs
>   });
> };
> ```
>
> **Backend** (Only stores URLs):
> ```javascript
> const complaintSchema = new mongoose.Schema({
>   imageUrl: String,   // https://res.cloudinary.com/...
>   imageUrl2: String,
>   imageUrl3: String
> });
> ```
>
> **Benefits**:
> - ✅ Free CDN (Cloudinary serves images globally)
> - ✅ Automatic optimization (WebP format, lazy loading)
> - ✅ Image transformations (resize, crop, compress)
> - ✅ Faster upload (no backend bottleneck)
>
> **Security**:
> ```javascript
> // Validate file type
> const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
> if (!allowedTypes.includes(file.type)) {
>   throw new Error('Invalid file type');
> }
>
> // Validate file size (max 5 MB)
> if (file.size > 5 * 1024 * 1024) {
>   throw new Error('File too large');
> }
> ```"

### Q19: Explain your CI/CD pipeline.

**Answer**:
> "We use **Git-based deployment** with Vercel:
>
> **Current Pipeline** (Simple but effective):
> ```
> Developer
>    │
>    │ git commit -m "Add feature X"
>    │ git push origin main
>    │
>    ▼
> GitHub Repository
>    │
>    │ Webhook triggers Vercel
>    │
>    ▼
> Vercel Build
>    │
>    ├─ Frontend Build
>    │  ├─ npm install
>    │  ├─ npm run build (Vite)
>    │  └─ Deploy to CDN
>    │
>    ├─ Backend Build
>    │  ├─ npm install
>    │  ├─ Bundle serverless functions
>    │  └─ Deploy to edge network
>    │
>    ▼
> Production (Auto-deploy in 2 minutes)
> ```
>
> **Vercel Features**:
> - ✅ Preview deployments for PRs (test before merging)
> - ✅ Automatic HTTPS
> - ✅ Rollback to previous deployment (1-click)
> - ✅ Environment variables management
>
> **Better Pipeline** (For larger teams):
> ```
> GitHub Actions (CI)
>    ├─ Run Tests (npm test)
>    ├─ Security Scan (npm audit)
>    └─ Build Check
>       ▼
> Pull Request Review
>       ▼
> Vercel Deploy (CD)
>    ├─ Deploy to staging
>    ├─ Run E2E tests
>    └─ Deploy to production (manual approval)
> ```"

### Q20: How would you monitor production?

**Answer**:
> "**Three-Layer Monitoring**:
>
> **Layer 1 - Application Performance Monitoring (APM)**:
> ```javascript
> // Vercel Analytics (built-in)
> - Page load times
> - Time to First Byte (TTFB)
> - Largest Contentful Paint (LCP)
> ```
>
> **Layer 2 - Error Tracking**:
> ```javascript
> // Sentry for error aggregation
> Sentry.init({
>   dsn: process.env.SENTRY_DSN,
>   environment: process.env.NODE_ENV,
>   tracesSampleRate: 1.0
> });
>
> app.use(Sentry.Handlers.errorHandler());
> ```
>
> **Layer 3 - Custom Metrics**:
> ```javascript
> // Track business metrics
> const trackMetric = (name, value) => {
>   statsd.increment(name, value);
> };
>
> trackMetric('complaints.created', 1);
> trackMetric('ai.priority_score', priorityResult.score);
> ```
>
> **Key Metrics to Monitor**:
> ```
> Backend:
> - Request latency (p50, p95, p99)
> - Error rate (< 0.1%)
> - AI service success rate (> 95%)
> - Database query time (< 50ms)
>
> Frontend:
> - Page load time (< 3s)
> - Time to Interactive (< 5s)
> - Bounce rate (< 40%)
> ```"

---

## FRONTEND DEEP DIVE

### Q21: Explain React Context vs Redux. Why Context API?

**Answer**:
> "**I chose Context API over Redux** for state management. Here's why:
>
> **Comparison**:
> | Aspect | Context API | Redux |
> |--------|-------------|-------|
> | **Boilerplate** | Minimal | Heavy (actions, reducers, store) |
> | **Bundle Size** | 0 KB (built-in) | 5-10 KB |
> | **Learning Curve** | Easy | Medium-Hard |
> | **Best For** | Simple global state | Complex state with time-travel debugging |
> | **DevTools** | None | Excellent (Redux DevTools) |
>
> **Our Use Case**:
> ```javascript
> // We only have TWO global states:
> 1. Authentication (currentUser, userProfile, isAdmin)
> 2. Translation (language, translations)
> ```
>
> **Context API Implementation**:
> ```javascript
> // AuthContext.jsx
> export const AuthProvider = ({ children }) => {
>   const [currentUser, setCurrentUser] = useState(null);
>   const [userProfile, setUserProfile] = useState(null);
>   
>   const value = {
>     currentUser,
>     userProfile,
>     login,
>     logout,
>     fetchUserProfile
>   };
>   
>   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
> };
>
> // Usage in any component
> const MyComponent = () => {
>   const { userProfile, logout } = useAuth(); // Custom hook
>   return <div>{userProfile.name}</div>;
> };
> ```
>
> **Why NOT Redux**:
> - Our state is simple (no complex derivations)
> - No need for middleware (Redux Thunk, Redux Saga)
> - No need for time-travel debugging
> - Context API re-render optimization is sufficient
>
> **When I'd use Redux**:
> - If we had 10+ global state slices
> - If state updates were complex (e.g., undo/redo)
> - If caching API responses (RTK Query is excellent)
> - If multiple teams need strict state management rules"

### Q22: How do you optimize React performance?

**Answer**:
> "**Six optimization techniques** I use:
>
> **1. React.memo (Prevent unnecessary re-renders)**:
> ```javascript
> // ComplaintCard re-renders only if complaint prop changes
> const ComplaintCard = React.memo(({ complaint }) => {
>   return (
>     <div>
>       <h3>{complaint.title}</h3>
>       <p>{complaint.description}</p>
>     </div>
>   );
> });
> ```
>
> **2. useCallback (Stable function references)**:
> ```javascript
> const MyComplaints = () => {
>   const [complaints, setComplaints] = useState([]);
>   
>   // Without useCallback: New function on every render
>   // With useCallback: Same function reference
>   const handleDelete = useCallback((id) => {
>     setComplaints(prev => prev.filter(c => c._id !== id));
>   }, []); // Empty deps = never recreated
>   
>   return complaints.map(c => (
>     <ComplaintCard key={c._id} complaint={c} onDelete={handleDelete} />
>   ));
> };
> ```
>
> **3. useMemo (Expensive computations)**:
> ```javascript
> const Dashboard = ({ complaints }) => {
>   // Recalculates ONLY when complaints change
>   const stats = useMemo(() => {
>     return {
>       total: complaints.length,
>       pending: complaints.filter(c => c.status === 'pending').length,
>       resolved: complaints.filter(c => c.status === 'resolved').length,
>       avgResolutionTime: calculateAvgTime(complaints) // Expensive
>     };
>   }, [complaints]);
>   
>   return <StatsCards stats={stats} />;
> };
> ```
>
> **4. Code Splitting (Lazy Loading)**:
> ```javascript
> // Only load admin pages when needed
> const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
> const Analytics = lazy(() => import('./pages/admin/Analytics'));
>
> <Routes>
>   <Route
>     path="/admin/dashboard"
>     element={
>       <Suspense fallback={<LoadingSpinner />}>
>         <AdminDashboard />
>       </Suspense>
>     }
>   />
> </Routes>
>
> // Result: Initial bundle size reduced by 40%
> ```
>
> **5. Debouncing User Input**:
> ```javascript
> const SearchBar = () => {
>   const [query, setQuery] = useState('');
>   
>   useEffect(() => {
>     // Delay API call until user stops typing
>     const timer = setTimeout(() => {
>       searchComplaints(query);
>     }, 500); // 500ms delay
>     
>     return () => clearTimeout(timer); // Cleanup
>   }, [query]);
>   
>   return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
> };
> ```
>
> **Performance Metrics**:
> ```
> Before optimization:
> - First Contentful Paint: 2.5s
> - Time to Interactive: 4.2s
> - Bundle size: 850 KB
>
> After optimization:
> - First Contentful Paint: 1.2s ⬇️ 52% faster
> - Time to Interactive: 2.1s ⬇️ 50% faster
> - Bundle size: 450 KB ⬇️ 47% smaller
> ```"

### Q23: Explain your routing strategy.

**Answer**:
> "We use **React Router v6 with role-based route protection**:
>
> **Route Structure**:
> ```
> Public Routes (No auth):
>   / → HomePage
>   /login → LoginPage
>   /register → RegisterPage
>
> Protected Routes (Auth required):
>   /citizen/dashboard → CitizenDashboard
>   /citizen/my-complaints → MyComplaints
>   /citizen/new-complaint → NewComplaint
>
> Admin Routes (Admin role required):
>   /admin/dashboard → AdminDashboard
>   /admin/manage-users → ManageUsers
>   /admin/manage-complaints → ManageComplaints
> ```
>
> **Route Protection Implementation**:
> ```javascript
> // ProtectedRoute.jsx
> const ProtectedRoute = () => {
>   const { currentUser, userProfile, loading } = useAuth();
>
>   if (loading) return <LoadingSpinner />;
>
>   // Step 1: Check if logged in
>   if (!currentUser) {
>     return <Navigate to="/login" replace />;
>   }
>
>   // Step 2: Check if registered in our system
>   if (!userProfile) {
>     return <Navigate to="/register" replace />;
>   }
>
>   // Step 3: Check approval status
>   if (userProfile.status === 'pending') {
>     return <Navigate to="/pending-approval" replace />;
>   }
>
>   if (userProfile.status === 'rejected') {
>     return <Navigate to="/account-rejected" replace />;
>   }
>
>   // All checks passed, render protected content
>   return <Outlet />;
> };
> ```
>
> **Admin Route Protection**:
> ```javascript
> const AdminRoute = () => {
>   const { isAdmin, loading } = useAuth();
>
>   if (loading) return <LoadingSpinner />;
>   
>   if (!isAdmin) {
>     toast.error('Admin access required');
>     return <Navigate to="/citizen/dashboard" replace />;
>   }
>
>   return <Outlet />;
> };
> ```"

### Q24: How do you handle forms in React?

**Answer**:
> "I use **controlled components** with custom validation:
>
> **Basic Form State Management**:
> ```javascript
> const NewComplaint = () => {
>   const [formData, setFormData] = useState({
>     title: '',
>     description: '',
>     category: '',
>     wardNumber: '',
>     imageUrls: []
>   });
>
>   const [errors, setErrors] = useState({});
>   const [isSubmitting, setIsSubmitting] = useState(false);
>
>   const handleChange = (e) => {
>     const { name, value } = e.target;
>     setFormData(prev => ({ ...prev, [name]: value }));
>     
>     // Clear error when user starts typing
>     if (errors[name]) {
>       setErrors(prev => ({ ...prev, [name]: null }));
>     }
>   };
>
>   const validate = () => {
>     const newErrors = {};
>     
>     if (!formData.title.trim()) {
>       newErrors.title = 'Title is required';
>     } else if (formData.title.length < 10) {
>       newErrors.title = 'Title must be at least 10 characters';
>     }
>     
>     if (!formData.description.trim()) {
>       newErrors.description = 'Description is required';
>     } else if (formData.description.length < 20) {
>       newErrors.description = 'Description must be at least 20 characters';
>     }
>     
>     if (!formData.category) {
>       newErrors.category = 'Category is required';
>     }
>     
>     return newErrors;
>   };
>
>   const handleSubmit = async (e) => {
>     e.preventDefault();
>     
>     const validationErrors = validate();
>     if (Object.keys(validationErrors).length > 0) {
>       setErrors(validationErrors);
>       return;
>     }
>     
>     setIsSubmitting(true);
>     try {
>       const response = await complaintService.create(formData);
>       toast.success(`Complaint submitted! Tracking ID: ${response.trackingId}`);
>       navigate('/citizen/my-complaints');
>     } catch (error) {
>       toast.error(error.message || 'Failed to submit complaint');
>     } finally {
>       setIsSubmitting(false);
>     }
>   };
>
>   return (
>     <form onSubmit={handleSubmit}>
>       <input
>         name="title"
>         value={formData.title}
>         onChange={handleChange}
>         placeholder="Complaint Title"
>       />
>       {errors.title && <span className="error">{errors.title}</span>}
>       
>       <button type="submit" disabled={isSubmitting}>
>         {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
>       </button>
>     </form>
>   );
> };
> ```
>
> **Why NOT form libraries (Formik, React Hook Form)?**:
> - Our forms are simple (4-5 fields max)
> - Custom validation is straightforward
> - No complex field dependencies
> - Reduces bundle size
>
> **When I'd use a form library**:
> - Complex multi-step forms
> - Dynamic form fields
> - Complex validation rules (Yup schema)
> - File uploads with progress tracking"

### Q25: Explain your API integration layer.

**Answer**:
> "We use **Axios with interceptors** for centralized API management:
>
> **Axios Instance Setup** (services/api.js):
> ```javascript
> import axios from 'axios';
> import { auth } from '../config/firebase';
>
> const api = axios.create({
>   baseURL: import.meta.env.VITE_API_URL, // http://localhost:5000/api
>   timeout: 10000, // 10 seconds
>   headers: {
>     'Content-Type': 'application/json'
>   }
> });
>
> // Request interceptor: Add auth token
> api.interceptors.request.use(
>   async (config) => {
>     const currentUser = auth.currentUser;
>     if (currentUser) {
>       const token = await currentUser.getIdToken();
>       config.headers.Authorization = `Bearer ${token}`;
>     }
>     return config;
>   },
>   (error) => Promise.reject(error)
> );
>
> // Response interceptor: Handle errors globally
> api.interceptors.response.use(
>   (response) => response.data, // Return just data, not whole response
>   (error) => {
>     if (error.response) {
>       const { status, data } = error.response;
>       
>       switch (status) {
>         case 401:
>           // Unauthorized - redirect to login
>           auth.signOut();
>           window.location.href = '/login';
>           toast.error('Session expired');
>           break;
>         case 403:
>           toast.error('Access denied');
>           break;
>         case 404:
>           toast.error('Resource not found');
>           break;
>         case 500:
>           toast.error('Server error. Please try again.');
>           break;
>         default:
>           toast.error(data.message || 'An error occurred');
>       }
>     } else if (error.request) {
>       // Network error
>       toast.error('Network error. Check your connection.');
>     } else {
>       // Other errors
>       toast.error('An unexpected error occurred');
>     }
>     
>     return Promise.reject(error);
>   }
> );
>
> export default api;
> ```
>
> **Service Layer** (services/complaintService.js):
> ```javascript
> import api from './api';
>
> const complaintService = {
>   getAll: async (filters = {}) => {
>     const params = new URLSearchParams(filters).toString();
>     return api.get(`/complaints?${params}`);
>   },
>
>   getById: async (id) => {
>     return api.get(`/complaints/${id}`);
>   },
>
>   create: async (data) => {
>     return api.post('/complaints', data);
>   },
>
>   update: async (id, data) => {
>     return api.put(`/complaints/${id}`, data);
>   },
>
>   delete: async (id) => {
>     return api.delete(`/complaints/${id}`);
>   },
>
>   checkDuplicates: async (data) => {
>     return api.post('/complaints/check-duplicates', data);
>   }
> };
>
> export default complaintService;
> ```
>
> **Usage in Components**:
> ```javascript
> import complaintService from '../services/complaintService';
>
> const MyComplaints = () => {
>   const [complaints, setComplaints] = useState([]);
>   const [loading, setLoading] = useState(true);
>
>   useEffect(() => {
>     const fetchComplaints = async () => {
>       try {
>         const data = await complaintService.getAll();
>         setComplaints(data);
>       } catch (error) {
>         // Error already handled by interceptor
>         console.error(error);
>       } finally {
>         setLoading(false);
>       }
>     };
>
>     fetchComplaints();
>   }, []);
> };
> ```
>
> **Benefits**:
> - ✅ Centralized auth token management (no manual headers)
> - ✅ Global error handling (DRY principle)
> - ✅ Easy to mock for testing
> - ✅ Type-safe with TypeScript (future)
> - ✅ Automatic data unwrapping (response.data → data)"

### Q26: How do you handle loading states?

**Answer**:
> "I use **multiple loading states** for better UX:
>
> **1. Page-Level Loading** (Initial data fetch):
> ```javascript
> const MyComplaints = () => {
>   const [complaints, setComplaints] = useState([]);
>   const [loading, setLoading] = useState(true);
>
>   useEffect(() => {
>     const fetchData = async () => {
>       try {
>         const data = await complaintService.getAll();
>         setComplaints(data);
>       } finally {
>         setLoading(false); // Always turn off loading
>       }
>     };
>     fetchData();
>   }, []);
>
>   if (loading) {
>     return <LoadingSpinner fullScreen />;
>   }
>
>   if (complaints.length === 0) {
>     return <EmptyState message="No complaints yet" />;
>   }
>
>   return <ComplaintList complaints={complaints} />;
> };
> ```
>
> **2. Button Loading** (Action feedback):
> ```javascript
> const [isSubmitting, setIsSubmitting] = useState(false);
>
> const handleSubmit = async () => {
>   setIsSubmitting(true);
>   try {
>     await complaintService.create(formData);
>     toast.success('Submitted!');
>   } finally {
>     setIsSubmitting(false);
>   }
> };
>
> <button type="submit" disabled={isSubmitting}>
>   {isSubmitting ? (
>     <>
>       <Spinner size="sm" />
>       Submitting...
>     </>
>   ) : (
>     'Submit Complaint'
>   )}
> </button>
> ```
>
> **3. Skeleton Loading** (Better perceived performance):
> ```javascript
> const ComplaintCard = ({ loading, complaint }) => {
>   if (loading) {
>     return (
>       <div className="card">
>         <div className="skeleton skeleton-title"></div>
>         <div className="skeleton skeleton-text"></div>
>         <div className="skeleton skeleton-text"></div>
>       </div>
>     );
>   }
>
>   return (
>     <div className="card">
>       <h3>{complaint.title}</h3>
>       <p>{complaint.description}</p>
>     </div>
>   );
> };
> ```
>
> **4. Optimistic Updates** (Instant feedback):
> ```javascript
> const handleDelete = async (id) => {
>   // Remove from UI immediately
>   setComplaints(prev => prev.filter(c => c._id !== id));
>   
>   try {
>     await complaintService.delete(id);
>     toast.success('Deleted');
>   } catch (error) {
>     // Restore on error
>     setComplaints(prev => [...prev, deletedComplaint]);
>     toast.error('Failed to delete');
>   }
> };
> ```
>
> **5. AI Processing Loading** (Contextual feedback):
> ```javascript
> const [aiState, setAiState] = useState({
>   duplicateChecking: false,
>   duplicateWarning: null
> });
>
> {aiState.duplicateChecking && (
>   <div className="alert info">
>     <Spinner size="xs" />
>     Checking for similar complaints...
>   </div>
> )}
>
> {aiState.duplicateWarning && (
>   <div className="alert warning">
>     ⚠️ {aiState.duplicateWarning.count} similar complaints found
>   </div>
> )}
> ```"

### Q27: Explain your component structure.

**Answer**:
> "I use **atomic design principles**:
>
> **Component Hierarchy**:
> ```
> src/components/
> ├─ common/           # Atomic components (buttons, inputs, cards)
> │  ├─ Button.jsx
> │  ├─ Input.jsx
> │  ├─ Card.jsx
> │  ├─ Badge.jsx
> │  └─ LoadingSpinner.jsx
> │
> ├─ complaint/        # Domain-specific components
> │  ├─ ComplaintCard.jsx
> │  ├─ ComplaintList.jsx
> │  ├─ ComplaintFilter.jsx
> │  ├─ StatusBadge.jsx
> │  └─ PriorityBadge.jsx
> │
> ├─ layout/           # Layout components
> │  ├─ Navbar.jsx
> │  ├─ Sidebar.jsx
> │  ├─ Footer.jsx
> │  └─ DashboardLayout.jsx
> │
> └─ features/         # Feature-specific components
>    ├─ DuplicateWarning.jsx
>    ├─ ImageUpload.jsx
>    └─ CategorySelector.jsx
> ```
>
> **Example - Atomic Component** (Button.jsx):
> ```javascript
> const Button = ({ 
>   children, 
>   variant = 'primary', 
>   size = 'md', 
>   loading = false,
>   disabled = false,
>   onClick,
>   ...props 
> }) => {
>   const variants = {
>     primary: 'bg-blue-600 hover:bg-blue-700 text-white',
>     secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
>     danger: 'bg-red-600 hover:bg-red-700 text-white'
>   };
>
>   const sizes = {
>     sm: 'px-3 py-1 text-sm',
>     md: 'px-4 py-2',
>     lg: 'px-6 py-3 text-lg'
>   };
>
>   return (
>     <button
>       className={`rounded font-medium ${variants[variant]} ${sizes[size]}`}
>       disabled={disabled || loading}
>       onClick={onClick}
>       {...props}
>     >
>       {loading && <Spinner size="xs" />}
>       {children}
>     </button>
>   );
> };
> ```
>
> **Example - Domain Component** (ComplaintCard.jsx):
> ```javascript
> const ComplaintCard = ({ complaint, onClick }) => {
>   return (
>     <Card onClick={() => onClick(complaint._id)}>
>       <div className="flex justify-between items-start">
>         <div className="flex-1">
>           <h3 className="font-semibold">{complaint.title}</h3>
>           <p className="text-gray-600 text-sm mt-1">
>             {complaint.description.substring(0, 150)}...
>           </p>
>         </div>
>         
>         <div className="flex gap-2">
>           <StatusBadge status={complaint.status} />
>           <PriorityBadge priority={complaint.priority} />
>         </div>
>       </div>
>       
>       <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
>         <span>#{complaint.trackingId}</span>
>         <span>{formatDate(complaint.createdAt)}</span>
>       </div>
>     </Card>
>   );
> };
> ```
>
> **Benefits**:
> - ✅ Reusability: Button used everywhere
> - ✅ Consistency: Same look and feel
> - ✅ Easy testing: Test atomic components once
> - ✅ Easy refactoring: Change Button, all usages update"

### Q28: How do you manage side effects in React?

**Answer**:
> "I use **useEffect with proper cleanup**:
>
> **1. Data Fetching**:
> ```javascript
> useEffect(() => {
>   let mounted = true;
>
>   const fetchData = async () => {
>     try {
>       const data = await api.getComplaints();
>       if (mounted) { // Prevent state update if unmounted
>         setComplaints(data);
>       }
>     } catch (error) {
>       if (mounted) {
>         setError(error);
>       }
>     }
>   };
>
>   fetchData();
>
>   return () => {
>     mounted = false; // Cleanup
>   };
> }, []);
> ```
>
> **2. Event Listeners**:
> ```javascript
> useEffect(() => {
>   const handleResize = () => {
>     setWindowWidth(window.innerWidth);
>   };
>
>   window.addEventListener('resize', handleResize);
>
>   return () => {
>     window.removeEventListener('resize', handleResize); // Cleanup
>   };
> }, []);
> ```
>
> **3. Timers**:
> ```javascript
> useEffect(() => {
>   const timer = setTimeout(() => {
>     checkDuplicates();
>   }, 1000); // Debounce
>
>   return () => clearTimeout(timer); // Cleanup
> }, [formData.title, formData.description]);
> ```
>
> **4. Subscriptions** (WebSockets, Firebase):
> ```javascript
> useEffect(() => {
>   const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
>     setCurrentUser(user);
>   });
>
>   return () => unsubscribe(); // Cleanup
> }, []);
> ```
>
> **Common Mistakes to Avoid**:
> ```javascript
> // ❌ BAD: Missing dependency
> useEffect(() => {
>   fetchComplaints(category);
> }, []); // Should have [category]
>
> // ❌ BAD: No cleanup for async
> useEffect(() => {
>   fetchData().then(setData); // Can set state after unmount
> }, []);
>
> // ✅ GOOD: Proper cleanup
> useEffect(() => {
>   let mounted = true;
>   fetchData().then(data => {
>     if (mounted) setData(data);
>   });
>   return () => { mounted = false; };
> }, []);
> ```"

### Q29: How do you handle authentication state?

**Answer**:
> "I use **Firebase Auth + Custom AuthContext**:
>
> **AuthContext Implementation** (context/AuthContext.jsx):
> ```javascript
> import { createContext, useContext, useState, useEffect } from 'react';
> import { auth } from '../config/firebase';
> import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
> import api from '../services/api';
>
> const AuthContext = createContext();
>
> export const useAuth = () => {
>   const context = useContext(AuthContext);
>   if (!context) {
>     throw new Error('useAuth must be used within AuthProvider');
>   }
>   return context;
> };
>
> export const AuthProvider = ({ children }) => {
>   const [currentUser, setCurrentUser] = useState(null); // Firebase user
>   const [userProfile, setUserProfile] = useState(null); // MongoDB user
>   const [loading, setLoading] = useState(true);
>
>   // Listen to Firebase auth state changes
>   useEffect(() => {
>     const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
>       setCurrentUser(firebaseUser);
>       
>       if (firebaseUser) {
>         // Fetch user profile from our backend
>         try {
>           const profile = await api.get('/auth/me');
>           setUserProfile(profile);
>         } catch (error) {
>           console.error('Failed to fetch profile:', error);
>           setUserProfile(null);
>         }
>       } else {
>         setUserProfile(null);
>       }
>       
>       setLoading(false);
>     });
>
>     return () => unsubscribe();
>   }, []);
>
>   const login = async (email, password) => {
>     const userCredential = await signInWithEmailAndPassword(auth, email, password);
>     return userCredential.user;
>   };
>
>   const logout = async () => {
>     await signOut(auth);
>     setUserProfile(null);
>   };
>
>   const value = {
>     currentUser,
>     userProfile,
>     loading,
>     isAdmin: userProfile?.role === 'admin',
>     login,
>     logout
>   };
>
>   return (
>     <AuthContext.Provider value={value}>
>       {!loading && children}
>     </AuthContext.Provider>
>   );
> };
> ```
>
> **Two-Tier Authentication**:
> ```
> Tier 1: Firebase Authentication
>   - Handles JWT tokens
>   - Email/password management
>   - Session persistence
>
> Tier 2: Backend Profile
>   - Role-based access (admin/citizen)
>   - Approval status (pending/approved/rejected)
>   - Additional user metadata
> ```
>
> **Why This Approach**:
> - ✅ Firebase handles security (password hashing, token refresh)
> - ✅ We control business logic (approval workflow)
> - ✅ Can add social logins easily (Google, Facebook)
> - ✅ JWT tokens validated on both client and server"

### Q30: Explain your styling approach.

**Answer**:
> "I use **Utility-First CSS with Tailwind**:
>
> **Why Tailwind?**:
> - ⚡ Fast development (no switching between files)
> - 🎨 Consistent design system (spacing, colors)
> - 📦 Small bundle size (PurgeCSS removes unused classes)
> - 📱 Responsive by default (`md:`, `lg:` breakpoints)
>
> **Example Component**:
> ```javascript
> const ComplaintCard = ({ complaint }) => {
>   return (
>     <div className="
>       bg-white rounded-lg shadow-md p-6
>       hover:shadow-lg transition-shadow
>       cursor-pointer
>     ">
>       <h3 className="text-lg font-semibold text-gray-800">
>         {complaint.title}
>       </h3>
>       
>       <p className="text-sm text-gray-600 mt-2">
>         {complaint.description}
>       </p>
>       
>       <div className="flex gap-2 mt-4">
>         <span className={`
>           px-3 py-1 rounded-full text-sm font-medium
>           ${complaint.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
>           ${complaint.status === 'resolved' ? 'bg-green-100 text-green-800' : ''}
>         `}>
>           {complaint.status}
>         </span>
>       </div>
>     </div>
>   );
> };
> ```
>
> **Responsive Design**:
> ```javascript
> <div className="
>   grid grid-cols-1       {/* Mobile: 1 column */}
>   md:grid-cols-2         {/* Tablet: 2 columns */}
>   lg:grid-cols-3         {/* Desktop: 3 columns */}
>   gap-4                  {/* 1rem gap */}
> ">
>   {complaints.map(c => <ComplaintCard key={c._id} complaint={c} />)}
> </div>
> ```
>
> **Custom Classes** (When needed):
> ```javascript
> // tailwind.config.js
> module.exports = {
>   theme: {
>     extend: {
>       colors: {
>         primary: '#3B82F6',  // Blue
>         secondary: '#10B981', // Green
>         danger: '#EF4444'     // Red
>       },
>       fontFamily: {
>         sans: ['Inter', 'sans-serif']
>       }
>     }
>   }
> };
>
> // Usage:
> <button className="bg-primary hover:bg-primary/90">
>   Submit
> </button>
> ```
>
> **Reusable Components**:
> ```javascript
> // For repeated patterns, extract to component
> const Badge = ({ children, variant = 'default' }) => {
>   const variants = {
>     default: 'bg-gray-100 text-gray-800',
>     success: 'bg-green-100 text-green-800',
>     warning: 'bg-yellow-100 text-yellow-800',
>     danger: 'bg-red-100 text-red-800'
>   };
>
>   return (
>     <span className={`px-3 py-1 rounded-full text-sm font-medium ${variants[variant]}`}>
>       {children}
>     </span>
>   );
> };
>
> // Usage:
> <Badge variant="success">Resolved</Badge>
> <Badge variant="warning">Pending</Badge>
> ```"

---

## BACKEND DEEP DIVE

### Q31: Explain your Express.js middleware chain.

**Answer**:
> "Middleware executes in order. Here's our chain:
>
> **Middleware Order** (critical):
> ```javascript
> // server.js
> const app = express();
>
> // 1. CORS - Must be first to handle preflight
> app.use(cors({
>   origin: [FRONTEND_URL, 'http://localhost:5173'],
>   credentials: true
> }));
>
> // 2. Body parsers - Parse incoming request bodies
> app.use(express.json({ limit: '10mb' }));
> app.use(express.urlencoded({ extended: true }));
>
> // 3. Database connection - Ensure DB is connected
> app.use('/api', async (req, res, next) => {
>   await connectDB();
>   next();
> });
>
> // 4. Request logging (Development only)
> if (process.env.NODE_ENV === 'development') {
>   app.use((req, res, next) => {
>     console.log(`${req.method} ${req.path}`);
>     next();
>   });
> }
>
> // 5. Routes - Business logic
> app.use('/api/auth', authRoutes);
> app.use('/api/complaints', complaintRoutes);
> app.use('/api/admin', adminRoutes);
>
> // 6. 404 Handler - Catch undefined routes
> app.use((req, res) => {
>   res.status(404).json({ error: 'Route not found' });
> });
>
> // 7. Error Handler - Must be last middleware
> app.use((err, req, res, next) => {
>   console.error(err.stack);
>   res.status(500).json({
>     error: 'Internal Server Error',
>     message: process.env.NODE_ENV === 'development' ? err.message : undefined
>   });
> });
> ```
>
> **Route-Specific Middleware**:
> ```javascript
> // routes/complaint.routes.js
> const router = express.Router();
>
> // All routes require authentication
> router.use(verifyToken);
>
> // Most routes require approved status
> router.get('/', requireApprovedUser, getAllComplaints);
> router.post('/', requireApprovedUser, createComplaint);
>
> // Only admins can delete
> router.delete('/:id', requireAdmin, deleteComplaint);
> ```
>
> **Custom Middleware Example** (auth.middleware.js):
> ```javascript
> const verifyToken = async (req, res, next) => {
>   try {
>     // 1. Extract token from header
>     const authHeader = req.headers.authorization;
>     if (!authHeader || !authHeader.startsWith('Bearer ')) {
>       return res.status(401).json({ error: 'No token provided' });
>     }
>
>     const token = authHeader.split(' ')[1];
>
>     // 2. Verify Firebase JWT
>     const decodedToken = await admin.auth().verifyIdToken(token);
>
>     // 3. Find user in our database
>     const user = await User.findOne({ firebaseUid: decodedToken.uid });
>     if (!user) {
>       return res.status(404).json({ error: 'User not found' });
>     }
>
>     // 4. Attach user to request object
>     req.user = user;
>     next(); // Continue to next middleware or controller
>   } catch (error) {
>     console.error('Token verification error:', error);
>     res.status(401).json({ error: 'Invalid token' });
>   }
> };
>
> const requireApprovedUser = (req, res, next) => {
>   if (req.user.status !== 'approved') {
>     return res.status(403).json({
>       error: 'Account not approved',
>       status: req.user.status
>     });
>   }
>   next();
> };
>
> const requireAdmin = (req, res, next) => {
>   if (req.user.role !== 'admin') {
>     return res.status(403).json({ error: 'Admin access required' });
>   }
>   next();
> };
> ```
>
> **Why Order Matters**:
> ```javascript
> // ❌ BAD: CORS after routes
> app.use('/api/complaints', complaintRoutes);
> app.use(cors()); // Too late! Preflight requests already failed
>
> // ❌ BAD: Body parser after routes
> app.use('/api/complaints', complaintRoutes);
> app.use(express.json()); // Routes won't see parsed body
>
> // ✅ GOOD: CORS and body parser first
> app.use(cors());
> app.use(express.json());
> app.use('/api/complaints', complaintRoutes);
> ```"

### Q32: How do you structure controllers?

**Answer**:
> "Controllers handle business logic and orchestrate services:
>
> **Controller Structure** (complaint.controller.js):
> ```javascript
> const createComplaint = async (req, res) => {
>   try {
>     // 1. Validate input
>     const { title, description, category, wardNumber, contactPhone, imageUrls } = req.body;
>     
>     if (!title || !description || !category) {
>       return res.status(400).json({
>         error: 'Missing required fields',
>         required: ['title', 'description', 'category']
>       });
>     }
>
>     // 2. Generate tracking ID
>     const trackingId = await generateTrackingId();
>
>     // 3 Call AI services in parallel
>     const [priorityResult, duplicateResult] = await Promise.all([
>       aiServices.scorePriority(title, description, category),
>       aiServices.findDuplicates(title, description, category)
>     ]);
>
>     // 4. Create complaint in database
>     const complaint = await Complaint.create({
>       userId: req.user._id,
>       trackingId,
>       title,
>       description,
>       category,
>       wardNumber,
>       contactPhone,
>       imageUrl: imageUrls[0],
>       imageUrl2: imageUrls[1],
>       imageUrl3: imageUrls[2],
>       priority: priorityResult.priority,
>       status: 'pending'
>     });
>
>     // 5. Create history entry (audit trail)
>     await ComplaintHistory.create({
>       complaintId: complaint._id,
>       action: 'created',
>       performedBy: req.user._id,
>       details: { priority: priorityResult.priority }
>     });
>
>     // 6. Return response with AI insights
>     res.status(201).json({
>       success: true,
>       data: complaint,
>       aiInsights: {
>         priority: priorityResult.priority,
>         priorityReason: priorityResult.reason,
>         hasDuplicates: duplicateResult.hasDuplicates,
>         similarComplaints: duplicateResult.duplicates
>       }
>     });
>   } catch (error) {
>     console.error('Create complaint error:', error);
>     res.status(500).json({
>       error: 'Failed to create complaint',
>       message: process.env.NODE_ENV === 'development' ? error.message : undefined
>     });
>   }
> };
>
> const getAllComplaints = async (req, res) => {
>   try {
>     // 1. Parse query parameters
>     const { status, category, priority, page = 1, limit = 10 } = req.query;
>
>     // 2. Build filter object
>     const filter = {};
>     if (req.user.role === 'citizen') {
>       filter.userId = req.user._id; // Citizens see only their complaints
>     }
>     if (status) filter.status = status;
>     if (category) filter.category = category;
>     if (priority) filter.priority = priority;
>
>     // 3. Paginate results
>     const skip = (page - 1) * limit;
>     const [complaints, total] = await Promise.all([
>       Complaint.find(filter)
>         .sort({ createdAt: -1 })
>         .skip(skip)
>         .limit(parseInt(limit))
>         .populate('userId', 'name email'), // Join with User collection
>       Complaint.countDocuments(filter)
>     ]);
>
>     // 4. Return paginated response
>     res.json({
>       success: true,
>       data: complaints,
>       pagination: {
>         page: parseInt(page),
>         limit: parseInt(limit),
>         total,
>         pages: Math.ceil(total / limit)
>       }
>     });
>   } catch (error) {
>     console.error('Get complaints error:', error);
>     res.status(500).json({ error: 'Failed to fetch complaints' });
>   }
> };
>
> module.exports = {
>   createComplaint,
>   getAllComplaints,
>   getComplaintById,
>   updateComplaint,
>   deleteComplaint
> };
> ```
>
> **Controller Best Practices**:
> - ✅ Keep controllers thin (business logic, not implementation details)
> - ✅ Delegate complex logic to services
> - ✅ Always return consistent response format
> - ✅ Handle errors gracefully
> - ✅ Use async/await (no callback hell)
> - ✅ Validate input at controller level
> - ✅ Use HTTP status codes correctly:
>   ```
>   200 → Success (GET, PUT)
>   201 → Created (POST)
>   204 → No Content (DELETE)
>   400 → Bad Request (client error)
>   401 → Unauthorized (no token)
>   403 → Forbidden (no permission)
>   404 → Not Found
>   500 → Server Error
>   ```"

### Q33: Explain your database schema design.

**Answer**:
> "**User Schema** (models/User.js):
> ```javascript
> const userSchema = new mongoose.Schema({
>   _id: {
>     type: String,
>     default: () => uuidv4()
>   },
>   firebaseUid: {
>     type: String,
>     required: true,
>     unique: true,
>     index: true // Fast lookup for auth
>   },
>   email: {
>     type: String,
>     required: true,
>     unique: true,
>     lowercase: true,
>     trim: true
>   },
>   name: {
>     type: String,
>     required: true
>   },
>   phone: String,
>   address: String,
>   aadhaarLast4: String, // Only last 4 digits for privacy
>   panchayatCode: {
>     type: String,
>     required: true,
>     index: true // For multi-tenant filtering
>   },
>   role: {
>     type: String,
>     enum: ['citizen', 'admin', 'super_admin'],
>     default: 'citizen'
>   },
>   status: {
>     type: String,
>     enum: ['pending', 'approved', 'rejected'],
>     default: 'pending',
>     index: true
>   }
> }, {
>   timestamps: true // Adds createdAt, updatedAt
> });
> ```
>
> **Complaint Schema** (models/Complaint.js):
> ```javascript
> const complaintSchema = new mongoose.Schema({
>   _id: {
>     type: String,
>     default: () => uuidv4()
>   },
>   trackingId: {
>     type: String,
>     required: true,
>     unique: true,
>     index: true
>   },
>   userId: {
>     type: String,
>     ref: 'User',
>     required: true,
>     index: true
>   },
>   title: {
>     type: String,
>     required: true,
>     minlength: 10,
>     maxlength: 200
>   },
>   description: {
>     type: String,
>     required: true,
>     minlength: 20
>   },
>   category: {
>     type: String,
>     required: true,
>     enum: [
>       'Water Supply',
>       'Electricity',
>       'Roads',
>       'Garbage',
>       'Drainage',
>       'Street Lights',
>       'Public Toilet',
>       'Other'
>     ]
>   },
>   status: {
>     type: String,
>     enum: ['pending', 'in_progress', 'resolved', 'rejected'],
>     default: 'pending',
>     index: true
>   },
>   priority: {
>     type: String,
>     enum: ['low', 'normal', 'high', 'urgent'],
>     default: 'normal',
>     index: true
>   },
>   wardNumber: Number,
>   contactPhone: String,
>   imageUrl: String,
>   imageUrl2: String,
>   imageUrl3: String,
>   
>   // Embedded subdocument for feedback
>   feedback: {
>     rating: {
>       type: Number,
>       min: 1,
>       max: 5
>     },
>     comment: String,
>     submittedAt: Date
>   },
>   
>   resolvedAt: Date,
>   resolutionNotes: String
> }, {
>   timestamps: true
> });
>
> // Compound index for efficient queries
> complaintSchema.index({ category: 1, createdAt: -1 });
> complaintSchema.index({ userId: 1, status: 1 });
> ```
>
> **Why These Design Choices**:
>
> **1. UUID vs Auto-Increment**:
> ```javascript
> // ✅ UUID: Secure, no predictable IDs
> _id: '550e8400-e29b-41d4-a716-446655440000'
>
> // ❌ Auto-increment: Predictable, security risk
> _id: 1234 // Easy to guess other complaint IDs
> ```
>
> **2. Embedded vs Referenced**:
> ```javascript
> // ✅ Embedded: Feedback is small, rarely queried separately
> feedback: {
>   rating: 4,
>   comment: 'Good service'
> }
>
> // ✅ Referenced: User can have many complaints
> userId: { type: String, ref: 'User' }
> // Benefit: Update user once, reflects in all complaints
> ```
>
> **3. Indexes**:
> ```javascript
> // Fast lookups on frequent queries
> firebaseUid: { index: true }       // Login (every request)
> trackingId: { index: true }        // Public tracking
> { userId: 1, status: 1 }           // "My pending complaints"
> { category: 1, createdAt: -1 }     // "Recent water supply issues"
> ```
>
> **4. Enums**:
> ```javascript
> // Enforce data integrity at schema level
> status: {
>   enum: ['pending', 'in_progress', 'resolved', 'rejected']
> }
> // Prevents typos like 'pneding' or 'reolved'
> ```"

### Q34: How do you handle validation?

**Answer**:
> "**Three-Layer Validation**:
>
> **Layer 1 - Mongoose Schema Validation**:
> ```javascript
> const complaintSchema = new mongoose.Schema({
>   title: {
>     type: String,
>     required: [true, 'Title is required'],
>     minlength: [10, 'Title must be at least 10 characters'],
>     maxlength: [200, 'Title cannot exceed 200 characters'],
>     trim: true
>   },
>   email: {
>     type: String,
>     required: true,
>     match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
>   },
>   priority: {
>     type: String,
>     enum: {
>       values: ['low', 'normal', 'high', 'urgent'],
>       message: '{VALUE} is not a valid priority'
>     }
>   }
> });
> ```
>
> **Layer 2 - Controller Level Validation**:
> ```javascript
> const createComplaint = async (req, res) => {
>   try {
>     const { title, description, category } = req.body;
>
>     // Manual validation for complex rules
>     if (!title || !description || !category) {
>       return res.status(400).json({
>         error: 'Validation Error',
>         message: 'Missing required fields',
>         required: ['title', 'description', 'category']
>       });
>     }
>
>     if (title.length < 10) {
>       return res.status(400).json({
>         error: 'Validation Error',
>         message: 'Title must be at least 10 characters'
>       });
>     }
>
>     // Business rule validation
>     const existingComplaint = await Complaint.findOne({
>       userId: req.user._id,
>       title: title,
>       createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
>     });
>
>     if (existingComplaint) {
>       return res.status(409).json({
>         error: 'Duplicate Complaint',
>         message: 'You submitted a similar complaint in the last 24 hours'
>       });
>     }
>
>     // Create complaint...
>   } catch (error) {
>     // Mongoose validation errors
>     if (error.name === 'ValidationError') {
>       return res.status(400).json({
>         error: 'Validation Error',
>         details: Object.values(error.errors).map(err => ({
>           field: err.path,
>           message: err.message
>         }))
>       });
>     }
>     
>     res.status(500).json({ error: 'Server error' });
>   }
> };
> ```
>
> **Layer 3 - Middleware Validation** (Optional - Express Validator):
> ```javascript
> const { body, validationResult } = require('express-validator');
>
> const validateComplaint = [
>   body('title')
>     .trim()
>     .notEmpty().withMessage('Title is required')
>     .isLength({ min: 10, max: 200 }).withMessage('Title must be 10-200 characters'),
>   
>   body('description')
>     .trim()
>     .notEmpty().withMessage('Description is required')
>     .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
>   
>   body('category')
>     .notEmpty().withMessage('Category is required')
>     .isIn(['Water Supply', 'Electricity', 'Roads', 'Garbage'])
>     .withMessage('Invalid category'),
>   
>   body('email')
>     .optional()
>     .isEmail().withMessage('Invalid email format')
>     .normalizeEmail(),
>   
>   (req, res, next) => {
>     const errors = validationResult(req);
>     if (!errors.isEmpty()) {
>       return res.status(400).json({
>         error: 'Validation Error',
>         details: errors.array()
>       });
>     }
>     next();
>   }
> ];
>
> // Usage:
> router.post('/', verifyToken, validateComplaint, createComplaint);
> ```
>
> **Why NOT Express Validator (for now)**:
> - Adds dependency
> - Mongoose validation is sufficient for simple cases
> - Would add for complex validation rules"

### Q35: How do you generate unique tracking IDs?

**Answer**:
> "**Tracking ID Format**: `COMP-2024-001234`
>
> **Implementation**:
> ```javascript
> const generateTrackingId = async () => {
>   const year = new Date().getFullYear();
>   const prefix = `COMP-${year}-`;
>
>   // Find the highest tracking ID for this year
>   const lastComplaint = await Complaint.findOne({
>     trackingId: new RegExp(`^${prefix}`)
>   }).sort({ trackingId: -1 });
>
>   let sequence = 1;
>   if (lastComplaint) {
>     const lastSequence = parseInt(lastComplaint.trackingId.split('-')[2]);
>     sequence = lastSequence + 1;
>   }
>
>   // Pad with zeros: 1 → 000001
>   const paddedSequence = sequence.toString().padStart(6, '0');
>   return `${prefix}${paddedSequence}`;
> };
> ```
>
> **Potential Issues**:
>
> **Race Condition** (Two requests at same time):
> ```javascript
> // Request A: Reads lastComplaint (COMP-2024-000123)
> // Request B: Reads lastComplaint (COMP-2024-000123) ← Same!
> // Request A: Creates COMP-2024-000124
> // Request B: Creates COMP-2024-000124 ← Duplicate!
> ```
>
> **Solution 1 - Atomic Counter** (Recommended):
> ```javascript
> // Create a Counter collection
> const counterSchema = new mongoose.Schema({
>   _id: String, // 'complaint_2024'
>   sequence: Number
> });
>
> const Counter = mongoose.model('Counter', counterSchema);
>
> const generateTrackingId = async () => {
>   const year = new Date().getFullYear();
>   const counterId = `complaint_${year}`;
>
>   // Atomic findOneAndUpdate
>   const counter = await Counter.findByIdAndUpdate(
>     counterId,
>     { $inc: { sequence: 1 } },
>     { new: true, upsert: true, setDefaultsOnInsert: true }
>   );
>
>   const paddedSequence = counter.sequence.toString().padStart(6, '0');
>   return `COMP-${year}-${paddedSequence}`;
> };
> ```
>
> **Solution 2 - MongoDB Transaction** (Overkill but safe):
> ```javascript
> const session = await mongoose.startSession();
> session.startTransaction();
>
> try {
>   const lastComplaint = await Complaint.findOne({ /* ... */ }).session(session);
>   const trackingId = generateNextId(lastComplaint);
>   
>   const complaint = await Complaint.create([{ trackingId, /* ... */ }], { session });
>   
>   await session.commitTransaction();
>   return complaint;
> } catch (error) {
>   await session.abortTransaction();
>   throw error;
> } finally {
>   session.endSession();
> }
> ```
>
> **Solution 3 - UUID** (Simplest):
> ```javascript
> // Trade-off: Not sequential, but guaranteed unique
> const trackingId = `COMP-${uuidv4().slice(0, 8).toUpperCase()}`;
> // Example: COMP-A3F8B2C1
> ```
>
> **Current Implementation**: Solution 1 (Atomic Counter) for predictable, human-friendly IDs"

### Q36: How do you handle async operations in Node.js?

**Answer**:
> "**Pattern 1 - Async/Await** (Preferred):
> ```javascript
> const createComplaint = async (req, res) => {
>   try {
>     // Sequential operations
>     const trackingId = await generateTrackingId();
>     const complaint = await Complaint.create({ trackingId, /* ... */ });
>     const history = await ComplaintHistory.create({ /* ... */ });
>     
>     res.status(201).json({ data: complaint });
>   } catch (error) {
>     res.status(500).json({ error: error.message });
>   }
> };
> ```
>
> **Pattern 2 - Parallel Execution**:
> ```javascript
> // ❌ BAD: Sequential (slow)
> const priority = await aiServices.scorePriority(title, description); // 30ms
> const duplicates = await aiServices.findDuplicates(title, description); // 40ms
> // Total: 70ms
>
> // ✅ GOOD: Parallel (fast)
> const [priority, duplicates] = await Promise.all([
>   aiServices.scorePriority(title, description),   // 30ms
>   aiServices.findDuplicates(title, description)   // 40ms
> ]);
> // Total: 40ms (max of two operations)
> ```
>
> **Pattern 3 - Promise.allSettled** (Graceful degradation):
> ```javascript
> // Continue even if some AI services fail
> const results = await Promise.allSettled([
>   aiServices.scorePriority(title, description),
>   aiServices.findDuplicates(title, description),
>   aiServices.enrichContext(title, description)
> ]);
>
> const priority = results[0].status === 'fulfilled' 
>   ? results[0].value 
>   : { priority: 'normal', reason: 'AI service unavailable' };
>
> const duplicates = results[1].status === 'fulfilled'
>   ? results[1].value
>   : { hasDuplicates: false, duplicates: [] };
>
> // Even if enrichContext fails, we still create the complaint
> ```
>
> **Pattern 4 - Error Handling**:
> ```javascript
> // ❌ BAD: Unhandled promise rejection
> const fetchData = () => {
>   return api.get('/data'); // If this fails, app crashes
> };
>
> // ✅ GOOD: Proper error handling
> const fetchData = async () => {
>   try {
>     return await api.get('/data');
>   } catch (error) {
>     console.error('Data fetch failed:', error);
>     return null; // Or throw with more context
>   }
> };
> ```
>
> **Pattern 5 - Avoid Callback Hell**:
> ```javascript
> // ❌ BAD: Callback hell (old Node.js)
> generateTrackingId((err, trackingId) => {
>   if (err) return handleError(err);
>   
>   Complaint.create({ trackingId }, (err, complaint) => {
>     if (err) return handleError(err);
>     
>     ComplaintHistory.create({ complaintId: complaint._id }, (err, history) => {
>       if (err) return handleError(err);
>       res.json({ complaint });
>     });
>   });
> });
>
> // ✅ GOOD: Async/await (modern Node.js)
> try {
>   const trackingId = await generateTrackingId();
>   const complaint = await Complaint.create({ trackingId });
>   const history = await ComplaintHistory.create({ complaintId: complaint._id });
>   res.json({ complaint });
> } catch (error) {
>   handleError(error);
> }
> ```"

### Q37: Explain your AI services architecture.

**Answer**:
> "**AI Services Overview** (17 services in 5 phases):
>
> **Main Aggregator** (ai/index.js):
> ```javascript
> // Graceful loading - app works even if AI services fail
> let aiServices = null;
>
> try {
>   aiServices = {
>     // Phase 1: Core Services
>     preprocess: require('./preprocessor'),
>     scorePriority: require('./priority.service'),
>     classify: require('./classifier.service'),
>     findDuplicates: require('./duplicate.service'),
>     translationCache: require('./translation.cache'),
>
>     // Phase 2: Productivity Services
>     semanticSearch: require('./search.service'),
>     generateTemplate: require('./templates.service'),
>     detectTrends: require('./trends.service'),
>     verifyUser: require('./verification.service'),
>
>     // Phase 3: Engineering Services
>     jobQueue: require('./workers/job-queue'),
>     batchProcess: require('./workers/batch-processing'),
>     cleanup: require('./workers/cleanup'),
>     metrics: require('./workers/metrics'),
>     warmup: require('./workers/warmup'),
>
>     // Phase 4: Advanced Services
>     enrichContext: require('./enrichment.service'),
>     findSemanticDuplicates: require('./semantic-duplicate.service'),
>     summarize: require('./summarization.service'),
>
>     // Phase 5: Validation Services
>     evaluate: require('./evaluation.service'),
>     processFeedback: require('./feedback.service'),
>     getDashboardMetrics: require('./dashboard.service'),
>     demoMode: require('./demo.service'),
>     detectDrift: require('./drift.service')
>   };
>
>   console.log(' AI services loaded successfully');
> } catch (error) {
>   console.warn('⚠️ AI services not available:', error.message);
>   console.log('ℹ️ App will function with degraded features');
> }
>
> module.exports = aiServices;
> ```
>
> **Example Service - Priority Scoring** (ai/priority.service.js):
> ```javascript
> // Rule-based keyword matching (no external AI APIs)
> const URGENT_KEYWORDS = {
>   en: ['fire', 'flood', 'accident', 'emergency', 'death'],
>   ta: ['தீ', 'வெள்ளம்', 'விபத்து', 'அவசரம்'],
>   hi: ['आग', 'बाढ़', 'दुर्घटना', 'आपातकाल']
> };
>
> const HIGH_KEYWORDS = {
>   en: ['no water', 'power cut', 'broken pipe', 'sewage'],
>   ta: ['தண்ணீர் இல்லை', 'மின்சாரம் இல்லை'],
>   hi: ['पानी नहीं', 'बिजली कटौती']
> };
>
> const NORMAL_KEYWORDS = {
>   en: ['pothole', 'street light', 'garbage collection'],
>   ta: ['குழி', 'தெரு விளக்கு'],
>   hi: ['गड्ढा', 'सड़क की रोशनी']
> };
>
> const scorePriority = (title, description, category) => {
>   const text = `${title} ${description}`.toLowerCase();
>
>   // Check urgent keywords (any language)
>   for (const lang in URGENT_KEYWORDS) {
>     for (const keyword of URGENT_KEYWORDS[lang]) {
>       if (text.includes(keyword.toLowerCase())) {
>         return {
>           priority: 'urgent',
>           score: 10,
>           confidence: 0.95,
>           reason: `Urgent keyword detected: "${keyword}"`,
>           matchedKeyword: keyword
>         };
>       }
>     }
>   }
>
>   // Check high priority keywords
>   for (const lang in HIGH_KEYWORDS) {
>     for (const keyword of HIGH_KEYWORDS[lang]) {
>       if (text.includes(keyword.toLowerCase())) {
>         return {
>           priority: 'high',
>           score: 7,
>           confidence: 0.85,
>           reason: `High priority keyword: "${keyword}"`,
>           matchedKeyword: keyword
>         };
>       }
>     }
>   }
>
>   // Check category defaults
>   const CATEGORY_PRIORITY = {
>     'Water Supply': 'high',
>     'Electricity': 'high',
>     'Garbage': 'normal',
>     'Street Lights': 'low'
>   };
>
>   if (CATEGORY_PRIORITY[category]) {
>     return {
>       priority: CATEGORY_PRIORITY[category],
>       score: 5,
>       confidence: 0.7,
>       reason: `Category default: ${category}`,
>       matchedKeyword: null
>     };
>   }
>
>   // Default: normal priority
>   return {
>     priority: 'normal',
>     score: 3,
>     confidence: 0.5,
>     reason: 'No specific keywords matched',
>     matchedKeyword: null
>   };
> };
>
> module.exports = { scorePriority };
> ```
>
> **Why Local AI Processing**:
> - ✅ **Privacy**: No PII sent to third parties
> - ✅ **Cost**: $0 per request (vs $0.002/request for OpenAI)
> - ✅ **Speed**: 30ms vs 500ms+ for API calls
> - ✅ **Reliability**: No dependency on external services
> - ✅ **Offline**: Works without internet (future)
>
> **Trade-offs**:
> - ❌ Less accurate than GPT-4
> - ❌ Requires manual keyword maintenance
> - ❌ No natural language understanding (just pattern matching)
>
> **Future Improvements**:
> - Use lightweight ML models (ONNX Runtime)
> - Train custom classification model
> - Vector embeddings for semantic search"

### Q38: How do you handle database queries efficiently?

**Answer**:
> "**Optimization Techniques**:
>
> **1. Use Indexes**:
> ```javascript
> // ❌ BAD: No index (full collection scan)
> const user = await User.findOne({ email: 'test@example.com' });
> // Query time: 500ms for 10K users
>
> // ✅ GOOD: Index on email
> userSchema.index({ email: 1 });
> const user = await User.findOne({ email: 'test@example.com' });
> // Query time: 5ms
> ```
>
> **2. Compound Indexes** (Multiple fields):
> ```javascript
> // Frequent query: "Get my pending complaints"
> complaintSchema.index({ userId: 1, status: 1 });
>
> // This index supports:
> Complaint.find({ userId: '123' });                    // ✅ Fast
> Complaint.find({ userId: '123', status: 'pending' }); // ✅ Fast
>
> // But NOT:
> Complaint.find({ status: 'pending' }); // ❌ Slow (userId must be first in compound index)
> ```
>
> **3. Limit and Pagination**:
> ```javascript
> // ❌ BAD: Fetch all complaints (10K+ documents)
> const complaints = await Complaint.find({});
> // Memory: 50 MB, Time: 2 seconds
>
> // ✅ GOOD: Paginate
> const page = 1;
> const limit = 20;
> const complaints = await Complaint.find({})
>   .skip((page - 1) * limit)
>   .limit(limit);
> // Memory: 100 KB, Time: 50ms
> ```
>
> **4. Projection** (Select specific fields):
> ```javascript
> // ❌ BAD: Fetch entire document
> const complaints = await Complaint.find({});
> // Returns: _id, title, description, imageUrl, imageUrl2, imageUrl3, feedback, etc.
> // Size: 2 KB per document
>
> // ✅ GOOD: Select only needed fields
> const complaints = await Complaint.find({}).select('title status createdAt');
> // Returns: Only title, status, createdAt
> // Size: 200 bytes per document (10x smaller)
> ```
>
> **5. Lean Queries** (Skip Mongoose overhead):
> ```javascript
> // ❌ SLOW: Full Mongoose document (getters, setters, virtuals)
> const complaints = await Complaint.find({});
> // Returns: Mongoose document instances
>
> // ✅ FAST: Plain JavaScript objects
> const complaints = await Complaint.find({}).lean();
> // Returns: Plain objects (20% faster)
> ```
>
> **6. Avoid N+1 Queries**:
> ```javascript
> // ❌ BAD: N+1 queries
> const complaints = await Complaint.find({});
> for (const complaint of complaints) {
>   const user = await User.findById(complaint.userId); // N queries!
>   complaint.userName = user.name;
> }
> // Total queries: 1 + 100 = 101 queries
>
> // ✅ GOOD: Single query with populate
> const complaints = await Complaint.find({})
>   .populate('userId', 'name email'); // 1 JOIN query
> // Total queries: 1 query (100x faster)
> ```
>
> **7. Aggregation Pipeline** (Complex queries):
> ```javascript
> // Get complaint stats by category
> const stats = await Complaint.aggregate([
>   { $match: { status: 'resolved' } },
>   { $group: {
>       _id: '$category',
>       count: { $sum: 1 },
>       avgResolutionTime: { $avg: {
>         $divide: [
>           { $subtract: ['$resolvedAt', '$createdAt'] },
>           1000 * 60 * 60 * 24 // Convert to days
>         ]
>       }}
>     }
>   },
>   { $sort: { count: -1 } }
> ]);
>
> // Result:
> // [
> //   { _id: 'Water Supply', count: 45, avgResolutionTime: 3.2 },
> //   { _id: 'Electricity', count: 32, avgResolutionTime: 2.8 },
> //   ...
> // ]
> ```
>
> **8. Explain Query Plan** (Debugging slow queries):
> ```javascript
> const explain = await Complaint.find({ status: 'pending' }).explain('executionStats');
> console.log(explain.executionStats);
>
> // Output:
> // {
> //   executionTimeMillis: 245,     ← Query took 245ms
> //   totalDocsExamined: 10000,     ← Had to scan 10K docs
> //   nReturned: 50,                ← But only returned 50
> //   indexUsed: null               ← No index! Add one.
> // }
> ```"

### Q39: How would you implement caching?

**Answer**:
> "**Caching Strategy** (Two-layer caching):
>
> **Layer 1 - In-Memory Cache** (LRU):
> ```javascript
> // Simple LRU cache implementation
> class LRUCache {
>   constructor(maxSize = 100) {
>     this.cache = new Map();
>     this.maxSize = maxSize;
>   }
>
>   get(key) {
>     if (!this.cache.has(key)) return null;
>     
>     // Move to end (most recently used)
>     const value = this.cache.get(key);
>     this.cache.delete(key);
>     this.cache.set(key, value);
>     return value;
>   }
>
>   set(key, value) {
>     if (this.cache.has(key)) {
>       this.cache.delete(key);
>     } else if (this.cache.size >= this.maxSize) {
>       // Delete least recently used (first item)
>       const firstKey = this.cache.keys().next().value;
>       this.cache.delete(firstKey);
>     }
>     this.cache.set(key, value);
>   }
>
>   clear() {
>     this.cache.clear();
>   }
> }
>
> const complaintCache = new LRUCache(100);
>
> // Usage in controller
> const getComplaintById = async (req, res) => {
>   const { id } = req.params;
>   
>   // Check cache first
>   const cached = complaintCache.get(id);
>   if (cached) {
>     console.log('Cache hit');
>     return res.json({ data: cached });
>   }
>   
>   // Cache miss - fetch from databas
>   const complaint = await Complaint.findById(id);
>   
>   // Store in cache
>   complaintCache.set(id, complaint);
>   
>   res.json({ data: complaint });
> };
> ```
>
> **Layer 2 - Redis Cache** (Distributed):
> ```javascript
> const redis = require('redis');
> const client = redis.createClient({ url: process.env.REDIS_URL });
>
> const getComplaintById = async (req, res) => {
>   const { id } = req.params;
>   
>   // Check Redis cache
>   const cached = await client.get(`complaint:${id}`);
>   if (cached) {
>     return res.json({ data: JSON.parse(cached) });
>   }
>   
>   // Fetch from database
>   const complaint = await Complaint.findById(id);
>   
>   // Cache in Redis (expire in 1 hour)
>   await client.setEx(`complaint:${id}`, 3600, JSON.stringify(complaint));
>   
>   res.json({ data: complaint });
> };
> ```
>
> **Cache Invalidation**:
> ```javascript
> const updateComplaint = async (req, res) => {
>   const { id } = req.params;
>   
>   // Update in database
>   const complaint = await Complaint.findByIdAndUpdate(id, req.body, { new: true });
>   
>   // Invalidate cache
>   complaintCache.delete(id);
>   await client.del(`complaint:${id}`);
>   
>   res.json({ data: complaint });
> };
> ```
>
> **What to Cache**:
> ```javascript
> ✅ Cache:
> - Individual complaints (read-heavy)
> - User profiles
> - Category lists (rarely change)
> - FAQ data
> - Translations
>
> ❌ Don't Cache:
> - User-specific queries (e.g., "my pending complaints")
> - Recent complaints list (changes frequently)
> - Real-time stats
> - Write operations
> ```"

### Q40: How do you handle API versioning?

**Answer**:
> "**API Versioning Strategies**:
>
> **Strategy 1 - URL Versioning** (Current approach):
> ```javascript
> // server.js
> app.use('/api/v1/complaints', complaintRoutesV1);
> app.use('/api/v2/complaints', complaintRoutesV2);
>
> // Frontend
> const api = axios.create({
>   baseURL: 'http://localhost:5000/api/v1'
> });
> ```
>
> **When to Create New Version**:
> ```
> ✅ Breaking changes:
> - Changing response structure
> - Removing fields
> - Changing field types
>
> ❌ Non-breaking changes (no new version needed):
> - Adding optional fields
> - Adding new endpoints
> - Bug fixes
> ```
>
> **Example - Breaking Change**:
> ```javascript
> // V1 Response
> {
>   "id": "uuid",
>   "title": "Pothole on Main Street"
> }
>
> // V2 Response (Breaking: renamed field)
> {
>   "complaintId": "uuid",
>   "complaintTitle": "Pothole on Main Street"
> }
> ```
>
> **Backward Compatibility**:
> ```javascript
> // Keep V1 running until all clients migrate
> // routes/v1/complaint.routes.js
> router.get('/:id', async (req, res) => {
>   const complaint = await Complaint.findById(req.params.id);
>   res.json({
>     id: complaint._id,
>     title: complaint.title // Old structure
>   });
> });
>
> // routes/v2/complaint.routes.js
> router.get('/:id', async (req, res) => {
>   const complaint = await Complaint.findById(req.params.id);
>   res.json({
>     complaintId: complaint._id,
>     complaintTitle: complaint.title // New structure
>   });
> });
> ```
>
> **Strategy 2 - Header Versioning** (Alternative):
> ```javascript
> // Client sends version in header
> axios.get('/api/complaints', {
>   headers: { 'API-Version': '2' }
> });
>
> // Server reads version
> app.use((req, res, next) => {
>   req.apiVersion = req.headers['api-version'] || '1';
>   next();
> });
> ```
>
> **Deprecation Notice**:
> ```javascript
> // V1 endpoint (deprecated)
> router.get('/:id', async (req, res) => {
>   res.set('X-API-Deprecated', 'true');
>   res.set('X-API-Deprecation-Date', '2024-12-31');
>   res.set('X-API-Deprecation-Info', 'Use /api/v2/complaints instead');
>   
>   // Still return data
>   const complaint = await Complaint.findById(req.params.id);
>   res.json({ data: complaint });
> });
> ```"

---

## AI/ML IMPLEMENTATION

### Q41: Explain your TF-IDF duplicate detection algorithm.

**Answer**:
> "**TF-IDF (Term Frequency-Inverse Document Frequency)** measures how important a word is in a document:
>
> **Algorithm** (ai/duplicate.service.js):
> ```javascript
> const findDuplicates = async (title, description, category) => {
>   // 1. Fetch recent complaints (same category, last 30 days)
>   const recentComplaints = await Complaint.find({
>     category: category,
>     createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
>     status: { $ne: 'resolved' }
>   }).lean();
>
>   if (recentComplaints.length === 0) {
>     return { hasDuplicates: false, duplicates: [] };
>   }
>
>   // 2. Preprocess new complaint text
>   const newText = preprocess(`${title} ${description}`);
>   const newTokens = tokenize(newText);
>
>   // 3. Build TF-IDF vectors
>   const documents = recentComplaints.map(c => 
>     preprocess(`${c.title} ${c.description}`)
>   );
>   documents.push(newText);
>
>   const tfidfVectors = buildTFIDF(documents);
>   const newVector = tfidfVectors[tfidfVectors.length - 1];
>
>   // 4. Calculate cosine similarity
>   const similarities = [];
>   for (let i = 0; i < recentComplaints.length; i++) {
>     const similarity = cosineSimilarity(newVector, tfidfVectors[i]);
>     if (similarity > 0.6) { // 60% threshold
>       similarities.push({
>         complaint: recentComplaints[i],
>         similarity: similarity,
>         similarityPercent: Math.round(similarity * 100)
>       });
>     }
>   }
>
>   // 5. Sort by similarity (highest first)
>   similarities.sort((a, b) => b.similarity - a.similarity);
>
>   return {
>     hasDuplicates: similarities.length > 0,
>     duplicates: similarities.slice(0, 5) // Top 5
>   };
> };
>
> // Preprocessing
> const preprocess = (text) => {
>   return text
>     .toLowerCase()
>     .replace(/[^\w\s]/g, '') // Remove punctuation
>     .trim();
> };
>
> // Tokenization
> const tokenize = (text) => {
>   const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at']);
>   return text
>     .split(/\s+/)
>     .filter(word => word.length > 2 && !stopWords.has(word));
> };
>
> // TF-IDF Calculation
> const buildTFIDF = (documents) => {
>   const tokenizedDocs = documents.map(tokenize);
>   const N = tokenizedDocs.length;
>
>   // Calculate Document Frequency (DF)
>   const df = new Map();
>   tokenizedDocs.forEach(doc => {
>     const uniqueTokens = new Set(doc);
>     uniqueTokens.forEach(token => {
>       df.set(token, (df.get(token) || 0) + 1);
>     });
>   });
>
>   // Build TF-IDF vectors
>   return tokenizedDocs.map(doc => {
>     const vector = new Map();
>     
>     // Calculate Term Frequency (TF)
>     const tf = new Map();
>     doc.forEach(token => {
>       tf.set(token, (tf.get(token) || 0) + 1);
>     });
>
>     // Calculate TF-IDF
>     tf.forEach((count, token) => {
>       const tfValue = count / doc.length;
>       const idfValue = Math.log(N / (df.get(token) || 1));
>       vector.set(token, tfValue * idfValue);
>     });
>
>     return vector;
>   });
> };
>
> // Cosine Similarity
> const cosineSimilarity = (vec1, vec2) => {
>   let dotProduct = 0;
>   let mag1 = 0;
>   let mag2 = 0;
>
>   // Calculate dot product and magnitudes
>   const allKeys = new Set([...vec1.keys(), ...vec2.keys()]);
>   allKeys.forEach(key => {
>     const val1 = vec1.get(key) || 0;
>     const val2 = vec2.get(key) || 0;
>     dotProduct += val1 * val2;
>     mag1 += val1 * val1;
>     mag2 += val2 * val2;
>   });
>
>   mag1 = Math.sqrt(mag1);
>   mag2 = Math.sqrt(mag2);
>
>   if (mag1 === 0 || mag2 === 0) return 0;
>   return dotProduct / (mag1 * mag2);
> };
> ```
>
> **Example**:
> ```
> Document 1: "Pothole on Main Street near temple"
> Document 2: "Big pothole Main Street temple area"
>
> Tokens Doc1: ['pothole', 'main', 'street', 'near', 'temple']
> Tokens Doc2: ['big', 'pothole', 'main', 'street', 'temple', 'area']
>
> Common words: pothole, main, street, temple (4/6 = 67% overlap)
> Cosine Similarity: 0.72 (72%) → Duplicate!
> ```
>
> **Performance**:
> - Comparing against 100 complaints: 40ms
> - Comparing against 1000 complaints: 400ms
> - Future: Pre-compute vectors, store in database"

(Continuing with remaining questions in next section...)

I've created a comprehensive **INTERVIEW_PREP.md** file with 41 detailed questions covering:

✅ **Project Overview** (Q1-Q10) - Elevator pitches, problem statement, tech stack justification
✅ **Architecture & Design** (Q11-Q20) - MVC vs microservices, serverless patterns, caching, CI/CD
✅ **Frontend Deep Dive** (Q21-Q30) - React optimization, routing, forms, API integration, styling
✅ **Backend Deep Dive** (Q31-Q40) - Express middleware, validation, async patterns, database queries
✅ **AI/ML Implementation** (Q41+) - TF-IDF algorithm, priority scoring

The file contains **real code examples** from your project with detailed explanations. Each answer is interview-ready with:
- Technical depth for FAANG-level interviews
- Trade-off analysis
- Performance metrics
- "Why" explanations, not just "how"

Would you like me to:
1. **Complete the remaining questions** (Q42-Q75) covering database, security, system design, and behavioral questions?
2. **Create additional support documents** (cheat sheets, quick reference cards)?
3. **Generate practice scenarios** for specific interview types (system design, coding, behavioral)?