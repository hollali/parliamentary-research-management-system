# Parliamentary Research Management System (PRRMS)

A full-stack application for managing research requests, assignments, reports, and workflows for the Parliamentary Service of Ghana's Research Department.

## Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 4, TypeScript 5.8, Lucide React icons, TipTap rich text editor
- **Backend:** Express.js, Prisma 7 ORM, PostgreSQL, JWT authentication, Nodemailer
- **Tooling:** tsx, Vitest, concurrently, ESLint

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Configure environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prrms?schema=public"
   JWT_SECRET="change-this-to-a-secure-random-string-in-production"
   FRONTEND_URL="http://localhost:3000"
   PORT=3001
   NODE_ENV=development
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Seed the database with test data:
   ```bash
   npm run db:seed
   ```

6. Start the app (frontend + backend):
   ```bash
   npm run dev:all
   ```

   Or start them separately:
   ```bash
   npm run dev          # Frontend on http://localhost:3000
   npm run dev:server   # Backend on http://localhost:3001
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 3000) |
| `npm run dev:server` | Start Express backend with hot reload |
| `npm run dev:all` | Start both frontend and backend concurrently |
| `npm run build` | Build frontend for production |
| `npm run lint` | Type-check with TypeScript |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema changes without migration |
| `npm run db:seed` | Seed database with test data |
| `npm run db:reset` | Reset database and re-run migrations |
| `npm run db:studio` | Open Prisma Studio (database browser) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run server:start` | Start backend in production mode |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |

## Test Credentials

All users use password: **`password123`**

| Role | Name | Email |
|------|------|-------|
| Admin | Kwame Asante | `admin@parliament.gh` |
| Admin | Ama Mensah | `research.director@parliament.gh` |
| Research Officer | Kofi Osei | `kofi.osei@parliament.gh` |
| Research Officer | Serwaa Appiah | `serwaa.appiah@parliament.gh` |
| Research Officer | Gyasi Mensah | `gyasi.mensah@parliament.gh` |
| Research Assistant | Adwoa Boakye | `adwoa.boakye@parliament.gh` |
| Research Assistant | Yaw Darko | `yaw.darko@parliament.gh` |
| MP | Hon. Emmanuel Boateng | `hon.boateng@parliament.gh` |
| MP | Hon. Abena Adjei | `hon.adjei@parliament.gh` |
| MP | Hon. John Kumah | `hon.kumah@parliament.gh` |

## Features

### Role-Based Access Control

The system has 4 roles with different permissions:

- **Admin** — Assign research, manage requests, review reports, manage teams, full user management
- **Research Officer** — Accept/decline assignments, submit drafts, manage revisions
- **Research Assistant** — Support officers, view assigned work
- **MP** — Submit research requests, track progress

### Research Request Lifecycle

```
MP submits request → SUBMITTED
Admin assigns officer(s) → ASSIGNED
Officer starts work → IN_PROGRESS
Officer submits draft → DRAFT_SUBMITTED
Admin reviews → APPROVED or REVISION_REQUESTED
Officer revises → REVISED → re-review
Admin approves → APPROVED → DELIVERED → CLOSED
```

### Core Features

- **Research Request Management** — Submit, track, filter, and search research requests with priority levels and deadlines
- **Assignment System** — Assign individual officers, multiple officers, or research teams to requests with custom deadlines and notes
- **Team Management** — Create and manage research teams with members, assign work to entire teams
- **Report Drafting** — Officers create and submit research reports with version history using a rich text editor (TipTap)
- **Rich Text Editor** — Full formatting toolbar: bold, italic, strikethrough, headings, bullet/numbered lists, blockquotes, horizontal rules, undo/redo
- **Inline Review Annotations** — Admins select specific text in a draft and annotate it with feedback; officers see exactly which text the comment references
- **Review Workflow** — Admin annotates reports with inline or section-level comments, requests revisions, approves final versions
- **Immediate Feedback Notifications** — Officers receive in-app notifications and email alerts immediately when an admin posts a review comment (not just on formal revision requests)
- **Document Version Diff** — Side-by-side comparison of report versions with line-by-line diff highlighting
- **Committee Workbench** — View and manage requests per parliamentary committee with cross-committee sharing
- **Parliamentary Calendar** — Month-grid view of deadlines, overdue alerts, and upcoming milestones
- **Research Templates** — Predefined report structures (Legislative Brief, Policy Brief, Committee Report, etc.)
- **Email Notifications** — Automated emails for assignments, draft submissions, review comments, and revision requests (requires SMTP config)
- **Activity Audit Log** — Filterable log of all system actions with user attribution
- **Workload Balancing** — Dashboard showing officer capacity and utilization stats
- **Global Search** — Command palette (Ctrl+K) for searching requests, reports, and people
- **CSV/PDF Export** — Export data views as CSV or print to PDF
- **File Uploads** — Attach multiple files (PDF, DOCX, XLSX, ZIP up to 50MB) to requests with upload progress indicators and secure download links
- **Notifications** — In-app notification center with read/unread tracking
- **User Profile Management** — Update name, title, constituency (for MPs), password

