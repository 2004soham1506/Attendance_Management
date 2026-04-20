# Attendance System Backend

Node.js/Express backend for the Digital Intelligent Attendance Management System (DIAMS). Handles 60+ RESTful API endpoints for attendance tracking, session management, analytics, and user administration with sophisticated multi-method verification and lecture intersection logic.

## Overview

The backend provides production-ready APIs for:
- **Authentication**: JWT-based login (Admin, Professor, TA, Student roles)
- **Course Management**: Full CRUD with schedules and TA assignment
- **Session Management**: Start/end attendance sessions with three methods (BLE, QR, Manual)
- **Attendance Tracking**: Multi-method verification with real-time bucket caching
- **Advanced Analytics**: Lecture intersection logic, per-student tracking, at-risk detection
- **Microservice Integration**: BLE/QR proxying with automatic local HMAC fallback
- **Background Jobs**: 4 cron jobs for session management, caching, and backups

## Stack

- **Runtime**: Node.js 14+
- **Framework**: Express.js
- **Database**: MongoDB 7.0 with Mongoose 8.x
- **Authentication**: JWT (HS256) in Authorization headers
- **Scheduling**: node-cron for background jobs
- **Resilience**: Automatic fallback to local HMAC when microservices unavailable

## Project Structure

```
backend/
├── config/
│   └── db.js                      # MongoDB connection setup
├── middleware/
│   └── auth.js                    # JWT authentication middleware
├── models/                        # 9 Mongoose schemas
│   ├── Student.js                 # User credentials
│   ├── Professor.js               # Faculty credentials
│   ├── Admin.js                   # Admin accounts
│   ├── Course.js                  # Courses with lectures & schedules
│   ├── Session.js                 # Attendance sessions
│   ├── Attendance.js              # Per-student attendance records
│   ├── Enrollment.js              # Course enrollment status
│   ├── Beacon.js                  # BLE beacon location mappings
│   ├── Classroom.js               # Venue information
│   └── Bucket.js                  # Per-student attendance cache
├── routes/                        # 9 route files (60+ endpoints)
│   ├── auth.js                    # POST /login
│   ├── courses.js                 # Course & schedule management (8 endpoints)
│   ├── sessions.js                # Session lifecycle (4 endpoints)
│   ├── attendance.js              # Attendance marking (4 endpoints)
│   ├── analytics.js               # Analytics endpoints (4 endpoints)
│   ├── microservices.js           # BLE/QR proxy with fallback (6 endpoints)
│   ├── beacons.js                 # Beacon management (2 endpoints)
│   ├── qr.js                      # QR operations (local HMAC)
│   ├── student.js                 # Student views (3 endpoints)
│   └── admin.js                   # Admin ops (disabled)
├── services/                      # 4 core business logic services
│   ├── autoSessionService.js      # Auto-create fallback BLE sessions (1-min cron)
│   ├── autoEndSessionService.js   # Auto-end expired sessions (1-min cron)
│   ├── bucketService.js           # Per-student attendance caching (real-time + 15-min rebuild)
│   ├── backupService.js           # Automated JSON backups (02:00 IST, last 7 retained)
│   └── lecturePopulator.js        # Utility for initial lecture data
├── jobs/
│   └── index.js                   # Cron scheduling for 4 background jobs
├── scripts/
│   ├── db-indexes.js              # Create optimized database indexes
│   └── seed.js                    # Seed test data
├── utils/                         # Helper utilities
├── server.js                      # Express app entry & startup
├── package.json
├── Dockerfile
└── .env                           # Environment variables (git-ignored)
```

## Database Schema

MongoDB collections with optimized indexes:

### Student
```javascript
{
  _id: String (unique),
  name: String (required),
  password: String (hashed with bcryptjs),
  email: String (unique),
  imageURL: String (for face recognition integration),
  createdAt: Date
}
```

### Professor
```javascript
{
  _id: String (unique),
  name: String (required),
  password: String (hashed),
  email: String (unique),
  department: String,
  createdAt: Date
}
```

### Course
```javascript
{
  _id: String (courseId, unique),
  name: String (required),
  department: String,
  slot: String (A-Z, enum),
  venue: String (classroom reference),
  startDate: Date,
  endDate: Date,
  instructors: [String] (professor IDs),
  tas: [String] (student IDs),
  lectures: [{
    lectureUID: String (unique per course),
    scheduledTime: Date,
    cancelled: Boolean
  }],
  schedules: [{
    scheduledDay: String (Monday-Sunday),
    startTime: String (HH:mm format),
    endTime: String (HH:mm format),
    method: String (enum: BLE, QRCode, Manual),
    switch: Boolean (allow method switching during session)
  }],
  createdAt: Date
}
```

### Session
```javascript
{
  sessionUID: String (unique, auto-generated UUID),
  course: String (course ID, indexed),
  lectureUID: String (lecture ID within course),
  scheduledTime: Date,
  duration: Number (minutes, for reference),
  method: String (enum: BLE, QRCode, Manual),
  isAutoGenerated: Boolean (true if created by auto-scheduler),
  active: Boolean (session currently running, indexed),
  endedAt: Date (when session was ended),
  timestamp: Date (creation time)
}
// Indexes:
// - { course: 1, active: 1 } - Active session lookup
// - { course: 1, lectureUID: 1 } - Analytics grouping
// - { sessionUID: 1 } (unique) - Primary lookup
// - { timestamp: -1 } - Admin session list sorting
```

