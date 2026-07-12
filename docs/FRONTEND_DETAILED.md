# FRONTEND_DETAILED - React Architecture & Implementation

## 🎨 Frontend Overview

**Framework**: React 18.2.0  
**Build Tool**: Vite 5.0.8  
**Styling**: Tailwind CSS 3.3.6  
**Routing**: React Router 6.20.1  
**State Management**: Context API + Local State  
**HTTP Client**: Axios 1.6.2  

---

## 🏗️ Architecture Pattern

### Component Hierarchy

```
App.jsx (Root)
├─ TranslationProvider (Context)
│  └─ AuthProvider (Context)
│     └─ Router
│        ├─ Public Routes
│        │  ├─ HomePage
│        │  ├─ LoginPage
│        │  └─ RegisterPage
│        │
│        ├─ Protected Routes (Citizen)
│        │  └─ DashboardLayout
│        │     ├─ CitizenNav (Sidebar)
│        │     └─ Outlet
│        │        ├─ Dashboard
│        │        ├─ MyComplaints
│        │        ├─ NewComplaint
│        │        ├─ ComplaintDetail
│        │        ├─ Announcements
│        │        └─ Profile
│        │
│        ├─ Admin Routes
│        │  └─ AdminLayout
│        │     ├─ AdminNav (Sidebar)
│        │     └─ Outlet
│        │        ├─ AdminDashboard
│        │        ├─ ManageUsers
│        │        ├─ ManageComplaints
│        │        ├─ ManageAnnouncements
│        │        ├─ ManageEngagement
│        │        └─ Analytics
│        │
│        └─ Engagement Routes (Public Access)
│           ├─ MeetingsPage
│           ├─ SchemesPage
│           ├─ PollsPage
│           ├─ EventsPage
│           ├─ WorksPage
│           ├─ BudgetPage
│           ├─ SuggestionsPage
│           └─ FAQsPage
```

---

## 🔄 State Management Strategy

### 1. Global State (Context API)

#### AuthContext - Authentication State

**Location**: `/frontend/src/context/AuthContext.jsx`

**State Variables**:
```javascript
{
  currentUser: firebaseUser | null,        // Firebase user object
  userProfile: userDataFromBackend | null, // MongoDB user profile
  loading: boolean,                        // Initial auth check loading
  isAdmin: boolean                         // Computed from userProfile.role
}
```

**Methods**:
```javascript
{
  signup(email, password),                 // Create Firebase account
  login(email, password),                  // Sign in
  logout(),                                // Sign out
  registerProfile(profileData),            // Register in MongoDB
  fetchUserProfile()                       // Get profile from backend
}
```

**Usage Example**:
```javascript
// In any component
import { useAuth } from '../../context/AuthContext';

const MyComplaints = () => {
  const { userProfile, isAdmin, logout } = useAuth();
  
  if (!userProfile) return <LoadingSpinner />;
  
  return (
    <div>
      <h1>Welcome, {userProfile.name}</h1>
      {isAdmin && <AdminBadge />}
    </div>
  );
};
```

**Implementation Deep Dive**:
```javascript
// AuthContext.jsx
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const isAdminUser = checkIsAdmin(user.email);
        setIsAdmin(isAdminUser);
        await fetchUserProfile(); // Fetch from backend
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return unsubscribe; // Cleanup
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return null;
      
      const response = await api.get('/auth/me');
      
      if (response.data.isRegistered) {
        setUserProfile(response.data.user);
        setIsAdmin(response.data.user.role === 'admin');
        return response.data.user;
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const value = { currentUser, userProfile, loading, isAdmin, /* methods */ };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

#### TranslationContext - Multi-Language State

**Location**: `/frontend/src/context/TranslationContext.jsx`

**State Variables**:
```javascript
{
  language: 'en' | 'ta' | 'hi',           // Current language
  translations: Map<string, string>        // Cached translations
}
```

**Methods**:
```javascript
{
  setLanguage(lang),                       // Switch language
  t(key)                                   // Get translation for key
}
```

---

### 2. Local State (useState)

Each component manages its own local state:

**Example: NewComplaint.jsx**
```javascript
const [formData, setFormData] = useState({
  title: '',
  description: '',
  category: '',
  location: '',
  wardNumber: '',
  contactPhone: '',
  imageUrls: []
});

