# HealerMy - FHIR Healthcare Appointment System

A Next.js healthcare appointment management system using **SMART on FHIR** authentication and **pure FHIR R4** as the database. Built for COMP3820 as a proof-of-concept prototype demonstrating FHIR interoperability.

## 🏥 Overview

HealerMy provides two distinct portals:
- **Patient Portal**: Browse practitioners, book appointments, view medical history
- **Provider Portal**: Manage appointments, review patient information, approve/reject requests

**Key Architecture**: Pure FHIR workflow with automatic slot management - no custom database required.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 24.x or higher
- **pnpm**: 10.18.0+ (automatically managed via corepack)
- **FHIR Server**: Access to a SMART on FHIR compliant server (e.g., Cerner sandbox)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd comp3820-healermy
```

2. **Enable corepack** (for pnpm)
```bash
corepack enable
```

3. **Install dependencies**
```bash
pnpm install
```

4. **Configure environment variables**

Create a `.env.local` file in the root directory:

```bash
# =============================================================================
# PUBLIC CONFIGURATION
# =============================================================================

# Base URL for your application
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# FHIR server endpoint
NEXT_PUBLIC_FHIR_SERVER_URL=https://gw.interop.community/healerMy/data

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================

# Access type: "offline" (with refresh token) or "online" (session only)
ACCESS_TYPE=offline

# Session expiry: s(seconds), m(minutes), h(hours), d(days), y(years)
SESSION_EXPIRY=90d

# =============================================================================
# SENSITIVE CREDENTIALS
# =============================================================================

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_generated_session_secret_here

# SMART on FHIR App Credentials (from your FHIR app registration)
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here

# =============================================================================
# FHIR PERMISSION SCOPES
# =============================================================================

# Patient scopes (read-only access to own data)
PATIENT_SCOPE_ONLINE="launch/encounter launch/patient openid profile online_access launch fhirUser user/*.* patient/*.*"
PATIENT_SCOPE_OFFLINE="launch/encounter launch/patient openid profile offline_access launch fhirUser user/*.* patient/*.*"

# Provider scopes (full CRUD access)
PROVIDER_SCOPE_ONLINE="launch/encounter launch/patient openid profile online_access launch fhirUser user/*.* patient/*.*"
PROVIDER_SCOPE_OFFLINE="launch/encounter launch/patient openid profile offline_access launch fhirUser user/*.* patient/*.*"
```

5. **Generate SESSION_SECRET**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

6. **Start development server**
```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### SMART Launch Flow

To access the application with FHIR authentication:

1. Navigate to the SMART launcher endpoint:
```
http://localhost:3000/launch?iss=<FHIR_SERVER_URL>&launch=<LAUNCH_TOKEN>
```

2. Complete the OAuth2 authorization flow through your FHIR provider

3. You'll be redirected to the appropriate portal (Patient or Provider) based on your role

## 📋 Available Commands

### Development
```bash
pnpm dev          # Start development server with Turbopack
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm tsc --noEmit # Type check without building
```

### Docker
```bash
# Build Docker image
docker build -t healermy .

# Run container
docker run -d -p 3000:3000 \
  -e CLIENT_ID=your_client_id \
  -e CLIENT_SECRET=your_client_secret \
  -e SESSION_SECRET=your_session_secret \
  healermy
```

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 15.4.7 (App Router)
- **Runtime**: Node.js 24 (Alpine in production)
- **React**: 19.1.0
- **TypeScript**: 5.9.2
- **Styling**: Tailwind CSS 3.4.17
- **FHIR Client**: fhirclient 2.6.0
- **Package Manager**: pnpm 10.18.0

### Key Features

- **SMART on FHIR OAuth2**: Secure authentication with token refresh
- **Pure FHIR Workflow**: All data stored in FHIR server (no custom database)
- **Automatic Slot Management**: Slots update automatically based on appointment status
- **RESTful API Layer**: All FHIR operations via `/api/fhir/*` routes
- **Edge Runtime**: Optimized middleware for token refresh
- **Session Encryption**: AES-GCM encrypted cookies using Web Crypto API

### Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # OAuth callback, logout
│   │   │   └── fhir/          # FHIR API routes
│   │   │       ├── appointments/
│   │   │       ├── practitioners/
│   │   │       ├── patients/
│   │   │       ├── schedules/
│   │   │       ├── slots/
│   │   │       └── communications/
│   │   ├── patient/           # Patient portal pages
│   │   └── provider/          # Provider portal pages
│   ├── components/
│   │   ├── common/            # Reusable UI components
│   │   ├── auth/              # Authentication components
│   │   └── providers/         # React context providers
│   ├── library/
│   │   ├── auth/              # Authentication utilities
│   │   └── fhir/              # FHIR utilities (deprecated - use API routes)
│   ├── lib/                   # Shared utilities
│   └── types/                 # TypeScript type definitions
├── .env.local                 # Environment variables (not in git)
├── Dockerfile                 # Production Docker image (Alpine-based)
└── .github/workflows/         # CI/CD pipelines
```

## 🔒 Security

### Session Management

- **Split Cookie Design**: Separate encrypted cookies for tokens and session metadata
- **HTTP-Only**: Cookies not accessible via JavaScript
- **Secure Flag**: HTTPS-only in production
- **SameSite Strict**: CSRF protection
- **AES-GCM Encryption**: Web Crypto API for Edge Runtime compatibility

### Token Refresh

- **Automatic Refresh**: Middleware refreshes tokens 5 minutes before expiry (hardcoded)
- **Graceful Fallback**: Redirects to login if refresh fails
- **OAuth2 Compliant**: Follows RFC 7009 for token revocation

### Environment Security

**Never commit these to git:**
- `SESSION_SECRET`
- `CLIENT_SECRET`
- Any production credentials

## 🔄 FHIR Workflow

### Appointment Lifecycle

1. **Patient Creates Appointment** → Status: `pending`, Slot: `busy`
2. **Provider Approves** → Status: `booked`, Slot: `busy`
3. **Patient Arrives** → Status: `arrived`, Slot: `busy`
4. **Patient Checked In** → Status: `checked-in`, Slot: `busy`
5. **Appointment Completed** → Status: `fulfilled`, Slot: `busy`
6. **If Cancelled** → Status: `cancelled`, Slot: `free`

### Automatic Slot Management

Slots automatically update when appointments change status:
- `pending`, `booked`, `arrived`, `checked-in`, `fulfilled` → `busy`
- `proposed` → `busy-tentative`
- `cancelled`, `noshow`, `waitlist` → `free`
- `entered-in-error` → `entered-in-error`

**Implementation**: See `SLOT_MANAGEMENT.md` for detailed documentation

## 🚢 Deployment

### GitHub Actions CI/CD

The project includes automated deployment via GitHub Actions:

1. **Build**: Multi-platform Docker image (amd64 + arm64)
2. **Push**: To Docker Hub
3. **Deploy**: SSH to EC2 and run container

**Required GitHub Secrets:**
- `DOCKER_TOKEN`: Docker Hub access token
- `EC2_KEY`: SSH private key for EC2 access
- `CLIENT_SECRET`: FHIR app client secret
- `SESSION_SECRET`: Session encryption key

**Required GitHub Variables:**
- `DOCKER_USERNAME`: Docker Hub username
- `EC2_HOST`: EC2 instance hostname
- `EC2_USER`: EC2 SSH username
- `NEXT_PUBLIC_BASE_URL`: Production URL
- `NEXT_PUBLIC_FHIR_SERVER_URL`: FHIR server endpoint
- `CLIENT_ID`: FHIR app client ID
- `SESSION_EXPIRY`: Session expiry duration (e.g., `90d`)
- `PATIENT_SCOPE_OFFLINE`, `PATIENT_SCOPE_ONLINE`: Patient permission scopes
- `PROVIDER_SCOPE_OFFLINE`, `PROVIDER_SCOPE_ONLINE`: Provider permission scopes
- `ACCESS_TYPE`: `online` or `offline`

### Health Check

The application exposes a health check endpoint:
```
GET /api/health-check
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "healermy"
}
```

### Cloudflare Proxy Setup

If using Cloudflare as a reverse proxy:

**1. Cloudflare SSL/TLS Settings:**
- **SSL/TLS encryption mode**: Full or Full (strict)
- **Always Use HTTPS**: On
- **Automatic HTTPS Rewrites**: On
- **Minimum TLS Version**: 1.2

**2. Critical Environment Variables:**

⚠️ **Important**: `NEXT_PUBLIC_*` variables are baked into the build at **build time**. For runtime configuration (Docker), use `BASE_URL` instead:

```bash
# ✅ CORRECT: Runtime configuration (Docker)
BASE_URL=https://healermy.hughishere.com