### Attendance
```javascript
{
  sessionUID: String (session reference),
  student: String (student ID),
  timestamp: Date (when marked),
  markedAt: Date (optional, for manual entries),
  verifiedVia: String (enum: BLE, QRCode, Manual),
}
// Unique index on { sessionUID, student }
```

### Enrollment
```javascript
{
  student: String (student ID),
  course: String (course ID),
  enrollmentDate: Date,
  status: String (enum: Active, Completed, Dropped)
}
// Unique index on { student, course }
```

### Beacon (BLE/Bluetooth)
```javascript
{
  bleID: String (beacon hardware ID, unique),
  classroom: String (classroom reference),
  createdAt: Date
}
```

### Classroom
```javascript
{
  _id: String (classroom ID),
  name: String,
  capacity: Number,
  floor: String
}
```

## Environment Variables

Create a `.env` file in the backend directory (for local development):

```env
# Server
PORT=4040
NODE_ENV=development

# Database (use MONGO_URI for Docker, MONGODB_URI for local dev)
MONGO_URI=mongodb://admin:secret@mongo:27017/attendance?authSource=admin
# OR for local MongoDB:
# MONGODB_URI=mongodb://localhost:27017/attendance

# JWT & Security
JWT_SECRET=54657d5cdc6b81baf001f492ce508a16c9ac8dd33e5829692006b8a73b98844f3d389e92fdce5220ecf4606f9e0b7e6771382e5afc72b2dc2c0a4ed41f4b4f26
QR_SECRET=54657d5cdc6b81baf001f492ce508a16c9ac8dd33e5829692006b8a73b98844f3d389e92fdce5220ecf4606f9e0b7e6771382e5afc72b2dc2c0a4ed41f4b4f26

# Frontend & CORS
FRONTEND_URL=http://localhost:3000

# Feature Flags
AT_RISK_THRESHOLD=75

# Backup
BACKUP_DIR=/app/backups

# External Services (optional)
BLE_SERVICE_URL=http://localhost:8000
FACE_SERVICE_URL=http://localhost:5000
```

**Note:** Docker Compose automatically injects `MONGO_URI` and other environment variables from the main README's configuration. The backend accepts both `MONGO_URI` and `MONGODB_URI` for compatibility.

## Installation & Setup

### Local Development (without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start MongoDB locally or use Docker:
   ```bash
   docker run -d \
     -e MONGO_INITDB_ROOT_USERNAME=admin \
     -e MONGO_INITDB_ROOT_PASSWORD=secret \
     -e MONGO_INITDB_DATABASE=attendance \
     -p 27017:27017 \
     --name attendance-mongo \
     mongo:7
   ```

3. Create `.env` file (see above)

4. Start the server:
   ```bash
   npm run dev    # with nodemon for hot-reload
   # or
   npm start      # production
   ```

   Server runs at `http://localhost:4040`

5. Seed the database (first time):
   ```bash
   npm run seed
   ```

6. Create indexes:
   ```bash
   npm run indexes
   ```

### Docker Deployment