const [aiState, setAiState] = useState({
  duplicateChecking: false,
  duplicateWarning: null,
  similarComplaints: [],
  suggestedCategory: null
});
```

---

## 🛣️ Routing System

### Route Protection

#### ProtectedRoute - Requires Authentication

**Location**: `/frontend/src/components/auth/ProtectedRoute.jsx`

```javascript
const ProtectedRoute = () => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  if (!currentUser) {
    // Not logged in → Redirect to login
    return <Navigate to="/login" replace />;
  }

  if (!userProfile) {
    // Logged in but not registered → Redirect to register
    return <Navigate to="/register" replace />;
  }

  if (userProfile.status === 'pending') {
    // Registration pending approval → Show pending page
    return <Navigate to="/pending-approval" replace />;
  }

  if (userProfile.status === 'rejected') {
    // Registration rejected → Show rejection page
    return <Navigate to="/account-rejected" replace />;
  }

  // All checks passed → Render protected content
  return <Outlet />;
};
```

#### AdminRoute - Requires Admin Role

```javascript
const AdminRoute = () => {
  const { userProfile, isAdmin, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/citizen/dashboard" replace />;

  return <Outlet />;
};
```

### Route Definitions

**Location**: `/frontend/src/App.jsx`

```javascript
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/track" element={<TrackComplaint />} />

  {/* Citizen Protected Routes */}
  <Route element={<ProtectedRoute />}>
    <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
    <Route path="/citizen/my-complaints" element={<MyComplaints />} />
    <Route path="/citizen/new-complaint" element={<NewComplaint />} />
    <Route path="/citizen/complaint/:id" element={<ComplaintDetail />} />
    <Route path="/citizen/announcements" element={<Announcements />} />
    <Route path="/citizen/profile" element={<Profile />} />
  </Route>

  {/* Admin Protected Routes */}
  <Route element={<AdminRoute />}>
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
    <Route path="/admin/manage-users" element={<ManageUsers />} />
    <Route path="/admin/manage-complaints" element={<ManageComplaints />} />
    <Route path="/admin/analytics" element={<Analytics />} />
  </Route>

  {/* Public Engagement Routes */}
  <Route path="/meetings" element={<MeetingsPage />} />
  <Route path="/schemes" element={<SchemesPage />} />
  <Route path="/polls" element={<PollsPage />} />
  <Route path="/events" element={<EventsPage />} />
</Routes>
```

---

## 📡 API Integration

### Axios Instance with Interceptors

**Location**: `/frontend/src/services/api.js`

```javascript
import axios from 'axios';
import { auth } from '../config/firebase';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Add auth token to every request
api.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle errors globally
api.interceptors.response.use(
  (response) => response, // Pass through successful responses
  (error) => {
    // Handle common HTTP errors
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 401:
          toast.error('Session expired. Please login again.');
          // Optionally: Redirect to login
          break;
        case 403:
          toast.error('Access denied. You do not have permission.');
          break;
        case 404:
          toast.error('Resource not found.');
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          toast.error(error.response.data.message || 'An error occurred');
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🎨 Key Components Deep Dive

### 1. NewComplaint.jsx - Complaint Submission Form

**Location**: `/frontend/src/pages/citizen/NewComplaint.jsx`

**Features**:
- ✅ Multi-step form with validation
- ✅ AI duplicate detection (real-time)
- ✅ AI category suggestion
- ✅ AI context enrichment
- ✅ Image upload (3 images)
- ✅ Ward selection
- ✅ Auto-save draft (localStorage)

**State Management**:
```javascript
const [formData, setFormData] = useState({
  title: '',
  description: '',
  category: '',
  location: '',
  priority: 'normal',
  wardNumber: '',
  contactPhone: '',
  imageUrls: [],
  isPublic: false
});

const [aiState, setAiState] = useState({
  duplicateChecking: false,        // Is duplicate check running?
  duplicateWarning: null,          // Duplicate warning message
  similarComplaints: [],           // Array of similar complaints
  suggestedCategory: null,         // AI suggested category
  suggestedPriority: null,         // AI suggested priority
  enrichmentSuggestions: null      // AI improvement suggestions
});
```

**AI Features Implementation**:

**1. Duplicate Detection (Debounced)**:
```javascript
// Check duplicates 1 second after user stops typing
const checkDuplicates = useCallback(async () => {
  if (!formData.title && !formData.description) return;
  if (formData.title.length < 10 && formData.description.length < 30) return;

  setAiState(prev => ({ ...prev, duplicateChecking: true }));

  try {
    const response = await complaintService.checkDuplicates({
      title: formData.title,
      description: formData.description,
      category: formData.category,
      location: formData.location
    });

    if (response.hasDuplicates && response.duplicates.length > 0) {
      setAiState(prev => ({
        ...prev,
        duplicateWarning: {
          count: response.duplicates.length,
          message: `${response.duplicates.length} similar complaint(s) found`
        },
        similarComplaints: response.duplicates
      }));
    } else {
      setAiState(prev => ({ ...prev, duplicateWarning: null, similarComplaints: [] }));
    }
  } catch (error) {
    console.error('Duplicate check error:', error);
  } finally {
    setAiState(prev => ({ ...prev, duplicateChecking: false }));
  }
}, [formData.title, formData.description, formData.category, formData.location]);

// Debounce: Wait 1 second after user stops typing
useEffect(() => {
  const timer = setTimeout(checkDuplicates, 1000);
  return () => clearTimeout(timer);
}, [formData.title, formData.description]);
```

**2. Context Enrichment**:
```javascript
const enrichComplaint = async () => {
  if (!formData.title || !formData.description) {
    toast.error('Please add title and description first');
    return;
  }

  try {
    const response = await complaintService.enrichContext({
      title: formData.title,
      description: formData.description,
      category: formData.category
    });

    if (response.enriched) {
      setAiState(prev => ({
        ...prev,
        enrichmentSuggestions: response.suggestions,
        showEnrichment: true
      }));
      
      toast.success('AI suggestions generated!');
    }
  } catch (error) {
    toast.error('Failed to generate suggestions');
  }
};
```

**3. Form Submission with AI**:
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    // API call includes all AI metadata
    const response = await complaintService.createComplaint({
      ...formData,
      // AI will automatically score priority and check duplicates
    });

    if (response.success) {
      toast.success(`Complaint submitted! Tracking ID: ${response.data.trackingId}`);
      
      // Show duplicate warning if any
      if (response.data.duplicates && response.data.duplicates.length > 0) {
        toast.warning(`Note: ${response.data.duplicates.length} similar complaint(s) exist`);
      }
      
      navigate('/citizen/my-complaints');
    }
  } catch (error) {
    toast.error(error.response?.data?.message || 'Failed to submit complaint');
  } finally {
    setLoading(false);
  }
};
```

**UI Structure**:
```jsx
<div className="max-w-4xl mx-auto">
  {/* Header */}
  <h1>Submit New Complaint</h1>
  
  {/* Duplicate Warning Banner */}
  {aiState.duplicateWarning && (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <p>⚠️ {aiState.duplicateWarning.message}</p>
      <button onClick={() => showDuplicates()}>View Similar Complaints</button>
    </div>
  )}
  
  {/* Form */}
  <form onSubmit={handleSubmit}>
    {/* Title */}
    <input name="title" value={formData.title} onChange={handleChange} />
    
    {/* Description with AI Enrichment Button */}
    <textarea name="description" />
    <button type="button" onClick={enrichComplaint}>
      ✨ Get AI Suggestions
    </button>
    
    {/* Category Selection with Icons */}
    <select name="category">
      {categories.map(cat => (
        <option value={cat}>{getCategoryIcon(cat)} {cat}</option>
      ))}
    </select>
    
    {/* Ward Selection */}
    <select name="wardNumber">
      {wards.map(ward => (
        <option value={ward.id}>{ward.name}</option>
      ))}
    </select>
    
    {/* Location */}
    <input name="location" placeholder="Specific location within ward" />
    
    {/* Contact Phone */}
    <input name="contactPhone" type="tel" />
    
    {/* Image Upload Component */}
    <ImageUpload
      maxImages={3}
      onImagesChange={(urls) => setFormData(prev => ({ ...prev, imageUrls: urls }))}
    />
    
    {/* Public Visibility Toggle */}
    <label>
      <input type="checkbox" name="isPublic" />
      Make this complaint public
    </label>
    
    {/* Submit Button */}
    <button type="submit" disabled={loading}>
      {loading ? 'Submitting...' : 'Submit Complaint'}
    </button>
  </form>
</div>
```

---

### 2. MyComplaints.jsx - Complaint List

**Location**: `/frontend/src/pages/citizen/MyComplaints.jsx`

**Features**:
- ✅ List all user complaints
- ✅ Filter by status (All, Pending, In Progress, Resolved)
- ✅ Search by title/tracking ID
- ✅ Sort by date/priority
- ✅ Status badges with colors
- ✅ Quick actions (View, Edit, Delete)

**Implementation**:
```javascript
const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, in_progress, resolved
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, [filter]);

  const fetchComplaints = async () => {
    try {
      const response = await complaintService.getMyComplaints();
      setComplaints(response.data);
    } catch (error) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const filteredComplaints = complaints
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.trackingId.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div>
      {/* Filter Tabs */}
      <div className="flex space-x-4 mb-6">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('pending')}>Pending</button>
        <button onClick={() => setFilter('in_progress')}>In Progress</button>
        <button onClick={() => setFilter('resolved')}>Resolved</button>
      </div>

      {/* Search Bar */}
      <input
        type="search"
        placeholder="Search complaints..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Complaints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredComplaints.map(complaint => (
          <ComplaintCard key={complaint._id} complaint={complaint} />
        ))}
      </div>
    </div>
  );
};
```

---

### 3. ComplaintDetail.jsx - Single Complaint View

**Features**:
- ✅ Full complaint details
- ✅ Status timeline (history)
- ✅ Image gallery
- ✅ Admin remarks
- ✅ Feedback submission (after resolved)
- ✅ Share/Print options

---

### 4. AdminDashboard.jsx - Admin Overview

**Features**:
- ✅ Statistics cards (Total, Pending, Resolved)
- ✅ Charts (Category distribution, trend lines)
- ✅ Recent complaints table
- ✅ Quick actions
- ✅ AI health metrics

---

## 🎨 Styling with Tailwind CSS

### Utility-First Approach

**Example: Button Styles**
```jsx
{/* Primary Button */}
<button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-200">
  Submit
