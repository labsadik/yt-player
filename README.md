# UnscPlay - Complete README

A real-time YouTube video streaming platform with admin dashboard, smart search, Socket.IO live updates, and JWT authentication.

---

## ✨ Features

### 🎥 Video Player (Frontend)
- YouTube IFrame API with custom controls: play/pause, seek, progress bar, fullscreen
- Keyboard shortcuts: `Space` (play), `F` (fullscreen), `←/→` (seek ±5s)
- Responsive thumbnail overlay with smooth animations
- Auto URL sync (`?id=VIDEO_ID`) for direct video links
- Infinite scroll with pagination

### 🔍 Smart Search (Frontend)
- Fuzzy matching using Levenshtein distance algorithm
- Relevance scoring: exact match (100pts) → starts with (85pts) → contains (65pts) → word-level bonus
- Debounced input (250ms) for smooth performance
- Real-time filtering without page reload

### 🔄 Real-Time Updates (Socket.IO)
- WebSocket connection for instant database synchronization
- Auto-reconnect with exponential backoff + HTTP polling fallback
- Live toast notifications when videos are added/updated/deleted
- Zero page refresh needed - playlist updates instantly across all clients

### 👨‍💻 Admin Dashboard (Frontend + Backend)
- Full CRUD operations: Create, Read, Update, Delete videos
- Role-based access control: only `role: "admin"` users can manage content
- Secure form handling with XSS prevention (DOM-based rendering)
- Edit modal with smooth scale animations
- Live list refresh after each operation

### 🔐 Authentication (Frontend + Backend)
- JWT token-based authentication with localStorage storage
- Password hashing with bcrypt on backend
- Role-based redirects after login (`admin` → `/feed/admin/`, `user` → `/`)
- Token validation middleware on all protected endpoints
- Auto-logout on invalid/expired tokens

### 🛡️ Security (Both)
- XSS prevention: `Security.sanitize()` + `textContent` for all user input
- URL validation: `Security.safeUrl()` ensures only `https://` URLs accepted
- DevTools detection: logs warning if browser inspector opens
- Client-side rate limiting: blocks API calls faster than 700ms apart
- Server-side JWT verification on every protected route
- CORS configuration for frontend/backend origin matching

### 🎨 UI/UX (Frontend)
- Theme switching: `ny-dark` / `white` modes with localStorage persistence
- Skeleton loaders for smooth perceived performance
- Dynamic shuffle on initial load (Fisher-Yates algorithm)
- Mobile-responsive design (Tailwind CSS utility classes)
- Toast notifications with auto-dismiss (3 seconds)

---

## 🚀 How It Works - Full Flow

```
1. USER OPENS APP
   ↓
2. Frontend loads → initAuth() checks localStorage for token
   ↓
3. If no token → redirect to /auth/ (login page)
   If valid token → fetchVideos() from API + initSocketIO()
   ↓
4. Socket.IO connects to backend → listens for real-time events
   ↓
5. Videos render with shuffle + skeleton loaders → infinite scroll on scroll
   ↓
6. USER CLICKS VIDEO
   ↓
7. loadVideoState() → updates URL + loads YouTube player with custom controls
   ↓
8. USER SEARCHES
   ↓
9. handleSearchInput() → debounce → applySmartSearch() → fuzzy match → re-render
   ↓
10. ADMIN ADDS VIDEO (via /feed/admin/)
    ↓
11. Frontend POST /api/videos → Backend validates + saves to DB
    ↓
12. Backend emits socket event: io.emit('video:created', newVideo)
    ↓
13. ALL connected clients receive event → handleVideoCreated() → prepend to playlist + toast
    ↓
14. Playlist updates instantly - no refresh needed ✅
```

---

## 🔌 API Endpoints (Backend - localhost:5000)

### Videos
| Method | Endpoint | Auth Required | Description | Request Body | Success Response |
|--------|----------|--------------|-------------|-------------|-----------------|
| GET | `/api/videos` | ❌ | List videos (paginated) | `?page=1&limit=12&search=query` | `{ videos: [...], page: 1, total: 50 }` |
| GET | `/api/videos/:id` | ❌ | Get single video by DB `_id` | - | `{ _id, id, title, thumbnail, duration }` |
| POST | `/api/videos` | ✅ Admin | Create new video | `{ id: "YT_ID", title: "Title", duration: "3:45" }` | `{ success: true, video: {...} }` |
| PUT | `/api/videos/:id` | ✅ Admin | Update video metadata | `{ id?, title?, thumbnail?, duration? }` | `{ success: true, video: {...} }` |
| DELETE | `/api/videos/:id` | ✅ Admin | Delete video | - | `{ success: true, message: "Deleted" }` |