See the main [Attendance-system README](../README.md#docker-deployment) for complete container setup.

Quick start with Docker Compose:
```bash
cd ..  # Go to Attendance-system root
docker-compose up --build
```

The backend will:
- Wait for MongoDB to be healthy
- Connect automatically
- Start on port 4040
- Backups saved to `./backups` volume

## API Routes

### Authentication
- `POST /login` - Login user (professor/admin)
- `POST /logout` - Logout user

### Courses
- `GET /courses` - List user's courses
- `GET /courses/:id` - Get course details
- `POST /courses` - Create course (admin only)
- `PUT /courses/:id` - Update course
- `DELETE /courses/:id` - Delete course
- `GET /courses/:id/schedules` - Get course schedules
- `POST /courses/:id/schedules` - Add schedule
- `PUT /courses/:id/schedules/:idx` - Update schedule
- `DELETE /courses/:id/schedules/:idx` - Delete schedule

### Sessions
- `GET /sessions` - List sessions
- `GET /sessions/:id` - Get session details
- `POST /sessions` - Start new session
- `PUT /sessions/:id/end` - End session
- `GET /sessions/:id/active` - Get active session

### Attendance
- `POST /attendance/mark` - Mark attendance
- `GET /attendance/:courseId` - Get attendance records
- `POST /attendance/manual` - Manual attendance marking
- `POST /attendance/bulk` - Bulk manual attendance

### Analytics
- `GET /analytics/course/:id` - Course analytics
- `GET /analytics/professor` - Professor's analytics
- `GET /analytics/admin` - System-wide analytics
- `GET /analytics/at-risk` - At-risk students

### Admin
- `GET /admin/users` - List all users
- `POST /admin/professors` - Create professor
- `POST /admin/students` - Create student
- `POST /admin/students/bulk` - Bulk create students
- `GET /admin/sessions` - List all sessions
- `GET /admin/stats` - System statistics
- `POST /admin/backup` - Trigger database backup

### QR Code
- `GET /getQR/:sessionId` - Get QR code for session
- `POST /qr/validate` - Validate QR code during attendance

### BLE Integration
- `GET /getMinor/:courseId` - Get BLE minor value
- `POST /ble/validate` - Validate BLE beacon attendance

## Development

### Running in Development Mode

```bash
npm run dev
```

Nodemon will auto-restart on file changes.

### Database Migrations

For adding indexes or running scripts:
```bash
npm run indexes
```

### Seeding Test Data

```bash
npm run seed
```

Creates sample professors, courses, students, and enrollments.

## Database Design & Optimization

### Session Active Flag Design

The `Session` model uses an **`active` boolean flag** instead of duration-based expiry logic:

**Why this approach?**
- **Explicit control**: Session ends only when explicitly called via `PUT /sessions/:id/end`
- **No race conditions**: Eliminates timing issues from duration-based expiry
- **Cron safety**: Background jobs can reliably sweep expired sessions using `active: false`
- **Query efficiency**: Can instantly query active sessions with `{ course: 1, active: 1 }` index

**Session lifecycle:**
```
New session: { active: true, endedAt: null }
  ↓ (professor ends session)
Ended session: { active: false, endedAt: Date.now() }
```

### Indexing Strategy

Key indexes for performance:

| Index | Purpose | Query Example |
|-------|---------|---------------|
| `{ course: 1, active: 1 }` | Find active sessions for a course | `getActiveSession(courseId)` |
| `{ course: 1, lectureUID: 1 }` | Group sessions by lecture for analytics | Course attendance trends |
| `{ sessionUID: 1 }` (unique) | Primary lookup | Get session details |
| `{ timestamp: -1 }` | Admin session list (newest first) | List all sessions |
| `{ student: 1, course: 1 }` (unique, Enrollment) | Prevent duplicate enrollments | Check enrollment status |
| `{ sessionUID: 1, student: 1 }` (unique, Attendance) | Prevent duplicate attendance marks | Mark attendance uniquely |

**Create indexes:**
```bash
npm run indexes
```

### Face Recognition Integration

The `Student` model includes an `imageURL` field for future face recognition features:
- Stores URL to student's enrolled face image
- Used by Face Recognition microservice for verification
- Currently stored but not required for core attendance functionality

### Course Schedules & Method Switching

Course `schedules` array allows:
- Multiple schedule entries per course (MWF, TTh, etc.)
- Per-schedule method assignment (BLE, QRCode, Manual)
- `switch: Boolean` flag to toggle attendance method during active session

Example:
```javascript
schedules: [
  {
    scheduledDay: "Monday",
    startTime: "09:00",
    endTime: "09:50",
    method: "BLE",
    switch: true  // Can switch to QRCode if BLE beacon unavailable
  },
  {
    scheduledDay: "Wednesday",
    startTime: "09:00",
    endTime: "09:50",
    method: "QRCode",
    switch: false // Fixed to QRCode
  }
]
```

### Lecture UID vs Session UID

- **lectureUID**: Identifies a scheduled lecture slot (e.g., "Week 3 Monday of DSA")
  - One lecture can have multiple sessions (BLE + QR backup)
  - Fixed per course schedule

- **sessionUID**: Unique instance of attendance-taking
  - Auto-generated UUID when session starts
  - Multiple sessions possible per lectureUID
  - Links to Attendance records

This design enables:
- Multiple attendance methods for same lecture time
- Analytics rollup by lecture (not session)
- Session switching without losing lecture context

### Docker Image

The Dockerfile builds a Node.js image with:
- PM2 process manager for reliability
- Health checks
- Non-root user execution

Build manually:
```bash
docker build -t attendance-backend:latest .
```

## Troubleshooting

### MongoDB Connection Issues
- Verify MONGO_URI is correct
- Check MongoDB container is running: `docker ps | grep mongo`
- Test connection: `docker exec attendance-mongo mongosh -u admin -p secret`

### Port Already in Use
```bash
# Find process on port 4040
lsof -i :4040
# Kill it
kill -9 <PID>
```

### JWT Token Errors
- Ensure JWT_SECRET matches between server instances
- Check token expiration: tokens expire after 24 hours
- Re-login if token is invalid

### High Memory Usage
- Check for memory leaks in services
- Restart the container: `docker restart attendance-backend`
- Monitor with: `docker stats attendance-backend`

## Performance Optimization

- Indexes created on frequently queried fields (userId, courseId, sessionId)
- Rate limiting to prevent abuse
- Response compression enabled
- Request size limits configured
- Connection pooling for MongoDB

## Health Check

Monitor service health at:
```bash
curl http://localhost:4040/health
```

Response includes MongoDB status, external service connectivity, and uptime.

## Contributing

When adding new routes:
1. Create route file in `routes/`
2. Import and mount in `server.js`
3. Add middleware checks if needed
4. Document endpoint in API Routes section
5. Add tests if applicable
