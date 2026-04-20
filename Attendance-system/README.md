# Attendance System (DIAMS)

**Digital Intelligent Attendance Management System**  
IIT Hyderabad

Production-ready web-based attendance management platform with real-time session tracking, advanced analytics, and multi-method verification. Integrates BLE beacons, QR codes, and manual marking with automatic fallback mechanisms and sophisticated lecture intersection logic.

---

## Core Features

### Three Attendance Methods
- **BLE Beacons** — Proximity-based marking via Bluetooth Low Energy with rotating minor codes (30-sec via microservice, local HMAC fallback)
- **QR Codes** — Time-windowed tokens (5-sec rotation via microservice, local HMAC fallback)
- **Manual Marking** — Direct entry by professors/admins on student rosters

### Intelligent Session Management
- **Auto-Fallback Sessions** — System auto-creates 5-minute BLE sessions for scheduled lectures without manual session coverage
- **Auto-End Sessions** — Sessions automatically terminate when IST schedule end time passes (1-min cron + client-side safety net)
- **Multi-Session Lectures** — Support for multiple sessions per lecture (BLE + QR redundancy)
- **Lecture Intersection Logic** — Students marked present only if they attended ALL sessions of a lecture

### Real-time Dashboards & Analytics
- **Live Attendance Updates** — Every 3 seconds during active sessions
- **Course Analytics** — Per-lecture attendance statistics with trend analysis
- **Per-Student Analytics** — Attendance across all enrolled courses
- **At-Risk Student Detection** — Automatic flagging below configurable thresholds
- **Cross-Course Summaries** — Professor/admin view of overall attendance patterns

### User Roles & Access Control
- **Professors** — Manage courses, start/end sessions, view analytics, manual marking
- **TAs** — Limited professor access on assigned courses
- **Admins** — System-wide management (under development)
- **Students** — View own attendance and course enrollment

### Performance & Reliability
- **Attendance Caching** — Per-student bucket cache with real-time updates + 15-min full rebuild
- **Automatic Backups** — Nightly JSON backups of all data (last 7 retained)
- **Microservice Resilience** — Local HMAC fallback if BLE/QR services unavailable
- **Session Atomicity** — MongoDB atomic operations prevent duplicate concurrent sessions
- **Timezone Handling** — IST schedule aware with UTC lecture timestamps

---

## Architecture

```
Attendance-System/
├── backend/                    # Node.js/Express API server
│   ├── config/
│   │   └── db.js               # MongoDB connection setup
│   ├── middleware/
│   │   └── auth.js             # JWT authentication
│   ├── models/                 # 9 Mongoose schemas
│   │   ├── Student.js          # User credentials
│   │   ├── Professor.js        # Faculty credentials
│   │   ├── Course.js           # Course with lectures & schedules
│   │   ├── Session.js          # Attendance sessions
│   │   ├── Attendance.js       # Per-student attendance records
│   │   ├── Enrollment.js       # Course enrollment status
│   │   ├── Beacon.js           # BLE beacon mappings
│   │   ├── Classroom.js        # Venue info
│   │   ├── Bucket.js           # Attendance cache (per-student)
│   │   └── Admin.js            # Admin accounts
│   ├── routes/                 # 9 route files (60+ endpoints)
│   │   ├── auth.js             # /login
│   │   ├── courses.js          # Course & schedule management
│   │   ├── sessions.js         # Start/end sessions
│   │   ├── attendance.js       # Mark attendance
│   │   ├── analytics.js        # Analytics endpoints
│   │   ├── microservices.js    # BLE/QR proxy with fallback
│   │   ├── beacons.js          # Beacon management
│   │   ├── qr.js               # QR code ops
│   │   ├── student.js          # Student views
│   │   └── admin.js            # Admin ops (disabled)
│   ├── services/               # 4 business logic services
│   │   ├── autoSessionService.js    # Auto-create fallback sessions
│   │   ├── autoEndSessionService.js # Auto-end expired sessions
│   │   ├── bucketService.js         # Attendance caching
│   │   └── backupService.js         # Automated backups
│   ├── jobs/
│   │   └── index.js            # Cron scheduling (4 jobs)
│   ├── scripts/
│   │   ├── db-indexes.js       # Create indexes
│   │   └── seed.js             # Seed test data
│   ├── server.js               # Express app entry
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                   # React/Tailwind web portal
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # 155+ API endpoint calls
│   │   ├── components/
│   │   │   ├── Layout.js       # Navigation layout
│   │   │   └── UI.js           # Reusable UI components
│   │   ├── context/            # State management
│   │   │   ├── AuthContext.js  # Session & JWT
│   │   │   └── SchedulerContext.js # Auto-session scheduling
│   │   ├── pages/              # 11 page components
│   │   │   ├── Login.js
│   │   │   ├── AdminDashboard.js
│   │   │   ├── AdminOverview.js
│   │   │   ├── AdminCourses.js
│   │   │   ├── AdminStudents.js
│   │   │   ├── ProfessorDashboard.js
│   │   │   ├── CoursesPage.js
│   │   │   ├── CourseView.js   # Complex session lifecycle
│   │   │   ├── Students.js     # Attendance analytics
│   │   │   ├── Analytics.js    # Recharts visualizations
│   │   │   └── Settings.js
│   │   ├── App.js              # Main router
│   │   └── index.js            # React entry
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
│
└── docker-compose.yml          # Multi-container orchestration
```

