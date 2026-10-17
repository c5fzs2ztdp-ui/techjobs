# TechJobs - Israeli Tech Job Board

A full-stack application for browsing Israeli tech jobs, built with React, Express.js, and Supabase.

**Job data** comes from a configurable JSON feed (see `VITE_JOBS_DATA_URL` below). `scripts/convert_jobs.mjs` converts a jobs JSON file into the site payload, so data updates never require a site redeploy.

**No login required to browse.** Guests can search and filter all jobs; signing in with Google is only needed to sync saved jobs and applied tracking across devices (guest saves stay in browser localStorage).

## ⚙️ Data source configuration

The frontend reads the jobs payload from a plain JSON URL (no API needed):

| Env var (build time) | Default | Purpose |
| --- | --- | --- |
| `VITE_JOBS_DATA_URL` | `https://raw.githubusercontent.com/c5fzs2ztdp-ui/techjobs/data/jobs.json` | Jobs payload feed. Point at your own published payload to use a different data source. |
| `VITE_SUBMIT_COMPANY_URL` | `https://github.com/halleelyasaf/techjob_map` | Where the "Add Company" dialog sends contributors. |

The payload format is produced by `scripts/convert_jobs.mjs` (see its
regression tests in `scripts/convert_jobs.test.mjs`).

## 🏗️ Architecture

```
techjobs/
├── frontend/            # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks (useAuth)
│   │   └── api/         # API client
│   ├── Dockerfile
│   └── nginx.conf
├── backend/             # Express.js backend
│   ├── src/
│   │   ├── routes/      # API routes (auth, savedJobs, companies)
│   │   ├── config/      # Passport OAuth configuration
│   │   └── database.ts  # SQLite database
│   └── Dockerfile
├── Makefile             # Build & run commands
└── podman-compose.yml   # Container orchestration
```

## 🔐 Authentication

This app uses **Google OAuth** for authentication. Users can:
- Browse jobs without logging in
- Save jobs to their personal list when logged in
- Jobs saved while logged out use browser localStorage (not synced)

### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   - For production: `http://localhost:8080/auth/google/callback`
   - For development: `http://localhost:3001/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**

### Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Required for OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional - auto-generated if not set
SESSION_SECRET=your-session-secret-at-least-32-chars
```

## 🚀 Quick Start

### Option 1: Run with Podman (Recommended for Production)

```bash
# Make sure Podman and podman-compose are installed
# macOS: brew install podman && pip3 install podman-compose
# Linux: sudo apt install podman && pip3 install podman-compose

# Set OAuth credentials
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret

# Build and start
make build
make up
```

The app will be available at:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Option 2: Run for Development

```bash
# Terminal 1 - Backend (with OAuth)
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
export GOOGLE_CALLBACK_URL=http://localhost:5173/auth/google/callback
export FRONTEND_URL=http://localhost:5173
export CORS_ORIGIN=http://localhost:5173
make dev-backend    # Runs on http://localhost:3001

# Terminal 2 - Frontend
make dev-frontend   # Runs on http://localhost:5173
```

For development, the frontend's Vite proxy is configured to forward `/api` and `/auth` to the backend.

## 📦 Make Commands

```bash
make help           # Show all available commands

# Production (Podman)
make build          # Build container images
make up             # Start all services
make down           # Stop all services
make restart        # Restart all services
make logs           # View container logs
make status         # Show container status
make clean          # Remove containers, volumes, and images

# Development
make dev-backend    # Start backend in dev mode
make dev-frontend   # Start frontend in dev mode
```

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | Get current user |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | OAuth callback |
| POST | `/auth/logout` | Logout user |

### Saved Jobs (Requires Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/saved-jobs` | List user's saved jobs |
| GET | `/api/saved-jobs/:id` | Get a saved job by ID |
| POST | `/api/saved-jobs` | Save a new job |
| PUT | `/api/saved-jobs/:id` | Update a saved job |
| DELETE | `/api/saved-jobs/:id` | Remove a saved job |

### Companies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List all companies |
| GET | `/api/companies/:id` | Get a company by ID |
| GET | `/api/companies/by-name/:name` | Get a company by name |
| POST | `/api/companies` | Create a company |
| PUT | `/api/companies/by-name/:name` | Create or update a company |

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TanStack Query** for data fetching
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **Framer Motion** for animations
- **React Router** for navigation

### Backend
- **Express.js** with TypeScript
- **Passport.js** with Google OAuth 2.0
- **SQLite** (via better-sqlite3)
- **express-session** for session management

### Infrastructure
- **Podman** containers
- **nginx** for serving frontend and proxying API

## 📊 Data Source

Jobs are fetched from the [Israeli Tech Map](https://github.com/mluggy/techmap) GitHub repository.

## 🔒 Data Persistence

- **Authenticated users**: Saved jobs stored in SQLite, synced across devices
- **Anonymous users**: Falls back to browser localStorage
- **Database volume**: `techjobs-data` persists between container restarts

## 📝 License

MIT