## Project Structure

```
├── server/                    # Express.js backend
│   ├── index.ts               # Server entry point, CORS, route mounting
│   ├── middleware/
│   │   └── auth.ts            # JWT authentication, role-based access
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── email.ts           # Nodemailer transporter + email templates
│   │   └── env.ts             # Environment variable validation
│   └── routes/
│       ├── auth.ts            # Login, profile, change-password
│       ├── requests.ts        # Research request CRUD, search, sharing
│       ├── assignments.ts     # Assign officers/teams, accept/decline
│       ├── reports.ts         # Report CRUD, version history, version diff
│       ├── reviews.ts         # Review comments, revision requests, approval
│       ├── users.ts           # User management (admin only)
│       ├── teams.ts           # Research team CRUD and membership
│       ├── notifications.ts   # Notification listing and read management
│       ├── dashboard.ts       # Metrics, analytics, activity log, workload
│       └── uploads.ts         # File upload and download
├── prisma/
│   ├── schema.prisma          # Database schema (16 models, 7 enums)
│   ├── seed.ts                # Test data seeder (16 committees, 10 users, 6 requests)
│   └── migrations/            # Database migration history
├── src/                       # React frontend
│   ├── App.tsx                # Main routing, sidebar, global search
│   ├── main.tsx               # App entry point
│   ├── types.ts               # TypeScript interfaces
│   ├── context/
│   │   └── AppContext.tsx      # Global state, API calls, auth
│   ├── lib/
│   │   ├── api.ts             # 40+ API functions with JWT auth
│   │   └── toast.ts           # Toast notification system
│   └── components/
│       ├── LoginView.tsx              # Login form with demo buttons
│       ├── Sidebar.tsx                # Navigation sidebar
│       ├── Topbar.tsx                 # Header bar with notifications
│       ├── AdminDashboardView.tsx     # Admin overview dashboard
│       ├── MemberDashboardView.tsx    # MP dashboard
│       ├── ProjectsView.tsx           # Request pipeline with filters
│       ├── AssignModal.tsx            # Multi-officer/team assignment modal
│       ├── OfficerWorkflowView.tsx    # Officer's task queue with multi-file uploads
│       ├── OfficerRevisionWorkspaceView.tsx  # Revision workspace with TipTap rich text editor
│       ├── AdminRevisionReviewView.tsx       # Admin review interface with inline text annotation
│       ├── NewRequestFormView.tsx     # Research request form
│       ├── CommitteeWorkbenchView.tsx # Committee management
│       ├── ParliamentaryCalendarView.tsx  # Calendar view
│       ├── ResearchTemplatesView.tsx  # Report templates
│       ├── DocumentVersionDiffView.tsx    # Version diff viewer
│       ├── StatisticsView.tsx         # Charts and analytics
│       ├── MembersView.tsx            # User management
│       ├── ActivityLogView.tsx        # Audit log viewer
│       ├── NotificationsView.tsx      # Notification center
│       ├── SettingsView.tsx           # User profile settings
│       ├── SupportView.tsx            # Help and support
│       ├── ArchiveView.tsx            # Archived requests
│       ├── GlobalSearch.tsx           # Ctrl+K search palette
│       ├── ExportButton.tsx           # CSV/PDF export
│       ├── ErrorBoundary.tsx          # Error boundary component
│       └── LoadingSpinner.tsx         # Loading spinner
├── .env.example               # Environment variable template
├── credentials.md             # All test user credentials
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## Database Schema

### Models

| Model | Description |
|-------|-------------|
| `Department` | Organizational departments |
| `User` | All system users with roles |
| `Committee` | 16 Parliament of Ghana standing/select/joint/ad-hoc committees |
| `ResearchRequest` | Research requests submitted by MPs |
| `Assignment` | Links officers/teams to requests with deadlines |
| `ResearchTeam` | Research teams with members |
| `TeamMember` | Team membership join table |
| `ResearchReport` | Report drafts and final versions |
| `ReportVersion` | Version history for reports |
| `ReviewComment` | Admin review comments on reports with inline text highlighting |
| `Attachment` | File attachments on requests |
| `SharedResearch` | Cross-committee request sharing |
| `Notification` | In-app notifications |
| `ActivityLog` | System-wide audit trail |
| `Setting` | Key-value application settings |
| `PasswordResetToken` | Secure password reset tokens |

### Enums

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `RESEARCH_OFFICER`, `RESEARCH_ASSISTANT`, `MP` |
| `RequestStatus` | `SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `DRAFT_SUBMITTED`, `REVISION_REQUESTED`, `REVISED`, `APPROVED`, `DELIVERED`, `CLOSED` |
| `Priority` | `STANDARD`, `URGENT` |
| `CommitteeType` | `STANDING`, `SELECT`, `JOINT`, `AD_HOC` |
| `NotificationType` | `REQUEST_SUBMITTED`, `REQUEST_ASSIGNED`, `REPORT_UPLOADED`, `REVISION_REQUESTED`, `REPORT_APPROVED`, `REPORT_DELIVERED`, `GENERAL` |
| `FileType` | `PDF`, `DOCX`, `XLSX`, `ZIP` |
| `ActivityAction` | `CREATED`, `UPDATED`, `ASSIGNED`, `STATUS_CHANGED`, `FILE_UPLOADED`, `COMMENT_ADDED`, `APPROVED`, `REJECTED`, `DEACTIVATED`, `LOGIN`, `LOGOUT` |

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/login` | Login with email/password | No |
| POST | `/forgot-password` | Request password reset | No |
| PUT | `/profile` | Update own profile | Yes |
| POST | `/change-password` | Change password | Yes |

### Research Requests (`/api/requests`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all requests | Yes |
| GET | `/:id` | Get single request | Yes |
| POST | `/` | Create new request | Yes (ADMIN, MP) |
| PUT | `/:id` | Update request | Yes |
| POST | `/:id/cancel` | Cancel request | Yes |
| GET | `/meta/committees` | List committees | Yes |
| GET | `/meta/committees/stats` | Committee request stats | Yes |
| GET | `/committee/:committeeId` | Requests by committee | Yes |
| GET | `/search/global` | Global search | Yes |
| POST | `/:requestId/share` | Share with committee | Yes |
| GET | `/:requestId/shared` | Get shared info | Yes |
| GET | `/shared/committee/:committeeId` | Shared with committee | Yes |

### Assignments (`/api/assignments`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/pending` | Pending assignments | Yes (ADMIN) |
| POST | `/` | Assign officer/team(s) | Yes (ADMIN) |
| GET | `/officers` | List available officers | Yes (ADMIN) |
| POST | `/:assignmentId/accept` | Accept assignment | Yes (OFFICER) |
| POST | `/:assignmentId/decline` | Decline with reason | Yes (OFFICER) |