---

## Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19.x · Tailwind CSS 3.x · Recharts 3.x · Lucide React |
| Backend | Node.js 14+ · Express.js · Mongoose 8.x |
| Database | MongoDB 7.0 |
| Authentication | JWT (HS256), sessionStorage |
| Scheduling | node-cron (4 background jobs) |
| Microservices | BLE service · QR service (with local HMAC fallback) |
| Deployment | Docker · Docker Compose |
| Production | Render.com (backend), configurable frontend

---

## Quick Start

### Prerequisites
- Docker & Docker Compose (for containerized setup)
- OR Node.js 14+ + npm + MongoDB (for local development)

### Local Development (with Docker Compose)

```bash
# Clone and enter directory
cd Attendance-system

# Create .env if needed (optional - has sensible defaults)
# See docker-compose.yml for environment variables

# Start all services
docker-compose up --build
```

This starts:
- **MongoDB** on port 27017 (internal only)
- **Backend** API on http://localhost:4040
- **Frontend** on http://localhost:3000

## Background Jobs (Cron)

Four automated jobs ensure system reliability and performance:

| Job | Frequency | Purpose |
|-----|-----------|----------|
| **Auto-Create Fallback Sessions** | Every 1 min | Creates 5-min BLE sessions for scheduled lectures without manual session coverage (IST-aware) |
| **Auto-End Expired Sessions** | Every 1 min | Closes sessions when IST schedule end time passes (server-side safety net) |
| **Rebuild Attendance Cache** | Every 15 min | Refreshes per-student lecture attendance cache with intersection logic; also updates real-time after each mark |
| **Nightly Backup** | 02:00 IST | Backs up all 9 models to JSON; retains last 7 backups |

## API Endpoints Summary

**60+ RESTful endpoints** organized by category:

### Authentication
- `POST /login` — Email/password login, returns JWT

### Course Management (8 endpoints)
- `GET /courses/:profId` — Professor's courses
- `POST /courses` · `PUT /courses/:id` · `DELETE /courses/:id` — Course CRUD
- `GET/POST/PATCH/DELETE /courses/:courseId/schedule*` — Schedule management

### Sessions (4 endpoints)
- `POST /startSession` — Start attendance session (BLE/QR/Manual)
- `POST /endSession/:sessionId` — End session
- `GET /activeSession?course_id=...` — Get active session
- `GET /admin/sessions` — List all sessions

### Attendance (4 endpoints)
- `POST /markAttendance` — Mark via BLE/QR/Manual
- `POST /manualAttendance` · `POST /manualAttendance/bulk` — Manual marking
- `GET /attendance/:sessionId` — Session records

### Analytics (4 endpoints)
- `GET /analytics/course/:courseId` — Lecture-level stats
- `GET /analytics/course/:courseId/students` — Per-student course analytics
- `GET /analytics/prof/:profId` — Professor's cross-course analytics
- `GET /analytics/at-risk/:profId` — At-risk students

### Microservice Integration (6 endpoints)
- `GET /getMinor?major=...` — BLE minor (proxies to service, HMAC fallback)
- `POST /ble/validate` — BLE validation (proxies to service, DB fallback)
- `GET /getQR/:sessionId` — QR generation (proxies to service, HMAC fallback)
- `POST /qr/validate` — QR validation (proxies to service, HMAC fallback)
- `GET /decodeQR?qr=...` — Local HMAC QR verification
- `GET /validate?major=&minor=...` — Legacy beacon check

### Student (3 endpoints)
- `GET /student/:studentId/history/:courseId` — Attendance with lecture intersection
- `GET /student/:studentId/courses` — Enrolled courses
- `GET /student/:studentId/profile` — Profile info

### Admin (Disabled - Under Development)

## Frontend Pages & Features

**11 page components** organized by role:

### Authentication
- **Login** — Email/password with role-based redirect