### Authentication
| Method | Endpoint | Auth Required | Description | Request Body | Success Response |
|--------|----------|--------------|-------------|-------------|-----------------|
| POST | `/api/auth/register` | ❌ | Register new user | `{ name, email, password }` | `{ msg: "User created", token, user: {name, email, role} }` |
| POST | `/api/auth/login` | ❌ | Login existing user | `{ email, password }` | `{ msg: "Login successful", token, user: {name, email, role} }` |
| GET | `/api/auth/me` | ✅ | Get current user info | - | `{ user: {name, email, role} }` |

---

## 🔄 Socket.IO Events (Real-Time)

### Client → Server
```javascript
// Auto-connects on page load
const socket = io("http://localhost:5000");

// Optional: request initial sync after connect
socket.emit("client:sync", { timestamp: Date.now() });

// Listen for connection status
socket.on("connect", () => console.log("✓ Connected:", socket.id));
socket.on("disconnect", (reason) => console.log("✗ Disconnected:", reason));
socket.on("connect_error", (err) => console.warn("⚠️ Error:", err.message));
```

### Server → Client (Broadcast to All)
```javascript
// 🎯 Bulk refresh - all videos updated (fallback/sync)
socket.on("videos:refresh", (payload) => {
  // payload: { videos: [...], timestamp: 1234567890 }
  // Action: Replace local state.videos, re-render playlist
});

// ➕ New video added to database
socket.on("video:created", (video) => {
  // video: { _id, id, title, thumbnail, duration, createdAt }
  // Action: Prepend to state.videos, show toast "➕ New: Title"
});

// ➖ Video deleted from database
socket.on("video:deleted", (deletedId) => {
  // deletedId: MongoDB _id string
  // Action: Remove from state, auto-load next video if current was deleted
});

// ✏️ Video metadata updated
socket.on("video:updated", (updatedVideo) => {
  // updatedVideo: Partial or full video object
  // Action: Merge into existing state, update UI if currently playing
});
```

---

## 🔐 Authentication Flow (Step-by-Step)

```
1. User visits /auth/
   ↓
2. Enters email + password → clicks "Sign In"
   ↓
3. Frontend: POST /api/auth/login { email, password }
   ↓
4. Backend: 
   - Find user by email in MongoDB
   - Compare password with bcrypt.compare()
   - If match: generate JWT token with { user: { id, email, role } }
   ↓
5. Backend response: 200 { msg: "Login successful", token, user }
   ↓
6. Frontend:
   - localStorage.setItem("token", token)
   - localStorage.setItem("user", JSON.stringify(user))
   - showToast("Login Successful! Redirecting...", "success")
   ↓
7. After 1 second:
   - If user.role === "admin" → window.location.href = "/feed/admin/"
   - Else → window.location.href = "/"
   ↓
8. Protected pages check auth on load:
   - const token = localStorage.getItem("token")
   - If no token → redirect to /auth/
   - If token exists → include in API headers: { Authorization: `Bearer ${token}` }
```

---

## 🛡️ Security Implementation

### XSS Prevention (Frontend)
```javascript
// ❌ NEVER do this - allows script injection:
element.innerHTML = userInput; 

// ✅ ALWAYS do this - auto-escapes HTML:
element.textContent = userInput;

// ✅ For mixed content, use Security.sanitize():
Security.sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;  // Browser escapes < > & " '
  return d.innerHTML;   // Safe to insert as HTML
}
```

### DevTools Detection (Frontend)
```javascript
// Detects inspector open via window dimension changes
setInterval(() => {
  const threshold = 160;
  const devtoolsOpen = 
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold;
  if (devtoolsOpen && !warned) {
    console.warn('[🔐 SEC] Developer tools detected');
    warned = true; // Log once per session
  }
}, 1500);
```

### Rate Limiting (Frontend + Backend Recommended)
```javascript
// Client-side (UX only - NOT security):
let lastCall = 0;
window.checkRateLimit = () => {
  const now = Date.now();
  if (now - lastCall < 700) return false; // Block if <700ms
  lastCall = now;
  return true;
};
// Usage: if (!window.checkRateLimit()) return;

// ⚠️ Backend MUST implement server-side rate limiting too (express-rate-limit)
```

### JWT Token Validation (Backend Middleware)
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // { id, email, role }
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
```

---

## ⚙️ Configuration (Local Development)

### Backend (.env file)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/unscplay
JWT_SECRET=your_dev_secret_key_change_in_production
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### Frontend (Update these constants in JS files)
```javascript
// app.js, admin.js, auth.js
const API_URL = "http://localhost:5000/api/videos";
const AUTH_URL = "http://localhost:5000/api/auth";
const SOCKET_URL = "http://localhost:5000"; // Same as backend origin
```

### HTML Head (All Pages)
```html
<!-- Add Socket.IO client library -->
<script src="https://cdn.socket.io/4.8.3/socket.io.min.js" crossorigin="anonymous"></script>

