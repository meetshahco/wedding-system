# Wedding Invitation & Guest Management Platform

A modern, multi-tenant digital wedding invitation platform built with **Next.js 15 (App Router)**, **Material UI (MUI)**, **PostgreSQL 16 (via Prisma)**, **TypeScript**, and **WhatsApp Cloud API integration**.

Designed for seamless couple onboarding, multi-event tier access, automated and family-delegated messaging, live delivery tracking, and custom domain hosting.

---

## Key Features

- **Multi-Wedding Tenancy:** Strict isolation of guests, events, senders, messages, and audit trails per wedding.
- **Role-Based Access Control:** Role hierarchy (`OWNER`, `MANAGER`, `USER`) with PBKDF2 password hashing, single-use expiring staff invites, and full audit logging.
- **Event & Access Tier Management:** Multi-event itineraries (e.g. Haldi, Mehendi, Sangeet, Wedding, Reception) with granular access levels (All Events, Sangeet + Wedding, VIP).
- **Public Guest Experience:**
  - Tokenized personal invite links (`/i/[token]`) showing only authorized events.
  - 4-digit code entry lookup (`/w/[slug]`) protected by rate limiting.
  - Interactive Google Maps navigation buttons and one-tap `.ics` calendar generation.
  - Automated open tracking (`viewedAt`, `openCount`).
  - Privacy-first: `noindex` meta tags and `robots.txt` exclusion.
- **Robust Sending Engine:**
  - Pluggable provider architecture: **WhatsApp Cloud API**, **Manual Links** (`wa.me`), and **Mock Provider** (for staging & tests).
  - High-concurrency message queue with PostgreSQL atomic batch claiming (`FOR UPDATE SKIP LOCKED`).
  - Rolling 24-hour daily send caps and exponential backoff retry scheduling.
- **Family Senders & Manual Mode:**
  - Split guest lists across family senders (e.g. Groom's Father, Bride's Brother).
  - PIN-locked public sender portals (`/s/[accessToken]`) with one-tap `wa.me` dispatch and "Did you send it?" confirmation flow.
- **WhatsApp Cloud API & Webhooks:**
  - Meta Graph API v25.0 integration.
  - Inbound webhook processing with HMAC SHA-256 signature verification (`x-hub-signature-256`).
  - Real-time status sync (`sent` $\to$ `delivered` $\to$ `read` $\to$ `failed`).
  - Inbound opt-out (`STOP` / `START`) compliance.
- **Custom Domains & Routing:**
  - Supports platform subdomains (`{slug}.weddings.test`) and custom apex/subdomains (e.g. `arjunandmeera.com`).
  - Automated DNS verification & Vercel project domain integration.
  - Host isolation: Administrative routes (`/admin/*`, `/login`) are strictly blocked (404) on guest-facing wedding domains.
- **Design System:**
  - Clean monochromatic aesthetic: `#111111` primary color, Inter font, 8px border radiuses, zero purple, and responsive down to 360px mobile viewports.

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Cloudflare / Vercel Edge  |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               | Host: platform.com                        | Host: coupledomain.com
               v                                           v
    +-----------------------+                   +-----------------------+
    | Next.js App Router    |                   | Next.js App Router    |
    |  - Admin Dashboard    |                   |  - Public Itinerary   |
    |  - Settings & Users   |                   |  - 4-Digit Code Entry |
    |  - Senders Portal     |                   |  - .ics Calendar      |
    +-----------+-----------+                   +-----------+-----------+
                |                                           |
                +---------------------+---------------------+
                                      |
                                      v
                        +---------------------------+
                        |   Prisma / PostgreSQL 16  |
                        |   (Atomic Skip Locked)    |
                        +-------------+-------------+
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
               +-------------------+     +-------------------+
               | Background Worker |     | Vercel Cron Tick  |
               | (worker/index.ts) |     | (/api/cron/tick)  |
               +---------+---------+     +---------+---------+
                         |                         |
                         +------------+------------+
                                      |
                                      v
                        +---------------------------+
                        | WhatsApp Cloud API / Meta |
                        +---------------------------+
```

---

## Tech Stack & Dependencies

- **Framework:** Next.js 15 (App Router, React 19)
- **UI & Components:** Material UI (MUI v6), `@emotion/react`, `@emotion/styled`
- **Database & ORM:** PostgreSQL 16+, Prisma ORM v6
- **Authentication & Security:** `iron-session`, Node.js `crypto` (PBKDF2-SHA512)
- **Validation:** `zod`, `libphonenumber-js`
- **Spreadsheet Parsing:** `exceljs`, `papaparse`
- **Testing:** Vitest v2, TypeScript 5

---

## Getting Started (Local Development)

### 1. Prerequisites
- Node.js 18.18+ or 20+
- PostgreSQL 16+ running locally or via Docker

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-org/wedding_system.git
cd wedding_system

# Install dependencies
npm install
```

