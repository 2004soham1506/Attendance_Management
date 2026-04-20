# Attendance System Frontend

React-based web portal for Professors and Admins of the Digital Intelligent Attendance Management System (DIAMS). Provides real-time attendance tracking, session management, analytics dashboards, and user administration.

## Overview

The frontend provides:
- **Professor Dashboard**: Start/manage attendance sessions, view course analytics
- **Admin Dashboard**: System-wide statistics, user management, session monitoring
- **Attendance Tracking**: Live updates, QR/BLE session support, manual marking
- **Analytics**: Interactive charts, per-course breakdowns, at-risk student alerts
- **User Management**: Student enrollment, CSV bulk operations, role-based access

## Stack

- **Framework**: React 19.x
- **Styling**: Tailwind CSS 3.x
- **Routing**: React Router 7.x
- **Charts**: Recharts 3.x
- **Icons**: Lucide React 1.x
- **HTTP Client**: Axios
- **QR Code**: qrcode.react
- **Build Tool**: Create React App (react-scripts)

## Project Structure

```
frontend/
├── public/                      # Static assets
├── src/
│   ├── api/
│   │   └── client.js            # Axios API client with all endpoints
│   ├── components/
│   │   ├── Layout.js            # Main sidebar + top navigation
│   │   ├── UI.js                # Shared components (Button, Badge, Empty, etc.)
│   │   └── ...
│   ├── context/
│   │   ├── AuthContext.js       # Login state, token management
│   │   └── SchedulerContext.js  # Auto-session scheduling logic
│   ├── pages/
│   │   ├── Login.js             # Login page
│   │   ├── RoleSelection.js     # Role select (Professor/Admin)
│   │   ├── ProfessorDashboard.js    # Professor overview
│   │   ├── AdminDashboard.js        # Admin session monitor
│   │   ├── AdminOverview.js         # Admin system stats
│   │   ├── CourseView.js            # Course detail & session mgmt
│   │   ├── CoursesPage.js           # List user's courses
│   │   ├── Students.js              # Live attendance log
│   │   ├── Analytics.js             # Charts & analytics
│   │   ├── Settings.js              # User settings
│   │   └── AdminCourses.js          # Course management (admin)
│   ├── App.js                   # Main router setup
│   ├── index.js                 # React DOM render
│   └── index.css                # Global styles
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── .env                         # Environment variables (git-ignored)
```

## Environment Variables

Create a `.env` file in the frontend directory:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:4040

# Optional: Feature flags
REACT_APP_DEBUG=false
```

## Installation & Setup

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file (see above)

3. Start the development server:
   ```bash
   npm start
   ```

   Opens at `http://localhost:3000`

   The page will auto-reload on changes. Check the console for errors.

4. Backend should be running at `http://localhost:4040` (see [backend README](../backend/README.md))

### Production Build

```bash
npm run build
```

Creates optimized production build in `build/` folder:
- Minified and compressed assets
- Source maps excluded
- Ready for deployment

### Testing

```bash
npm test
```

Runs tests in watch mode using Jest.

## Key Components & Pages

### AuthContext
Manages user authentication state:
- Login/logout
- JWT token storage
- User role (professor/admin)
- Protected route rendering

Usage:
```jsx
import { useAuth } from "../context/AuthContext";

function MyComponent() {
  const { user, login, logout } = useAuth();
  return <div>{user?.name}</div>;
}
```

### API Client (api/client.js)
Centralized Axios instance with:
- Automatic token injection in headers
- Error handling
- Base URL configuration

All available functions:
```javascript
// Auth
login(email, password)
logout()

// Courses
getCourses()
getCourseStudents(courseId)
getCourseSchedules(courseId)
createCourse(data)
updateCourse(courseId, data)
deleteCourse(courseId)

// Sessions
startSession(courseId, method, duration)
endSession(sessionId)
getActiveSession(courseId)
getAttendance(sessionId)

// Attendance
markAttendance(sessionId, studentId, method)
manualAttendance(sessionId, studentId)
manualAttendanceBulk(data)

// Analytics
getCourseAnalytics(courseId)
getProfAnalytics()
getAdminAnalytics()
getAdminStats()

// Admin
getAllUsers()
createProfessor(data)
createStudent(data)
... and more
```

