# HealerMy - FHIR Healthcare Appointment System

A Next.js healthcare appointment management system using **SMART on FHIR** authentication and **pure FHIR R4** as the database. Built as a proof-of-concept demonstrating FHIR interoperability standards.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.4-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb)](https://react.dev/)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-orange)](https://www.hl7.org/fhir/)

## 🏥 Overview

HealerMy provides two role-based portals for healthcare appointment management:

- **Patient Portal**: Browse practitioners, book appointments, view medical history, manage communications
- **Provider Portal**: Manage clinic appointments, review patient profiles, approve/reject requests, oversee schedules

**Key Features:**
- ✅ Pure FHIR R4 workflow - no custom database required
- ✅ SMART on FHIR OAuth2 authentication with automatic token refresh
- ✅ Automatic slot management - slots update based on appointment status
- ✅ Real-time communications and notifications
- ✅ Complete patient medical profiles (conditions, medications, procedures, encounters)
- ✅ Secure session management with AES-GCM encryption
- ✅ Portable Docker deployment - configure entirely via environment variables

---

## 🐳 Quick Start with Docker (5 Minutes)

**Pull and run the pre-built image** - no installation or compilation required!

```bash
# 1. Pull the image
docker pull hiufungleung/healermy:latest

# 2. Generate session secret
export SESSION_SECRET=$(openssl rand -hex 32)

# 3. Run the container
docker run -d \
  --name healermy \
  -p 3000:3000 \
  -e BASE_URL=https://your-domain.com \
  -e FHIR_SERVER_URL=https://gw.interop.community/healerMy/data \
  -e CLIENT_ID=your_fhir_client_id \
  -e CLIENT_SECRET=your_fhir_client_secret \
  -e SESSION_SECRET=$SESSION_SECRET \
  --restart unless-stopped \
  hiufungleung/healermy:latest

# 4. Access the app at: https://your-domain.com/launch
```

**Docker Compose (Recommended):**

```yaml
version: '3.8'
services:
  healermy:
    image: hiufungleung/healermy:latest
    container_name: healermy
    ports:
      - "3000:3000"
    environment:
      - BASE_URL=https://your-domain.com
      - FHIR_SERVER_URL=https://gw.interop.community/healerMy/data
      - CLIENT_ID=${CLIENT_ID}
      - CLIENT_SECRET=${CLIENT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - SESSION_EXPIRY=90d
      - ACCESS_TYPE=offline
    restart: unless-stopped
```

See [.env.example](.env.example) for all configuration options.

---

## 💻 Local Development

### Prerequisites

- **Node.js**: 24.x or higher
- **pnpm**: 10.18.0+ (automatically managed via corepack)
- **FHIR Server**: Access to a SMART on FHIR R4 compliant server

### Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd comp3820-healermy

# 2. Enable corepack (for pnpm)
corepack enable

# 3. Install dependencies
pnpm install

# 4. Create environment file
cp .env.example .env.local

# 5. Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add output to SESSION_SECRET in .env.local

# 6. Configure FHIR credentials in .env.local
# - CLIENT_ID: From your FHIR app registration
# - CLIENT_SECRET: From your FHIR app registration
# - FHIR_SERVER_URL: Your FHIR server endpoint

# 7. Start development server
pnpm dev
```

Application runs at: http://localhost:3000

### Development Commands

```bash
pnpm dev          # Start dev server with Turbopack (hot reload)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm tsc --noEmit # TypeScript type checking
pnpm clean        # Remove .next cache
pnpm clean:dev    # Clean cache and start dev server
```

---

## 🏗️ Architecture

### Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 15.4.7 (App Router, Edge Runtime) |
| **Runtime** | Node.js 24 (Alpine in production) |
| **Language** | TypeScript 5.9.2 (strict mode) |
| **UI Library** | React 19.1.0 |
| **Styling** | Tailwind CSS 3.4.17 + shadcn/ui |
| **FHIR Client** | fhirclient 2.6.0 |
| **Package Manager** | pnpm 10.18.0 |

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

1. **RESTful API Layer**: All FHIR operations go through `/api/fhir/*` routes
   - Never import FHIR client directly in components
   - Centralized authentication and error handling
   - Type-safe API contracts

2. **FHIR R4 Naming Standard**: All endpoints follow FHIR specification
   - Singular resource names (e.g., `/Appointment` not `/appointments`)
   - PascalCase (e.g., `/MedicationRequest` not `/medication-requests`)
   - Matches FHIR resource types exactly

3. **Pure FHIR Data Model**: No custom database
   - FHIR server is single source of truth
   - Automatic slot management via FHIR operations
   - Complete CRUD through FHIR API

4. **Session Security**:
   - AES-GCM encrypted cookies (Web Crypto API)
   - HTTP-only, Secure, SameSite=Strict
   - Automatic token refresh via middleware
   - OAuth2 compliant token revocation

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # OAuth callback, logout, session
│   │   └── fhir/              # FHIR R4 API routes (RESTful)
│   │       ├── Appointment/   # Appointment CRUD
│   │       ├── Communication/ # Messages & notifications
│   │       ├── Patient/       # Patient resources
│   │       ├── Practitioner/  # Practitioner directory
│   │       ├── Schedule/      # Provider schedules
│   │       ├── Slot/          # Time slot management
│   │       └── [Resource]/    # Other FHIR resources
│   ├── patient/               # Patient portal pages
│   ├── provider/              # Provider portal pages
│   └── launch/                # SMART on FHIR launch
├── components/
│   ├── common/                # Shared UI components
│   ├── patient/               # Patient-specific components
│   ├── provider/              # Provider-specific components
│   └── ui/                    # shadcn/ui primitives
├── lib/                       # Utility functions
├── library/                   # Legacy utilities (being phased out)
├── types/                     # TypeScript definitions
└── middleware.ts              # Token refresh, route protection
```

---

## 🔐 Security

### Authentication Flow

1. **SMART Launch**: User navigates to `/launch?iss={FHIR_URL}&launch={TOKEN}`
2. **OAuth2 Authorization**: Redirect to FHIR provider's authorization endpoint
3. **Token Exchange**: Callback receives code, exchanges for access/refresh tokens
4. **Session Creation**: Tokens encrypted and stored in HTTP-only cookies
5. **Auto Refresh**: Middleware refreshes tokens before expiry
6. **Logout**: Revokes refresh token (RFC 7009) and clears session

### Session Management

- **Encryption**: AES-GCM with 256-bit keys (Web Crypto API)
- **Storage**: Split cookies (`healermy_tokens` + `healermy_session`)
- **Flags**: HTTP-only, Secure (HTTPS), SameSite=Strict
- **Expiry**: Configurable (default: 90 days)
- **Token Refresh**: Automatic via middleware (5 minutes before expiry)

### Environment Security

**⚠️ Never commit to git:**
- `SESSION_SECRET` - Session encryption key
- `CLIENT_SECRET` - FHIR app client secret
- Any production credentials

**Generate session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔄 FHIR Workflow

### Appointment Lifecycle

```
┌─────────────┐
│   Patient   │
│   Books     │
└──────┬──────┘
       │
       ▼
   [pending] ────────────► Slot: busy (prevents double-booking)
       │
       ▼ Provider approves
   [booked] ─────────────► Slot: busy
       │
       ▼ Patient arrives
   [arrived] ────────────► Slot: busy
       │
       ▼ Check-in
  [checked-in] ──────────► Slot: busy
       │
       ▼ Complete
  [fulfilled] ───────────► Slot: busy
       │
       ▼ Or cancel
  [cancelled] ───────────► Slot: free (available for rebooking)
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
| `proposed` | `busy-tentative` | Tentatively scheduled |
| `cancelled` | `free` | Freed for rebooking |
| `noshow` | `free` | Freed for rebooking |
| `waitlist` | `free` | Available |
| `entered-in-error` | `entered-in-error` | Record error |

**Implementation:** See `SLOT_MANAGEMENT.md` for technical details.

---

## 🚀 Deployment

### Docker Deployment (Production)

The Docker image is **fully portable** and works anywhere:

**✅ Supported Platforms:**
- AWS (EC2, ECS, Fargate, Lightsail)
- Google Cloud (Cloud Run, GKE, Compute Engine)
- Azure (Container Instances, AKS, App Service)
- DigitalOcean (Droplets, App Platform)
- Any VPS with Docker
- Local development

**✅ Multi-Architecture:**
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64, Apple Silicon)

**Deployment Example (Docker Run):**

```bash
docker run -d \
  --name healermy \
  -p 3000:3000 \
  -e BASE_URL=https://healermy.example.com \
  -e FHIR_SERVER_URL=https://fhir.example.com/data \
  -e CLIENT_ID=your_client_id \
  -e CLIENT_SECRET=your_client_secret \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e SESSION_EXPIRY=90d \
  -e ACCESS_TYPE=offline \
  --restart unless-stopped \
  hiufungleung/healermy:latest
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BASE_URL` | Public HTTPS URL | `https://healermy.example.com` |
| `FHIR_SERVER_URL` | FHIR server endpoint | `https://gw.interop.community/healerMy/data` |
| `CLIENT_ID` | FHIR app client ID | `d4bb5a3f-2293-40fc-8c36-4f01d64d3c32` |
| `CLIENT_SECRET` | FHIR app client secret | `(generated secret)` |
| `SESSION_SECRET` | Session encryption key (32 bytes hex) | `(generated with openssl)` |
| `SESSION_EXPIRY` | Session expiry duration | `90d` (90 days) |
| `ACCESS_TYPE` | Token type: `online` or `offline` | `offline` (with refresh tokens) |

**Optional Variables:**
- `PATIENT_SCOPE_OFFLINE` - Patient FHIR scopes (offline access)
- `PATIENT_SCOPE_ONLINE` - Patient FHIR scopes (online access)
- `PROVIDER_SCOPE_OFFLINE` - Provider FHIR scopes (offline access)
- `PROVIDER_SCOPE_ONLINE` - Provider FHIR scopes (online access)

See [.env.example](.env.example) for complete configuration reference.

### Cloudflare Proxy Setup

If using Cloudflare as reverse proxy:

**1. SSL/TLS Settings:**
- Encryption mode: **Full (strict)**
- Always Use HTTPS: **On**
- Minimum TLS: **1.2**

**2. Environment Configuration:**

⚠️ **Critical**: Use your public HTTPS domain, not internal IPs:

```bash
# ✅ CORRECT
BASE_URL=https://healermy.example.com

# ❌ WRONG - Causes SSL errors
BASE_URL=http://0.0.0.0:3000
BASE_URL=http://localhost:3000
```

**3. FHIR App Registration:**

Register this redirect URI in your FHIR app:
```
https://healermy.example.com/api/auth/callback
```

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

## 🧪 Development Guidelines

### Type Safety Rules

✅ **DO:**
- Extend types in `/src/types/fhir.ts` for missing FHIR properties
- Run `pnpm tsc --noEmit` before committing
- Use `@/` import alias for paths 3+ levels deep

❌ **DON'T:**
- Use `as any` (zero tolerance)
- Use multiple `../../../` in imports
- Import FHIR client directly in client components

### Data Flow Pattern

```typescript
// ✅ CORRECT: Use API routes
const response = await fetch('/api/fhir/Appointment', {
  credentials: 'include'  // Required for session cookies
});
const appointments = await response.json();

// ❌ WRONG: Direct FHIR client import
import { FHIRClient } from '@/app/api/fhir/client';
```

### Code Organization

- **Reusable utilities** → `/src/lib/`
- **FHIR types** → `/src/types/fhir.ts`
- **API routes** → `/src/app/api/fhir/[Resource]/`
- **UI components** → `/src/components/` (use shadcn/ui primitives)

**Extract common logic:**
```typescript
// Good: Reusable utility
import { enhanceAppointmentsWithPractitionerDetails } from '@/library/appointmentDetailInfo';
const enhanced = await enhanceAppointmentsWithPractitionerDetails(appointments);

// Bad: Duplicate code in multiple components
```

---

## 🐛 Troubleshooting

### Common Issues

**401 Unauthorized**
- Check session cookies in browser DevTools (Application → Cookies)
- Verify FHIR app scopes match required permissions
- Check token expiry (auto-refresh should handle this)

**403 Forbidden**
- Verify FHIR app has correct resource permissions
- Check patient vs provider scopes
- Ensure user role matches endpoint requirements

**Patient profile shows "[Bundle object]" instead of data**
- Fixed in latest version
- FHIR API returned `total: 0` which was incorrectly parsed
- Update to latest code or Docker image

**Batch endpoint fails for patients**
- Fixed in latest version
- Now allows GET requests for all roles
- Write operations (POST/PUT/PATCH/DELETE) require provider role

**Slot not found**
- Verify practitioner has active schedules
- Check slots are generated for the date range
- Ensure slot status is `free`

**Build fails**
- Run `pnpm tsc --noEmit` to check type errors
- Clear cache: `pnpm clean` or `rm -rf .next`
- Verify Node.js version: `node --version` (requires 24.x)

**Docker container exits immediately**
- Check logs: `docker logs healermy`
- Verify required environment variables are set
- Ensure `BASE_URL` uses HTTPS (not HTTP)

---

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive project memory and architectural decisions
- **[SLOT_MANAGEMENT.md](SLOT_MANAGEMENT.md)** - Automatic slot management system
- **[.env.example](.env.example)** - Environment variable reference
- **[assets/requirement.md](assets/requirement.md)** - Original project requirements
- **[assets/swagger.json](assets/swagger.json)** - FHIR API specification

---

## 📝 License

This project is for educational purposes (COMP3820 coursework).

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- FHIR client by [SMART Health IT](https://github.com/smart-on-fhir/client-js)
- Icons from [Lucide](https://lucide.dev/)

---

**For detailed architectural information and development guidelines, see [CLAUDE.md](CLAUDE.md).**