### 3. Environment Setup
Copy the example environment file and configure your database connection:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wedding_system?schema=public"
SESSION_SECRET="your-secure-session-secret-at-least-32-chars-long"
PLATFORM_DOMAIN="weddings.test"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
CRON_SECRET="your-local-cron-secret"
```

### 4. Database Setup & Seeding
```bash
# Push schema to PostgreSQL
npx prisma db push

# Seed initial admin user and sample wedding data
npx tsx prisma/seed.ts
```

### 5. Start Application & Queue Worker
In development, you can run the Next.js server and background queue worker side-by-side:

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Background message queue worker (optional if using /api/cron/tick)
npm run worker
```

### 6. Initial Owner Login
Set `OWNER_EMAIL` and `OWNER_PASSWORD` in your `.env` or pass them during seed:
```bash
OWNER_EMAIL="owner@weddings.test" OWNER_PASSWORD="YourSecurePassword123" npm run db:seed
```
Navigate to [http://localhost:3000/login](http://localhost:3000/login).
On first login, the owner will be prompted to set a permanent, secure password before accessing the system (`mustChangePassword: true`).

---

## Deploying to Production (Vercel + Managed PostgreSQL)

### 1. Database Provisioning
Provision a PostgreSQL 16+ database on a cloud provider such as **Neon**, **Supabase**, **Railway**, or **AWS RDS Aurora**.

In production connection strings, enable connection pooling (e.g. PgBouncer):
```
DATABASE_URL="postgresql://user:password@pooler-host:6543/wedding_system?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://user:password@direct-host:5432/wedding_system?sslmode=require"
```

### 2. Vercel Project Setup
1. Push your code to a Git repository (GitHub/GitLab).
2. Import the repository into your Vercel Dashboard.
3. Configure the following **Environment Variables** in Vercel:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `SESSION_SECRET` | 32+ character random session encryption key | `openssl rand -hex 32` |
| `PLATFORM_DOMAIN` | Apex platform domain for subdomains | `ourweddings.com` |
| `NEXT_PUBLIC_BASE_URL` | Base administrative URL | `https://app.ourweddings.com` |
| `CRON_SECRET` | Secret token securing `/api/cron/tick` | `openssl rand -hex 24` |
| `DAILY_SEND_CAP` | Rolling 24-hour daily send cap per wedding | `250` |
| `WHATSAPP_ACCESS_TOKEN` | Meta App System User Access Token | `EAA...` |
| `WHATSAPP_PHONE_NUMBER_ID`| Meta Phone Number ID | `1029384756` |
| `WHATSAPP_VERIFY_TOKEN` | Inbound webhook verification token | `custom-verify-token` |
| `WHATSAPP_APP_SECRET` | Meta App Secret for signature verification | `abc12345...` |
| `VERCEL_TOKEN` | Vercel Personal/Team Token (Custom Domains) | `vercel_tok_...` |
| `VERCEL_PROJECT_ID` | Vercel Project ID | `prj_...` |
| `VERCEL_TEAM_ID` | Vercel Team ID (if using team account) | `team_...` |

### 3. Vercel Cron & GitHub Actions Queue Scheduler

Vercel Hobby (free) accounts enforce a limit of **once-daily cron executions**. Attempting to deploy with more frequent schedules (`* * * * *`) results in a deployment rejection.

To provide frequent 5-minute queue processing at zero cost:
1. **Daily Safety Net (`vercel.json`):**
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "crons": [
       {
         "path": "/api/cron/tick",
         "schedule": "0 3 * * *"
       }
     ]
   }
   ```
   Runs once daily at 03:00 UTC as an automated safety net.

2. **Free 5-Minute Queue Processing via GitHub Actions (`.github/workflows/tick.yml`):**
   A GitHub Action workflow runs every 5 minutes (`*/5 * * * *`) and on manual `workflow_dispatch`. It securely invokes `/api/cron/tick` with:
   ```bash
   curl --fail --silent --show-error \
     -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
     "${{ secrets.APP_URL }}/api/cron/tick"
   ```

   **Required GitHub Repository Secrets** (add in GitHub **Settings > Secrets and variables > Actions**):
   - `APP_URL`: Your deployed Vercel application URL (e.g. `https://wedding-system.vercel.app`).
   - `CRON_SECRET`: The exact secret token matching `CRON_SECRET` in your Vercel Environment Variables.