### Admin Pages (5 pages)
- **AdminDashboard** — System stats, user/course/enrollment management, TA assignment
- **AdminOverview** — Statistical summaries (students, professors, courses, sessions, avg attendance)
- **AdminCourses** — Course CRUD interface
- **AdminStudents** — Student management and analytics

### Professor Pages (3 pages)
- **ProfessorDashboard** — Courses overview, active sessions, time-based greeting
- **CoursesPage** — List courses with session status badges
- **CourseView** — Complex session lifecycle: start/end, BLE minor display, QR generation/display, manual marking, schedule CRUD

### Shared Pages (3 pages)
- **Students** — Roster with attendance analytics and heatmaps
- **Analytics** — Lecture timelines, Recharts visualizations, professor analytics, at-risk detection
- **Settings** — User preferences

## Key System Concepts

### Lecture Intersection Logic
Students marked "present" for a lecture **only if they attended ALL sessions** of that lecture. This enables:
- Multiple backup sessions per lecture (BLE + QR)
- Robust attendance verification
- Flexible scheduling without double-counting

### Timezone Handling
- **Schedules**: Stored as IST strings (day name + time: "Monday 09:00")
- **Lectures**: Stored as UTC timestamps
- **Services**: IST timezone-aware conversions in background jobs
- **Client**: SchedulerContext resolves active lecture within ±30-min window

### Microservice Resilience
- **Primary**: Proxies to external BLE and QR services
- **Fallback**: Local HMAC-based crypto if services unavailable
  - BLE minor: 30-sec rotation
  - QR hash: 5-sec rotation
- **Automatic**: Seamless fallback without user intervention

### Attendance Caching (Bucket)
- **Real-time**: Updated immediately after each attendance mark
- **Safety Net**: Full rebuild every 15 minutes
- **Purpose**: Fast analytics queries without scanning all records

### Local Development (without Docker)