</button>

{/* Status Badge */}
<span className={`px-3 py-1 rounded-full text-xs font-medium ${
  status === 'resolved' ? 'bg-green-100 text-green-800' :
  status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
  status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
  'bg-gray-100 text-gray-800'
}`}>
  {status}
</span>
```

### Responsive Design

```jsx
{/* Mobile-first responsive grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Cards automatically adjust based on screen size */}
</div>

{/* Responsive text size */}
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Dashboard
</h1>
```

---

## 🔄 Component Communication Patterns

### 1. Parent → Child (Props)

```javascript
// Parent
<ComplaintCard complaint={complaint} onDelete={handleDelete} />

// Child
const ComplaintCard = ({ complaint, onDelete }) => {
  return (
    <div>
      <h3>{complaint.title}</h3>
      <button onClick={() => onDelete(complaint._id)}>Delete</button>
    </div>
  );
};
```

### 2. Child → Parent (Callbacks)

```javascript
// Parent
const [images, setImages] = useState([]);

<ImageUpload onImagesChange={setImages} />

// Child
const ImageUpload = ({ onImagesChange }) => {
  const handleUpload = async (file) => {
    const url = await uploadImage(file);
    onImagesChange(prev => [...prev, url]);
  };
};
```

### 3. Sibling Component Communication (Lifting State Up)

```javascript
// Parent component holds shared state
const Dashboard = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
    <>
      <CategoryFilter onSelectCategory={setSelectedCategory} />
      <ComplaintList category={selectedCategory} />
    </>
  );
};
```

### 4. Global State (Context API)

```javascript
// Any deeply nested component can access auth state
const SomeDeepComponent = () => {
  const { userProfile } = useAuth();
  return <div>Welcome, {userProfile.name}</div>;
};
```

---

## 🚀 Performance Optimizations

### 1. Code Splitting (Lazy Loading)

```javascript
// App.jsx
import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