### Pages

#### Login.js
- Email/password form
- Role selection redirect
- Token storage
- Error handling

#### ProfessorDashboard.js
- List professor's courses
- Quick stats (courses, sessions, students)
- Navigation to course details

#### CourseView.js
- Session management (start/end)
- QR code display
- Live attendance tracking
- Schedule management
- Method switching (BLE/QR/Manual)

#### Analytics.js
- Attendance trends chart
- Per-session breakdown
- At-risk students list
- Export options

#### AdminDashboard.js
- All active sessions
- System-wide stats
- User management
- Backup triggers

## Integration Features

### Face Recognition
The system supports face recognition through integrated enrollment and verification:
- **Student image field**: Each student has an `imageURL` field storing their enrolled face image
- **Future integration**: Face Recognition microservice can verify student identity during attendance
- **Admin features**: AdminStudents page allows bulk student management with image data
- **Security**: Face verification adds an additional authentication layer alongside BLE/QR methods

### Session Method Flexibility
- Professors can start sessions with BLE, QR Code, or Manual attendance
- Courses support per-schedule method assignment
- Real-time method switching during active sessions if configured

### Attendance Data
- Multiple verification methods tracked: BLE, QRCode, Manual
- Per-student attendance records with exact timestamps
- Live attendance log updates every 3 seconds
- Historical attendance analytics by method and course

## Development Workflow

### Adding a New Page

1. Create file in `src/pages/NewPage.js`
2. Add route in `src/App.js`
3. Import and render in layout
4. Use `useAuth()` for protected access

### Adding API Calls

1. Add function to `src/api/client.js`
2. Import in component: `import { getMyData } from "../api/client"`
3. Use in component with axios error handling

Example:
```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  getCourses()
    .then(res => setData(res.data))
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
}, []);
```

### Styling with Tailwind

The project uses Tailwind CSS. Refer to [tailwind.config.js](./tailwind.config.js) for custom theme.

Common utilities:
```jsx
<div className="bg-card border border-edge rounded-lg p-4 text-snow">
  Custom styled box
</div>
```

Custom variables in config:
- Colors: `--color-card`, `--color-edge`, `--color-snow`, `--color-dim`, `--color-soft`
- Used via Tailwind utility classes

## Deployment

### Prerequisites
- Backend API URL (production)
- Node.js 14+ and npm

### Build for Production

```bash
# Set environment variables
export REACT_APP_API_URL=https://api.yourdomain.com

# Build
npm run build

# Contents of build/ folder are ready to serve
```

### Docker Deployment

See the main [Attendance-system README](../README.md#docker-deployment).

### Static Hosting (Netlify, Vercel, etc.)

1. Build the app: `npm run build`
2. Deploy the `build/` folder
3. Set environment variable `REACT_APP_API_URL` to production API
4. Configure `_redirects` or `vercel.json` for SPA routing:

   **_redirects (Netlify):**
   ```
   /* /index.html 200
   ```

   **vercel.json:**
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

## Troubleshooting

### Blank Page / 404
- Ensure backend is running at correct API_URL
- Check browser console for CORS errors
- Verify JWT token in localStorage

### API Calls Failing
- Check `REACT_APP_API_URL` environment variable
- Backend must have CORS enabled for frontend domain
- Verify backend is running: `curl http://localhost:4040/health`

### Styling Issues
- Rebuild Tailwind: `npm run build` (builds with all styles)
- Clear cache: `npm run build` clears `build/` folder
- Check custom CSS for conflicts

### Login Loop
- Token may have expired: check localStorage
- Backend JWT_SECRET may have changed: clear token and re-login

### Build Fails
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node --version` (need 14+)
- Check for ESLint errors: `npm run build` shows full errors

## Performance Tips

- Lazy load pages with React.lazy for large dashboards
- Memoize expensive components with React.memo
- Debounce API calls in search/filters
- Images should be optimized before upload
- Use production build for deployment (3x smaller)

## Contributing

When adding features:
1. Keep components small and focused
2. Use context for global state (auth, theme)
3. Extract reusable components to `components/`
4. Keep API calls in `api/client.js`
5. Use Tailwind for styling (no inline styles)
6. Test with backend running