See detailed setup in:
- [Backend README](./backend/README.md#local-development-without-docker)
- [Frontend README](./frontend/README.md#local-development)

---

## Docker Deployment

### Production Checklist

- [ ] `.env` file configured with production values
- [ ] `MONGO_USER` and `MONGO_PASS` set to strong credentials
- [ ] `JWT_SECRET` and `QR_SECRET` updated (generate with `openssl rand -hex 64`)
- [ ] `FRONTEND_URL` points to production domain
- [ ] Firewall allows ports 4040 (backend) and 3000 (frontend) or use reverse proxy
- [ ] MongoDB volume (`mongo-data`) persisted to production storage
- [ ] Backups volume (`backups`) configured

### Full Deployment

1. **Create `.env` file**:
   ```bash
   cat > .env << EOF
   MONGO_USER=admin
   MONGO_PASS=$(openssl rand -hex 12)
   FRONTEND_URL=https://yourdomain.com
   AT_RISK_THRESHOLD=75
   EOF
   ```

2. **Start services**:
   ```bash
   docker-compose up -d
   ```

3. **Verify services**:
   ```bash
   # Check all containers running
   docker-compose ps

   # Check backend health
   curl http://localhost:4040/health

   # Access frontend
   open http://localhost:3000
   ```

4. **Seed database** (first time only):
   ```bash
   docker-compose exec backend npm run seed
   ```

5. **Monitor logs**:
   ```bash
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

### Scaling & Updates

```bash
# Stop all services
docker-compose down

# Update images
docker-compose pull

# Restart with latest
docker-compose up -d

# View persistent data
docker volume ls
```

---

## Configuration

### Environment Variables

**Backend** (set in `docker-compose.yml` or `.env`):
```env
PORT=4040
MONGO_URI=mongodb://admin:secret@mongo:27017/attendance?authSource=admin
JWT_SECRET=<generate-strong-secret>
QR_SECRET=<generate-strong-secret>
FRONTEND_URL=http://localhost:3000
AT_RISK_THRESHOLD=75
BACKUP_DIR=/app/backups
```

**Frontend** (set in `.env` in `frontend/` directory):
```env
REACT_APP_API_URL=http://localhost:4040
```

For more details, see:
- [Backend Configuration](./backend/README.md#environment-variables)
- [Frontend Configuration](./frontend/README.md#environment-variables)

---

## Database

MongoDB collections with schema documentation:
- **Student**: User accounts with face recognition image URLs
- **Professor**: Instructor accounts
- **Course**: Courses with lecture schedules and multiple attendance methods
- **Session**: Active attendance sessions with unique session UIDs
- **Attendance**: Attendance records with verification method (BLE/QRCode/Manual)
- **Enrollment**: Student-course relationships with status tracking
- **Beacon**: BLE beacon hardware mappings to classrooms
- **Classroom**: Physical classroom metadata

**Key design features:**
- Optimized indexes on common query patterns (active sessions, course analytics)
- Session `active` flag for explicit control vs duration-based expiry
- Multiple indexes for high-performance queries
- Unique constraints to prevent duplicate enrollments/attendance

For complete schema details, see [Backend Database Schema](./backend/README.md#database-schema).

---

## Usage

### Admin Setup

**Default credentials** (after seeding):
- Email: `admin@test.com`
- Password: `test123`

**Admin capabilities**:
- Create professors and students
- Manage courses and schedules
- Monitor all active sessions
- View system-wide analytics
- Manage user roles
- Trigger backups

### Professor Workflow

1. Log in with professor credentials
2. Select course from dashboard
3. View course details, schedules, enrolled students
4. **Start Session** - choose method:
   - **BLE** - Beacon-based (students scan with mobile app)
   - **QR Code** - Display QR code for students to scan
   - **Manual** - Manually mark attendance
5. Monitor live attendance log (updates every 3 seconds)
6. End session when complete
7. View analytics and reports

### Features by Role

| Feature | Professor | Admin |
|---------|-----------|-------|
| View Dashboard | ✓ | ✓ |
| Start Sessions | ✓ | ✓ |
| View Attendance | ✓ | ✓ (all courses) |
| View Analytics | ✓ | ✓ |
| Manage Courses | ✗ | ✓ |
| Manage Users | ✗ | ✓ |
| System Stats | ✗ | ✓ |
| Backups | ✗ | ✓ |

---

## API Overview

### Key Endpoints

```
Authentication
  POST   /login                    - Login with email/password
  POST   /logout                   - Logout user

Courses
  GET    /courses                  - List user's courses
  POST   /courses                  - Create course (admin)
  GET    /courses/:id/schedules    - Get course schedules
  POST   /courses/:id/schedules    - Add schedule

Sessions
  POST   /sessions                 - Start new session
  PUT    /sessions/:id/end         - End session
  GET    /sessions/:id/active      - Get active session

Attendance
  GET    /attendance/:courseId     - Get records
  POST   /attendance/mark          - Mark attendance
  POST   /attendance/manual        - Manual attendance

Analytics
  GET    /analytics/course/:id     - Course analytics
  GET    /analytics/admin          - System-wide stats
  GET    /analytics/at-risk        - At-risk students

Admin
  GET    /admin/users              - List all users
  POST   /admin/professors         - Create professor
  POST   /admin/students           - Create student
  POST   /admin/backup             - Backup database
```

Full API documentation available in [Backend README](./backend/README.md#api-routes)

---

## Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker ps

# View logs
docker-compose logs backend
docker-compose logs mongo

# Restart everything
docker-compose down -v
docker-compose up --build
```

### Can't Connect to API
- Verify backend is running: `docker ps | grep attendance-backend`
- Check frontend env var `REACT_APP_API_URL` matches backend URL
- Restart containers: `docker-compose restart backend frontend`

### Database Connection Failed
- MongoDB must be healthy before backend starts
- Check MongoDB logs: `docker-compose logs mongo`
- Verify credentials in `docker-compose.yml`
- Reset database: `docker volume rm attendance-system_mongo-data`

### High Memory Usage
- Check logs for memory warnings
- Restart containers: `docker-compose restart`
- Monitor with: `docker stats`

### Login Issues
- Clear browser localStorage and try again
- Check backend logs for auth errors
- Verify JWT_SECRET is consistent

For more troubleshooting, see:
- [Backend Troubleshooting](./backend/README.md#troubleshooting)
- [Frontend Troubleshooting](./frontend/README.md#troubleshooting)

---

## Development

### Adding Features

1. **Backend change**: Add route/service in `backend/routes/` or `backend/services/`
2. **Frontend change**: Add page/component in `frontend/src/pages/` or `frontend/src/components/`
3. **API integration**: Update `frontend/src/api/client.js` with new endpoint
4. **Test**: `docker-compose exec backend npm run dev` and `docker-compose exec frontend npm start`

### Running Tests

```bash
# Backend
docker-compose exec backend npm test

# Frontend
docker-compose exec frontend npm test
```

### Database Migrations

```bash
# Create indexes
docker-compose exec backend npm run indexes

# Reseed data
docker-compose exec backend npm run seed
```

---

## Performance & Security

### Performance Optimization
- MongoDB indexes on frequently queried fields
- Response compression enabled
- Rate limiting configured (300 req/min general, 20 req/15min auth)
- Connection pooling for database

### Security Features
- Helmet.js headers (XSS, CSRF protection)
- CORS properly configured
- JWT authentication on all protected routes
- Password hashing with bcryptjs
- Rate limiting on login attempts
- Input validation and sanitization

### Production Recommendations
- Use reverse proxy (Nginx/Caddy) for SSL/TLS termination
- Run on dedicated server with firewall rules
- Regular backups of MongoDB volume
- Monitor disk space and logs
- Keep Docker images updated

---

## Monitoring & Maintenance

### Health Check
```bash
curl http://localhost:4040/health
```

Returns status of backend, MongoDB, and external services.

### Backups
```bash
# Manual backup
docker-compose exec backend curl -X POST http://localhost:4040/admin/backup

# Locate backup files
docker volume inspect attendance-system_backups | grep Mountpoint
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f mongo
```

### Database Access
```bash
# Connect to MongoDB shell
docker-compose exec mongo mongosh -u admin -p secret
# Then: use attendance
#       db.courses.find()
```

---

## File Organization

- **Backend Details**: [backend/README.md](./backend/README.md)
- **Frontend Details**: [frontend/README.md](./frontend/README.md)
- **Full API Reference**: Backend README API Routes section
- **Component Guide**: Frontend README Components section

---

## Related Projects

This Attendance System integrates with:
- **BLE Module** - Bluetooth beacon scanning (separate microservice)
- **Face Recognition Module** - Face verification and enrollment (separate microservice)
- **Mobile Apps** - iOS and Android student/professor apps
- **Spring Boot Backend** - Legacy Java backend (if in use)

---

## License

**Digital Intelligent Attendance Management System (DIAMS)**  
IIT Hyderabad | Software Engineering Sprint 2 | 2026

---

## Support & Feedback

For issues or contributions:
1. Check the troubleshooting sections in README files
2. Review logs with `docker-compose logs`
3. Verify configuration in `.env` and `docker-compose.yml`
4. Contact the development team

| Role      | Email           | Password    |
|-----------|-----------------|-------------|
| Professor | profA@test.com  | password123 |
| Professor | profB@test.com  | password123 |
| Professor | profC@test.com  | password123 |
| Admin     | admin@test.com  | password123 |

---

## Pages

| Page       | Who    | Description                                           |
|------------|--------|-------------------------------------------------------|
| Overview   | Admin  | System-wide stats refreshed every 15 s               |
| Dashboard  | Prof   | Course cards with live session status                 |
| Courses    | Prof   | Start/end sessions, QR display, scheduler, live log  |
| Students   | Prof   | Live attendance per course, auto-refreshes            |
| Analytics  | Both   | Bar chart, trend line, per-prof breakdown (admin); course breakdown & at-risk (prof) |
| Admin      | Admin  | All sessions, user management, server log hints       |
| Settings   | Both   | API URL config, endpoint reference                    |

---

## API Endpoints

| Method | Endpoint                        | Description                           |
|--------|---------------------------------|---------------------------------------|
| POST   | `/login`                        | Authenticate                          |
| GET    | `/courses/:profId`              | Get professor's courses               |
| POST   | `/startSession`                 | Start a session                       |
| POST   | `/endSession/:id`               | End a session                         |
| GET    | `/activeSession?course_id=`     | Get active session                    |
| GET    | `/getQR/:sessionId`             | Get QR token (refreshes 5 s)          |
| POST   | `/markAttendance`               | Mark student attendance               |
| GET    | `/attendance/:sessionId`        | Get attendance log                    |
| POST   | `/manualAttendance`             | Manually mark one student             |
| POST   | `/manualAttendance/bulk`        | Bulk-mark students present            |
| GET    | `/getMinor?major=`              | BLE minor value                       |
| GET    | `/validate?major=&minor=`       | Validate BLE beacon                   |
| GET    | `/admin/stats`                  | System stats                          |
| GET    | `/admin/sessions`               | All sessions across all courses       |
| GET    | `/admin/analytics`              | Full system-wide analytics breakdown  |
| GET    | `/admin/users`                  | List all users                        |
| POST   | `/admin/users`                  | Create a user                         |
| DELETE | `/admin/users/:id`              | Delete a user                         |
| GET    | `/analytics/course/:id`         | Per-course analytics                  |
| GET    | `/analytics/prof/:id`           | Professor analytics                   |
| GET    | `/analytics/at-risk/:profId`    | Students below 25% attendance         |
| GET    | `/course/:courseId/students`    | Students enrolled in a course         |
| GET    | `/student/:id/history/:courseId`| Student attendance history            |

---

## Author

**Soham Rajesh Pawar**, CS22BTECH11055  
IIT Hyderabad · 8th Semester SWE