# ✅ ALSO CORRECT: Build-time configuration (local dev)
NEXT_PUBLIC_BASE_URL=https://healermy.hughishere.com

# ❌ WRONG: Internal addresses will cause SSL errors
BASE_URL=http://0.0.0.0:3000
```

**Why both?**
- `BASE_URL`: Read by server at **runtime** → Can be changed without rebuilding Docker image
- `NEXT_PUBLIC_BASE_URL`: Embedded at **build time** → Fixed when `docker build` runs

The auth config uses `BASE_URL` first (runtime), falling back to `NEXT_PUBLIC_BASE_URL` (build-time).

**3. FHIR App Redirect URI Registration:**

Your FHIR app must have the following redirect URI registered:
```
https://healermy.hughishere.com/api/auth/callback
```

**4. Verify Deployment:**
```bash
# Check container environment (both should be set)
docker exec healermy env | grep BASE_URL

# Should output:
# BASE_URL=https://healermy.hughishere.com
# NEXT_PUBLIC_BASE_URL=https://healermy.hughishere.com
```

**Common Issue**: `ERR_SSL_PROTOCOL_ERROR` on OAuth callback
- **Cause**: Redirect URI using internal IP `0.0.0.0:3000` instead of public HTTPS domain
- **Root Cause**: `NEXT_PUBLIC_BASE_URL` is embedded at build time; changing it at runtime doesn't work
- **Fix**: Use `BASE_URL` environment variable (read at runtime) + rebuild/redeploy
- **Quick Fix**: Set `-e BASE_URL=https://healermy.hughishere.com` in docker run command
- **Result**: OAuth redirect will use correct HTTPS public URL

## 📚 Documentation

- **CLAUDE.md**: Comprehensive project memory and architectural decisions
- **SLOT_MANAGEMENT.md**: Automatic slot management system documentation
- **assets/requirement.md**: Original project requirements
- **assets/swagger.json**: FHIR API specification

## 🧪 Development Guidelines

### Type Safety

- **Never use `as any`**: Extend types in `/src/types/fhir.ts` instead
- **Type check before commit**: `pnpm tsc --noEmit`
- **Strict mode enabled**: All TypeScript strict checks active

### Data Flow Pattern

```typescript
// ✅ CORRECT: Use API routes
const response = await fetch('/api/fhir/appointments', {
  credentials: 'include'
});
const { appointments } = await response.json();

// ❌ WRONG: Don't import FHIR client in client components
import { FHIRService } from '@/app/api/fhir/client';
```

### Code Organization

- **Extract reusable logic** to `/src/lib/`
- **No data fetching in Layout** - pass data via props
- **Follow existing patterns** - check similar features first

## 🐛 Troubleshooting

### Common Issues

**401 Unauthorized from FHIR API**
- Check session cookies in browser DevTools
- Verify FHIR app scopes match required permissions
- Check token expiry (auto-refresh should handle this)

**403 Forbidden**
- Verify FHIR app has correct resource permissions
- Check patient vs provider scopes

**Slot not found**
- Verify practitioner has active schedules
- Check slots are generated for the date range
- Ensure slot status is `free`

**Build fails**
- Run `pnpm tsc --noEmit` to check type errors
- Clear `.next` folder and rebuild
- Check Node.js version (requires 24.x)

## 📝 License

This project is for educational purposes (COMP3820).

## 👥 Contributors

Developed as part of COMP3820 coursework.

---

For detailed architectural information and development guidelines, see [CLAUDE.md](CLAUDE.md).