<!-- Add YouTube IFrame API (for video player) -->
<script src="https://www.youtube.com/iframe_api"></script>

<!-- Add Font Awesome (for icons) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

---

## 🎮 Keyboard Shortcuts

| Key | Action | Where |
|-----|--------|-------|
| `Space` | Play/Pause video | Video player page |
| `F` | Toggle fullscreen | Video player page |
| `←` | Seek backward 5 seconds | Video player page |
| `→` | Seek forward 5 seconds | Video player page |
| `Enter` | Apply search query | Search input focused |
| `Escape` | Close modal/popup | Any modal open |

---

## 🎨 Theme System

```javascript
// Set theme: 'ny-dark' | 'white' | null (default)
function setTheme(themeName) {
  document.body.classList.remove('theme-ny-dark', 'theme-white');
  if (themeName === 'ny-dark') {
    document.body.classList.add('theme-ny-dark');
    localStorage.setItem('theme', 'ny-dark');
  } else if (themeName === 'white') {
    document.body.classList.add('theme-white');
    localStorage.setItem('theme', 'white');
  } else {
    localStorage.removeItem('theme'); // Use default
  }
}

// Auto-load saved theme on page init
(function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) setTheme(savedTheme);
})();
```

---

## 🧪 Testing Checklist

```
✅ Authentication
[ ] Register new user → verify localStorage has token + user object
[ ] Login with valid credentials → verify redirect based on role
[ ] Try accessing /feed/admin/ as non-admin → verify redirect to /
[ ] Logout → verify localStorage cleared + redirect to /auth/

✅ Video Player
[ ] Load homepage → verify videos render with shuffle animation
[ ] Click video → verify YouTube player loads with correct ID
[ ] Test all controls: play/pause, seek bar, fullscreen toggle
[ ] Open DevTools → verify console warning appears once
[ ] Rapid-click play → verify rate limiter blocks extra calls

✅ Smart Search
[ ] Type "minecraft" → verify relevant videos appear first
[ ] Type "mincrft" (typo) → verify fuzzy matching still finds results
[ ] Clear search → verify full shuffled list returns
[ ] Search while scrolling → verify infinite scroll still works

✅ Real-Time Updates (Two Browser Tabs)
[ ] Open player in Tab A, admin dashboard in Tab B
[ ] In Tab B: Add new video via admin form
[ ] In Tab A: Verify new video appears instantly with ✅ toast
[ ] In Tab B: Delete a video
[ ] In Tab A: Verify video disappears, auto-loads next if was playing

✅ Admin CRUD
[ ] Add video with valid YouTube ID → verify appears in list immediately
[ ] Edit video title → verify changes reflect in player + playlist
[ ] Delete video → confirm modal → verify removal from all views
[ ] Try adding duplicate YouTube ID → verify backend validation error
```

---

## ⌨️ Quick Copy-Paste Setup

### 1. Start Backend (localhost:5000)
```bash
# Install dependencies
npm install express socket.io mongoose cors jsonwebtoken bcryptjs dotenv

# Create .env file with config above
# Create server.js with Express + Socket.IO + MongoDB setup

# Start server
node server.js
# → Server running at http://localhost:5000
```

### 2. Start Frontend (localhost:3000)
```bash
# Serve static files (any method):
python3 -m http.server 3000
# OR
npx serve . -p 3000
# OR use VS Code Live Server extension

# Open browser:
🔗 http://localhost:3000          → Public video player
🔗 http://localhost:3000/auth/    → Login/Register
🔗 http://localhost:3000/feed/admin/ → Admin dashboard (admin only)
```

### 3. Update API URLs in Frontend JS
```javascript
// Change from production to local:
const API_URL = "http://localhost:5000/api/videos";  // ← was: https://yt-player-pbmv.onrender.com
const AUTH_URL = "http://localhost:5000/api/auth";
const SOCKET_URL = "http://localhost:5000";
```

### 4. Add Socket.IO to HTML
```html
<!-- In <head> of index.html, admin.html, auth.html -->
<script src="https://cdn.socket.io/4.8.3/socket.io.min.js" crossorigin="anonymous"></script>
```

---

> 💡 **Production Tips**: When deploying:
> 1. Replace `localhost:5000` with your deployed backend URL
> 2. Add HTTPS enforcement + Helmet.js security headers
> 3. Implement server-side rate limiting (express-rate-limit)
> 4. Add Socket.IO authentication middleware
> 5. Use environment variables for ALL secrets (never commit `.env`)
> 6. Enable MongoDB Atlas with IP whitelisting
> 7. Set `NODE_ENV=production` for optimized builds