3. **Concurrency & Overlap Protection:**
   Whether triggered by the daily Vercel cron, the 5-minute GitHub Action, or manual administrative requests, the queue processor uses PostgreSQL atomic CTEs with `FOR UPDATE SKIP LOCKED`. If runs overlap, jobs are claimed by exactly one process, guaranteeing zero double-sends.

---

## WhatsApp Cloud API Configuration

### 1. Meta App Dashboard Setup
1. In the [Meta for Developers](https://developers.facebook.com/) portal, create a **Business App**.
2. Add the **WhatsApp** product to your app.
3. Generate a permanent System User Token with permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Note down your **Phone Number ID** and **WABA ID**.

### 2. Configure Inbound Webhooks
1. In Meta Dashboard, navigate to **WhatsApp > Configuration > Edit Webhook**.
2. **Callback URL:** `https://your-platform-domain.com/api/webhooks/whatsapp`
3. **Verify Token:** Match the string configured in `WHATSAPP_VERIFY_TOKEN`.
4. Subscribe to the `messages` webhook field.
5. Inbound status updates (`sent`, `delivered`, `read`, `failed`) and inbound opt-out keywords (`STOP`, `START`) will now process with HMAC SHA-256 validation.

---

## Onboarding a New Couple: Step-by-Step

1. **Create Wedding Tenant:**
   - In Admin Console, switch weddings or navigate to `/admin/weddings`.
   - Click **Create Wedding**, enter couple names, wedding date, city, and URL slug (e.g. `rohan-ananya`).
2. **Configure Events & Access Levels:**
   - Navigate to `/admin/events`.
   - Click **Start from Template** to generate standard Indian wedding events (Haldi, Mehendi, Sangeet, Wedding, Reception) and access tiers (All Events, Sangeet & Reception, VIP).
   - Customize event dates, times, venues, and Google Maps location URLs.
3. **Import Guests:**
   - Navigate to `/admin/guests`.
   - Upload an Excel or CSV file. Map columns (`Name`, `Phone`, `Pax`, `Group`, `City`, `Access Level`).
   - Phone numbers are automatically normalised to E.164 (defaulting to `+91` if missing).
4. **Assign Senders (For Manual Mode):**
   - Navigate to `/admin/senders`.
   - Add family senders (e.g. "Uncle Rajesh", "Groom Father").
   - Click **Auto-split Guests** to evenly distribute guests or assign by group/family.
   - Share each sender's unique PIN-protected portal link (`/s/[token]`).
5. **Configure WhatsApp Templates or Switch to Manual Mode:**
   - In `/admin/settings`, choose the sending method:
     - **Cloud API:** Set up Meta template name and language.
     - **Manual Links:** Zero cost; senders tap `wa.me` links directly.
6. **Send Invitations:**
   - Navigate to `/admin/invitations`.
   - Review guests by access tier or filter.
   - Click **Send Invitations** to queue batch dispatch with live progress updates.
7. **Connect Custom Domain (Optional):**
   - In `/admin/settings > Custom Domains`, enter couple's domain (e.g. `rohanandananya.com`).
   - Point couple's DNS CNAME to `cname.vercel-dns.com`.
   - Click **Verify DNS** to activate.

---

## Security & Privacy Checklist

- [x] **No Hardcoded Colors:** UI 100% tokenized using Inter typography and `#111111` monochromatic styling.
- [x] **Host Isolation:** Public guest custom domains cannot access administrative routes or login (`404 Not Found`).
- [x] **Signed Sessions:** `iron-session` using AES-256 encrypted httpOnly cookies with `SameSite=Lax`.
- [x] **Password Protection:** PBKDF2 with 100,000 SHA-512 iterations and unique cryptographic salts.
- [x] **Webhook Verification:** Inbound requests verified against Meta `X-Hub-Signature-256` HMAC.
- [x] **Rate Limiting:** Brute-force protection on code entry (`/w/[slug]`) and admin authentication.
- [x] **Guest Privacy:** Public invite pages (`/i/[token]`) disallow search engine crawlers with `robots: noindex`.
- [x] **Atomic Queue Processing:** `SKIP LOCKED` prevents race conditions or duplicate sends across concurrent workers.

---

## Running Automated Tests

Run the full Vitest test suite covering all 12 build phases:

```bash
# Run all unit and integration tests
npx vitest run

# Run specific test suites
npx vitest run tests/wedding-isolation.test.ts
npx vitest run tests/whatsapp-cloud-api.test.ts
npx vitest run tests/domains.test.ts

# TypeScript compilation check
npx tsc --noEmit

# ESLint check
npm run lint
```