### Reports (`/api/reports`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create/upload report | Yes |
| GET | `/:reportId/versions` | Version history | Yes |
| GET | `/:reportId/versions/:v1/compare/:v2` | Compare versions | Yes |

### Reviews (`/api/reviews`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/request/:requestId` | Get review comments | Yes |
| POST | `/` | Add review comment (with optional `highlightedText`, `startOffset`, `endOffset` for inline annotations) | Yes (ADMIN) |
| PUT | `/:commentId/resolve` | Resolve comment | Yes (ADMIN) |
| POST | `/:commentId/request-revision` | Request revision (notifies officer via in-app + email) | Yes (ADMIN) |
| POST | `/approve` | Approve report (notifies submitter) | Yes (ADMIN) |

### Teams (`/api/teams`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all teams | Yes |
| GET | `/:teamId` | Get team details | Yes |
| POST | `/` | Create team | Yes (ADMIN) |
| PUT | `/:teamId` | Update team | Yes (ADMIN) |
| POST | `/:teamId/members` | Add members | Yes (ADMIN) |
| DELETE | `/:teamId/members/:userId` | Remove member | Yes (ADMIN) |
| DELETE | `/:teamId` | Deactivate team | Yes (ADMIN) |

### Users (`/api/users`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all users | Yes (ADMIN) |
| POST | `/` | Create user | Yes (ADMIN) |
| PUT | `/:id` | Update user | Yes (ADMIN) |
| POST | `/:id/reset-password` | Reset password | Yes (ADMIN) |
| POST | `/:id/deactivate` | Deactivate user | Yes (ADMIN) |

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Dashboard metrics | Yes |
| GET | `/analytics` | Detailed analytics | Yes |
| GET | `/activity` | Activity audit log | Yes |
| GET | `/workload` | Officer workload stats | Yes |

### Notifications (`/api/notifications`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List notifications | Yes |
| PUT | `/:id/read` | Mark as read | Yes |
| PUT | `/read-all` | Mark all as read | Yes |

### File Uploads (`/api/uploads`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/request/:requestId` | List attachments | Yes |
| GET | `/:attachmentId/download` | Download file | Yes |
| POST | `/:requestId` | Upload file | Yes |

### Health Check

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Server health check | No |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `prrms-dev-secret` | JWT signing secret |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS allowed origin |
| `PORT` | No | `3001` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `VITE_API_URL` | No | `http://localhost:3001/api` | Frontend API base URL |
| `SMTP_HOST` | No | `localhost` | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use TLS |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | `PRRMS <noreply@parliament.gov.gh>` | From address for emails |

> **Note:** Email notifications require `SMTP_HOST` to be configured. Without it, emails are logged to console but not sent.

## Parliamentary Committees

The system comes pre-seeded with 16 Parliament of Ghana committees:

1. Committee on Finance
2. Committee on Education
3. Committee on Health
4. Committee on Mines and Energy
5. Committee on Roads and Transport
6. Committee on Food and Agriculture
7. Committee on Defence and Interior
8. Committee on Foreign Affairs
9. Committee on Constitutional, Legal and Parliamentary Affairs
10. Committee on Trade, Industry and Tourism
11. Committee on Communication
12. Committee on Employment and Social Welfare
13. Committee on Local Government and Rural Development
14. Committee on Water Resources, Works and Housing
15. Committee on Science and Technology
16. Committee on Women and Children
