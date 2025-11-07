# HealerMy - FHIR Healthcare Appointment System

> ### Degraded FHIR MELD Sandbox after AWS outage on 20 Oct 2025
> The app is using MELD sandbox as the FHIR service. Since the AWS outage on 20/10/2025, the service has been keeping degraded. When the app is performing a lot of actions and request in a short time, the FHIR service will be stuck and return 500 error. It is not the app's fault, we are trying to migrate to a more reliable service provider in the future.

> ### COMP3820 Blackboard submission (not for GitHub)
> The entire `env.local` is provided in the blackboard submission. Ensure the app is running at the port 3000, otherwise the authentication process cannot be completed as the callback url is `http://localhost:3000/api/auth/callback`. The dev server is running at port 3000 by default; in order to specify the port just in case, use `pnpm run dev -p 3000` to pass the port argument.

A Next.js healthcare appointment management system using **SMART on FHIR** authentication and **pure FHIR R4** as the database. Built as a proof-of-concept demonstrating FHIR interoperability standards.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb)](https://react.dev/)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-orange)](https://www.hl7.org/fhir/)

## Overview

HealerMy provides two role-based portals for healthcare appointment management:

- **Patient Portal**: Browse practitioners, book appointments, view medical history, manage communications, track queue position
- **Provider Portal**: Manage clinic-wide appointments, review patient profiles, approve/reject requests, oversee schedules and slots

**Key Features:**
- Pure FHIR R4 workflow - no custom database required
- SMART on FHIR OAuth2 authentication with automatic token refresh
- Automatic slot management - slots update based on appointment status
- Real-time communications and notifications (10-second polling interval)
- Complete patient medical profiles (conditions, medications, procedures, encounters)
- Encounter-based queue calculation with real-time wait times
- UX-centred schedule and slot management at the provider side
- Secure session management with AES-GCM encryption
- Portable Docker deployment - configure entirely via environment variables

---

## Run the App
### Prerequisite: Set up FHIR Sandbox

This app is tested and run on [MELD Sandbox](https://meld.interop.community/), which is a FHIR-based sandbox server.
- Sign up an account.
- Create a sandbox. If you tick the option `Import sample patients and practitioners`, you will get a list of patients and practitioners in the sandbox for testing without manually create these resources.
- Create an app with the following configurations:
  - **Scopes**: Refer to [FHIR Scopes](#fhir-scope-variables)
  - **APP Launch URI**: `{your-base-url}/launch`
  - **APP Redirect URI**: `{your-base-url}/api/auth/callback`


### Method 1: Docker Run (Quick Test)

Perfect for quick testing or simple deployments:

```bash
# 1. Pull the image
docker pull hiufungleung/healermy:latest

# 2. Generate session secrets
export SESSION_SECRET=$(openssl rand -hex 32)
export SESSION_SALT=$(openssl rand -hex 32)

# 3. Run the container with environment variables
docker run -d \
  --name healermy \
  -p 3000:3000 \
  -e BASE_URL=https://your-domain.com \
  -e FHIR_SERVER_URL=https://your-fhir-server.com \
  -e CLIENT_ID=your_fhir_client_id \
  -e CLIENT_SECRET=your_fhir_client_secret \
  -e SESSION_SECRET=$SESSION_SECRET \
  -e SESSION_SALT=$SESSION_SALT \
  -e ACCESS_TYPE=offline \
  --restart unless-stopped \
  hiufungleung/healermy:latest
```

### Method 2: Docker Compose (Recommended for Production)

**Step 1: Create environment file**

```bash
# Copy the example environment file
cp .env.example .env

# Generate session secrets and append to .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
echo "SESSION_SALT=$(openssl rand -hex 32)" >> .env

# Edit .env file with your credentials
nano .env
```

**Step 2: Update `.env` with your configuration**

```bash
# Required: Application URLs
BASE_URL=https://your-domain.com
FHIR_SERVER_URL=https://your-fhir-server.com

# Required: FHIR Credentials
CLIENT_ID=your-client-id-from-fhir-app
CLIENT_SECRET=your-client-secret-from-fhir-app

# Required: Session Security (auto-generated in step 1)
SESSION_SECRET=<generated-in-step-1>
SESSION_SALT=<generated-in-step-1>

# Optional: Configuration (defaults shown)
SESSION_EXPIRY=90d
ACCESS_TYPE=offline
```

**Step 3: Use the provided `docker-compose.yml`**

The repository includes a `docker-compose.yml` file with two options:

#### Option A: Pull pre-built image from Docker Hub (default)

```bash
# Uses image: hiufungleung/healermy:latest
docker compose up -d
```

#### Option B: Build from local Dockerfile

```bash
# 1. Edit docker-compose.yml and uncomment the build section:
# build:
#   context: .
#   dockerfile: Dockerfile

# 2. Build and start
docker compose up -d --build

# Or build separately
docker compose build
docker compose up -d
```

**Step 4: Manage the application**

```bash
# View logs
docker compose logs -f

# Stop the application
docker compose down

# Rebuild after code changes
docker compose up -d --build
```

### Method 3: Local Development Server

**Prerequisites:**
- [Node.js](https://nodejs.org/en/download): **20.9.0 (LTS)** or above with `pnpm` enabled

**Setup:**

```bash
# 1. Clone repository
git clone https://github.com/hiufungleung/healermy.git
cd healermy

# 2. Enable corepack for pnpm, skipped if done
corepack enable pnpm

# 3. Install dependencies
pnpm install

# 4. Create environment file
cp .env.example .env.local

# 5. Generate session secrets
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env.local
echo "SESSION_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env.local

# 6. Edit .env.local with your configuration
nano .env.local
```

**Configure `.env.local`:**

```bash
# Required: Application URLs
BASE_URL=http://localhost:3000
FHIR_SERVER_URL=https://your-fhir-server.com

# Required: FHIR Credentials
CLIENT_ID=your-client-id-from-fhir-app
CLIENT_SECRET=your-client-secret-from-fhir-app

# Required: Session Security (auto-generated in step 5)
SESSION_SECRET=<generated-in-step-5>
SESSION_SALT=<generated-in-step-5>

# Optional: Configuration
SESSION_EXPIRY=90d
ACCESS_TYPE=offline
```

**Development Commands:**

```bash
pnpm dev          # Start dev server with Turbopack (hot reload)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm tsc --noEmit # TypeScript type checking
pnpm clean        # Remove .next cache
pnpm clean:dev    # Clean cache and start dev server
```

Application runs at: http://localhost:3000

See [Environment Variables](#-environment-variables) section below for detailed configuration options.

---

##  Environment Variables

All three deployment methods (Docker Run, Docker Compose, Local Dev) use the same environment variables for consistency.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BASE_URL` | Public application URL (HTTPS in production) | `https://healermy.example.com` or `http://localhost:3000` |
| `NEXT_PUBLIC_BASE_URL` | Public URL (client-side accessible) | Same as `BASE_URL` |
| `FHIR_SERVER_URL` | FHIR R4 server endpoint | `https://your-fhir-server.com` |
| `CLIENT_ID` | FHIR app client ID | `your-client-id-from-fhir-app` |
| `CLIENT_SECRET` | FHIR app client secret | `your-client-secret-from-fhir-app` |
| `SESSION_SECRET` | Session encryption key (32 bytes hex) | `(generate with: openssl rand -hex 32)` |
| `SESSION_SALT` | Session encryption salt (16 bytes hex) | `(generate with: openssl rand -hex 16)` |

### Optional Variables (with defaults)

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_APP_TIMEZONE` | Application timezone (IANA identifier) | `Australia/Brisbane` | Any valid IANA timezone (e.g., `America/New_York`, `Europe/London`) |
| `SESSION_EXPIRY` | Session expiry duration | `90d` | Format: `30m`, `2h`, `7d`, `90d`, `1y` |
| `ACCESS_TYPE` | OAuth access type | `offline` | `online` (session-only) or `offline` (with refresh tokens) |
| `TOKEN_REFRESH_BUFFER_SECONDS` | Refresh token buffer time | `300` | Seconds before expiry to refresh (300 = 5 minutes) |
| `TOKEN_COOKIE_NAME` | Token cookie name | `healermy_tokens` | Any valid cookie name if no conflict |

### FHIR Scope Variables

Override default FHIR permission scopes if needed:

| Variable | Description | Default |
|----------|-------------|---------|
| `PATIENT_SCOPE_OFFLINE` | Patient offline scopes | `launch/patient openid profile offline_access fhirUser user/*.* patient/*.*` |
| `PATIENT_SCOPE_ONLINE` | Patient online scopes | `launch/patient openid profile online_access fhirUser user/*.* patient/*.*` |
| `PROVIDER_SCOPE_OFFLINE` | Provider offline scopes | `launch/patient openid profile offline_access fhirUser user/*.* patient/*.*` |
| `PROVIDER_SCOPE_ONLINE` | Provider online scopes | `launch/patient openid profile online_access fhirUser user/*.* patient/*.*` |

### Docker-Specific Variables

Only needed for custom Docker configurations:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Internal container port | `3000` |
| `HOSTNAME` | Network interface to bind | `0.0.0.0` |
| `NODE_ENV` | Node environment | `production` |

### Security Notes

⚠️ **Never commit secrets to git:**

- Add `.env` and `.env.local` to `.gitignore`
- Use environment-specific secrets (different for dev/staging/prod)
- Rotate secrets regularly, especially after team member changes

✅ **Best Practices:**

- Use strong random values for `SESSION_SECRET` and `SESSION_SALT`
- Use HTTPS for `BASE_URL` in production
- Store secrets in secure vaults (AWS Secrets Manager, Azure Key Vault, etc.)
- Use different FHIR credentials for development and production

### Generating Secrets

```bash
# Generate SESSION_SECRET (32 bytes = 64 hex characters)
openssl rand -hex 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SALT (16 bytes = 32 hex characters)
openssl rand -hex 16
# or
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

See [.env.example](.env.example) for a complete template with all available options.

---

## 🏗️ Architecture

### Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router, Edge Runtime, Turbopack) |
| **Runtime** | Node.js 24 (Alpine in production) |
| **Language** | TypeScript 5.9 (strict mode) |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Calendar** | FullCalendar |
| **Package Manager** | pnpm 10.19 |

### System Architecture

```
┌─────────────────┐
│  Next.js App    │
│  (Client)       │
└────────┬────────┘
         │
         ├─── /api/auth/*        (OAuth2 flow, session management)
         │
         └─── /api/fhir/*        (RESTful FHIR endpoints)
                  │
                  ├── /Appointment      (Appointment management)
                  ├── /Communication    (Messages & notifications)
                  ├── /Patient          (Patient resources & profiles)
                  ├── /Practitioner     (Practitioner directory)
                  ├── /Schedule         (Provider schedules)
                  ├── /Slot             (Available time slots)
                  ├── /Encounter        (Patient encounters)
                  └── /[Resource]       (Other FHIR R4 resources)
                       │
                       ▼
              ┌──────────────────┐
              │  FHIR R4 Server  │
              │  (External)      │
              └──────────────────┘
```

**Key Architectural Decisions:**

1. **Next.js 16 with proxy.ts**:
   - Handles authentication, token refresh, and session management
   - Automatic token refresh when expiring within 5 minutes
   - Role-based route protection (patient/provider)

2. **RESTful API Layer**: All FHIR operations go through `/api/fhir/*` routes
   - Never import FHIR client directly in components
   - Centralised authentication and error handling
   - Type-safe API contracts

3. **FHIR R4 Naming Standard**:
   - Singular resource names (e.g., `/Appointment` not `/appointments`)
   - PascalCase (e.g., `/MedicationRequest` not `/medication-requests`)
   - Matches FHIR resource types exactly

4. **Pure FHIR Data Model**: No custom database
   - FHIR server is single source of truth
   - Automatic slot management via FHIR operations
   - Complete CRUD through FHIR API

5. **Session Security**:
   - AES-GCM encrypted cookies (Web Crypto API)
   - HTTP-only, Secure, SameSite=Strict
   - Automatic token refresh via proxy.ts
   - OAuth2 compliant token revocation

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # OAuth callback, logout, session
│   │   └── fhir/              # FHIR R4 API routes (RESTful)
│   │       ├── Appointment/   # Appointment CRUD + operations
│   │       │   ├── route.ts       # GET/POST appointments
│   │       │   ├── [id]/route.ts  # PUT/PATCH/DELETE by ID
│   │       │   └── operations.ts  # Appointment utilities
│   │       ├── Communication/ # Messages & notifications
│   │       │   ├── route.ts       # GET/POST communications (_count=50 default)
│   │       │   ├── [id]/route.ts  # GET/PUT/PATCH/DELETE by ID
│   │       │   └── operations.ts  # Communication utilities
│   │       ├── Patient/       # Patient resources
│   │       ├── Practitioner/  # Practitioner directory
│   │       ├── Schedule/      # Provider schedules
│   │       ├── Slot/          # Time slot management
│   │       │   ├── route.ts       # GET slots with pagination (_count=250)
│   │       │   ├── [id]/route.ts  # GET/PATCH/DELETE by ID
│   │       │   └── operations.ts  # Auto slot status management
│   │       ├── Encounter/     # Patient encounters
│   │       └── client.ts      # Pure FHIR utilities
│   ├── patient/               # Patient portal pages
│   │   ├── dashboard/         # Patient dashboard with queue position
│   │   ├── appointments/      # Appointments list with wait times
│   │   ├── book-appointment/  # Multi-step booking flow
│   │   └── messages/          # Communication inbox
│   ├── provider/              # Provider portal pages
│   │   ├── dashboard/         # Clinic-wide appointment overview
│   │   ├── appointments/      # Full appointment management
│   │   ├── practitioner/      # Practitioner management
│   │   │   └── [id]/          # Practitioner detail with slots calendar
│   │   └── schedules/         # Schedule management
│   └── launch/                # SMART on FHIR launch
├── components/
│   ├── auth/
│   │   ├── AuthProvider.tsx   # Auth context (10s notification polling)
│   │   └── ConsentScreen.tsx  # SMART consent screen
│   ├── common/                # Shared UI components
│   │   ├── Layout.tsx         # Main layout with navigation
│   │   ├── Button.tsx         # Wrapper for shadcn Button
│   │   ├── NotificationBell.tsx  # Bell icon with unread count
│   │   └── [other common components]
│   ├── patient/               # Patient-specific components
│   ├── provider/              # Provider-specific components
│   │   ├── SlotCalendar.tsx   # FullCalendar with expired slot styling
│   │   ├── GenerateSlotsForm.tsx  # Generate slots (weekend support)
│   │   └── [other provider components]
│   └── ui/                    # shadcn/ui primitives
│       ├── dialog.tsx         # Modal dialogs
│       ├── alert-dialog.tsx   # Confirmation dialogs
│       ├── calendar.tsx       # Date picker
│       ├── time-picker.tsx    # Custom inline time picker (HH:MM)
│       └── [other ui components]
├── lib/                       # Utility functions and shared logic
│   ├── auth/                  # Authentication utilities
│   │   ├── config.ts          # Auth configuration
│   │   ├── encryption.ts      # Session encryption (AES-GCM)
│   │   ├── session.ts         # Session management
│   │   └── tokenRefresh.ts    # Token refresh logic
│   ├── appointmentDetailInfo.ts  # Appointment enhancement utilities
│   ├── appointmentFlowUtils.ts   # Appointment status flow logic
│   ├── breakpoints.ts         # Responsive breakpoint utilities
│   ├── fhirBatch.ts           # FHIR batch request utilities
│   ├── fhirNameResolver.ts    # FHIR name formatting utilities
│   ├── queueCalculation.ts    # Encounter-based queue calculation
│   ├── request-utils.ts       # HTTP request utilities
│   ├── scheduleValidation.ts  # Schedule overlap validation
│   ├── shadcn-utils.ts        # shadcn/ui utility functions (cn, etc.)
│   └── timezone.ts            # Timezone conversion utilities
├── types/                     # TypeScript definitions
│   ├── auth.ts                # Authentication types
│   └── fhir.ts                # FHIR R4 resource types
└── proxy.ts                   # Token refresh, route protection (NEW in Next.js 16)
```

**Key Files:**

- **`/src/proxy.ts`**: Replaces middleware.ts in Next.js 16
  - Handles token refresh when expiring within 5 minutes
  - Session validation and route protection
  - Comprehensive token expiry logging

- **`/src/app/api/fhir/client.ts`**: Pure FHIR utilities
  - Authentication headers
  - Error handling
  - No HTTP request/response handling

- **`/src/components/provider/SlotCalendar.tsx`**: Calendar with advanced features
  - Week calculation starting from Sunday (includes full week)
  - Pagination support with `_count=250`
  - UTC timezone handling (direct UTC strings to avoid conversion)
  - Expired slot styling (grey for past slots)

- **`/src/components/auth/AuthProvider.tsx`**: Authentication context
  - Recursive timeout pattern for notification polling
  - 10-second interval after each response completes
  - Prevents request buildup

---

## 🔐 Security

### Authentication Flow

1. **SMART Launch**: User navigates to `/launch?iss={FHIR_URL}&launch={TOKEN}`
2. **OAuth2 Authorization**: Redirect to FHIR provider's authorization endpoint
3. **Token Exchange**: Callback receives code, exchanges for access/refresh tokens
4. **Session Creation**: Tokens encrypted and stored in HTTP-only cookies
5. **Auto Refresh**: proxy.ts refreshes tokens before expiry (5-minute threshold)
6. **Logout**: Revokes refresh token (RFC 7009) and clears session

### Session Management

- **Encryption**: AES-GCM with 256-bit keys (Web Crypto API)
- **Storage**: Single encrypted cookie (`healermy_tokens`)
- **Flags**: HTTP-only, Secure (HTTPS), SameSite=Strict
- **Expiry**: Configurable (default: 90 days)
- **Token Refresh**: Automatic via proxy.ts (5 minutes before expiry)
- **Logging**: Comprehensive token expiry debugging in proxy.ts

### Environment Security

**⚠️ Never commit to git:**
- `SESSION_SECRET` - Session encryption key
- `CLIENT_SECRET` - FHIR app client secret
- Any production credentials


---

## 🔄 FHIR Workflow

### Appointment Lifecycle

```
              ┌─────────────┐
              │   Patient   │
              │   Books     │
              └─────┬───────┘
                    │
    Or cancel       ▼
  ┬──────────── [pending] ────────────► Slot: busy (prevents double-booking)
  │                 │
  │ Or cancel       ▼ Provider approves
  │──────────── [booked] ─────────────► Slot: busy (NO auto-encounter)
  │                 │
  │                 ▼ Patient arrives
  │             [arrived] ────────────► Slot: busy
  │                 │
  │                 ▼ Practitioner: "Will finish in 10 min"
  │             [arrived] ────────────► Encounter: planned (✨ patient notified)
  │                 │
  │                 ▼ Start encounter
  │             Encounter: [in-progress]
  │                 │
  │                 ▼ Complete
  │             [fulfilled] ───────────► Slot: busy + Encounter: finished
  │
  │
  └─ [cancelled] ───────────► Slot: free (available for rebooking)
```

### Automatic Slot Management

**Appointment Status → Slot Status Mapping:**

| Appointment Status | Slot Status | Description |
|-------------------|-------------|-------------|
| `pending` | `busy` | **Prevents double-booking** while awaiting approval |
| `booked` | `busy` | Confirmed appointment |
| `arrived` | `busy` | Patient arrived |
| `checked-in` | `busy` | Patient checked in |
| `fulfilled` | `busy` | Appointment completed |
| `cancelled` | `free` | Freed for rebooking |
| `entered-in-error` | `entered-in-error` | Record error |

**Implementation:** See `SLOT_MANAGEMENT.md` for technical details.

### Encounter Workflow



**Simplified Flow:**

```
pending → [Approve] → booked (NO auto-encounter)
  ↓
  [Patient Arrived] → arrived
  ↓
  [Practitioner: "Will finish in 10 min"] → encounter: planned ✨
  ↓
  [Start Encounter] → encounter: in-progress
  ↓
  [Complete Encounter] → encounter: finished + appointment: fulfilled
```

**Key Encounter Status Values:**

- `planned` - Created when practitioner clicks "Will be finished in 10 minutes"
- `in-progress` - Encounter currently happening (auto-sets period.start)
- `finished` - Encounter completed (auto-sets period.end)

**Troubleshooting `ERR_SSL_PROTOCOL_ERROR`:**
- Cause: OAuth redirect using internal IP instead of public HTTPS domain
- Fix: Set `BASE_URL=https://healermy.example.com` and redeploy
- Verify: `docker exec healermy env | grep BASE_URL`

### Health Check

```bash
curl https://your-domain.com/api/health-check
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "healermy"
}
```

---

## Troubleshooting

### Common Issues

**Docker container exits immediately**
- Check logs: `docker logs healermy`
- Verify required environment variables are set
- Ensure `BASE_URL` uses HTTPS (not HTTP)

**FHIR Server 500 Errors**
- Check FHIR server logs for database connection issues
- Reduce `_count` parameter to lower server load (default: 50 for Communications)
- This is typically a server-side issue (JDBC connection pool exhaustion)


## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Educational Purpose:** Originally developed for COMP3820 coursework.

---

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Calendar from [FullCalendar](https://fullcalendar.io/)
- Icons from [Lucide](https://lucide.dev/)
- Fancy loader by [terenceodonoghue](https://uiverse.io/terenceodonoghue/rare-cow-16) on UIverse