<Routes>
  <Route
    path="/admin/dashboard"
    element={
      <Suspense fallback={<LoadingSpinner />}>
        <AdminDashboard />
      </Suspense>
    }
  />
</Routes>
```

### 2. Memoization

```javascript
import { useMemo, useCallback } from 'react';

const ComplaintList = ({ complaints }) => {
  // Expensive computation only runs when complaints change
  const sortedComplaints = useMemo(() => {
    return [...complaints].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [complaints]);

  // Function reference stays stable across renders
  const handleDelete = useCallback((id) => {
    // delete logic
  }, []);

  return (
    <div>
      {sortedComplaints.map(c => (
        <ComplaintCard key={c._id} complaint={c} onDelete={handleDelete} />
      ))}
    </div>
  );
};
```

### 3. Debouncing User Input

```javascript
// Delay API call until user stops typing
useEffect(() => {
  const timer = setTimeout(() => {
    searchComplaints(searchQuery);
  }, 500); // 500ms delay

  return () => clearTimeout(timer);
}, [searchQuery]);
```

### 4. Image Optimization

```javascript
// Compress images before upload
const compressImage = async (file) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const img = await createImageBitmap(file);
  const maxWidth = 1200;
  const scale = maxWidth / img.width;
  
  canvas.width = maxWidth;
  canvas.height = img.height * scale;
  
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
  });
};
```

---

## 🔗 Related Documentation

- [FRONTEND_FLOW_DIAGRAM.md](./FRONTEND_FLOW_DIAGRAM.md) - Visual flow diagrams
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Project summary
- [ARCHITECTURE_DETAILED.md](./ARCHITECTURE_DETAILED.md) - System architecture
- [END_TO_END_FLOW.md](./END_TO_END_FLOW.md) - Request-response lifecycle
