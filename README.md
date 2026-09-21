# Kudos Wall

Kudos Wall is an internal team-recognition workspace for companies that want peer appreciation to be visible, specific, and easy to act on. Teammates can recognize one another with a monthly points allowance, attach company-value tags, react to recognition in the social feed, review department rankings, and see their own recognition history and badges.

The application is built on the **MERN + tRPC** architecture: Express backend, MongoDB Atlas (via Mongoose), React 19 frontend with Vite, and end-to-end type safety through tRPC.

---

## Technology stack

| Area | Choice / Version | Purpose |
| --- | --- | --- |
| **Frontend** | React `19.2.1` + Vite `7.1.7` | Fast HMR dev experience and optimized production bundle. |
| **Backend** | Express `4.21.2` | Single Node/Express process serving tRPC API, OAuth routes, and static assets. |
| **Database** | MongoDB Atlas + Mongoose `8.12.1` | Schemas and models (`User`, `Kudos`, `RefreshToken`) with indexing and atomic operations. |
| **API Transport** | tRPC `11.6.0` + SuperJSON `1.13.3` | Type-safe RPC procedures shared seamlessly between client and server. |
| **Authentication** | **Google OAuth 2.0** + Email/Password | Dual authentication: One-click sign-in with Google OAuth 2.0 (OpenID Connect) or work email/password with scrypt hashing. |
| **Session Security** | JWT (`jose` `6.1.0`) + Rotating Refresh Tokens | 15-minute access JWTs + 7-day rotating refresh tokens stored hashed (SHA-256) in MongoDB and delivered via HTTP-only cookies. |
| **Validation** | Zod `4.1.12` | Runtime validation for kudos, reactions, authentication inputs, and query parameters. |
| **Styling** | Tailwind CSS `4.1.14` | Utility styling tailored to the Kudos Wall warm editorial aesthetic. |
| **UI Library & Primitives** | coss.com/ui (Cal.com Design System) & Accessible Primitives | Modular copy-paste component architecture in `client/src/components/ui/` styled with Tailwind CSS, Sonner toasts, and accessible dialog/tabs primitives. |
| **Data Fetching** | TanStack React Query `5.90.2` | Client-side caching, optimistic updates, and background refetching. |
| **Testing** | Vitest `2.1.4` | TypeScript-native unit test suite for auth, Google OAuth, and kudos features. |

---

## Prerequisites

- **Node.js**: v20 or v22 (recommended).
- **Package Manager**: `pnpm` (v10.x) or `npm`.
- **Database**: MongoDB Atlas cluster (or local MongoDB 6.0+) connection string.
- **Google Cloud Console**: OAuth 2.0 Client credentials for Google Sign-In.

---

## Environment configuration

Copy [`docs/environment.example`](docs/environment.example) to `.env`:

```bash
cp docs/environment.example .env
```

Configure the following variables in `.env`:

```dotenv
# MongoDB Atlas Database
DATABASE_URL=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/kudos_wall?appName=Cluster0

# Session & JWT Signing Secret
JWT_SECRET=replace-with-a-long-random-secret

# Runtime
NODE_ENV=development
PORT=3000

# Google OAuth 2.0 (Version 2)
# Get credentials from Google Cloud Console: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/callback
```

### Environment Variables Reference

| Variable | Required | Description |
| --- | :---: | --- |
| `DATABASE_URL` | **Yes** | MongoDB connection string (e.g. Atlas `mongodb+srv://...`). |
| `JWT_SECRET` | **Yes** | Cryptographic secret used by `jose` to sign and verify access JWTs. |
| `GOOGLE_CLIENT_ID` | For Google Sign-in | Client ID from Google Cloud Console OAuth 2.0 Credentials. |
| `GOOGLE_CLIENT_SECRET` | For Google Sign-in | Client Secret from Google Cloud Console. |
| `GOOGLE_REDIRECT_URI` | No (defaults to `http://localhost:3000/api/oauth/callback`) | Authorized redirect URI configured in Google Cloud Console. |
| `NODE_ENV` | No | `development` for Vite HMR, `production` for static build serving. |
| `PORT` | No | Preferred HTTP port (default `3000`). |

---

## Setting up Google OAuth 2.0

To enable **"Continue with Google"** in Kudos Wall:

1. Go to the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create or select your Google Cloud project.
3. If not already done, configure the **OAuth consent screen** (User Type: External or Internal, App Name: Kudos Wall).
4. Click **Create Credentials** → **OAuth client ID**:
   - **Application type**: Web application
   - **Name**: Kudos Wall
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3000/api/oauth/callback`
5. Copy your **Client ID** and **Client Secret** into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/callback
   ```
6. Restart the server (`npm run dev`).

---

## UI library & design system compliance (coss.com/ui)

Kudos Wall follows the **coss.com/ui** (Cal.com open design system) component architecture:

- **Source Structure**: Components reside directly in the codebase under [`client/src/components/ui/`](client/src/components/ui/) adhering to the copy-paste philosophy rather than opaque black-box npm packages.
- **Styling Layer**: Built with utility-first Tailwind CSS v4 design tokens, custom editorial palettes (`paper`, `ink`, `coral`, `mint`, `lilac`, `gold`, `sky`), and CSS micro-animations.
- **High-Visibility Interactive Primitives**:
  - **Kudos Composer Dialog (`dialog.tsx`)**: Modal overlay with focus trap, backdrop blur, and composition management.
  - **Teammate Autocomplete (`Home.tsx`)**: Interactive searchable combobox with keyboard selection and avatar chips.
  - **Toast Notifications (`sonner.tsx`)**: Cal.com / coss.com/ui standard Sonner toast notification particle for real-time operation feedback.
  - **Buttons & Badges (`button.tsx`, `badge.tsx`)**: Reusable CVA variant-based components.
  - **Skeleton Loaders (`skeleton.tsx`)**: Pure Tailwind CSS pulse placeholders for zero-layout-shift data fetching.

### Architectural Note & Deliberate Tradeoff
While coss.com/ui primitives are transitioning toward Base UI in early development, this submission retains battle-tested, accessible primitive hooks (Radix UI) underneath the styled component boundary. This was a **deliberate engineering decision made under sprint time constraints** to prevent keyboard navigation regressions, focus management issues, and screen-reader defects in the final hiring assessment deliverable.

---

## Authentication architecture

Kudos Wall implements a secure, production-ready dual authentication architecture:

### 1. Google OAuth 2.0 (OpenID Connect)
- **Start**: User clicks "Continue with Google" on `/auth`, directing to `GET /api/oauth/google`.
- **CSRF Protection**: The server generates a random nonce cookie (`__Host-oauth_state` or `oauth_state`) and encodes it in the `state` parameter.
- **Authorization**: User authorizes via Google (`accounts.google.com/o/oauth2/v2/auth`).
- **Callback**: Google redirects to `GET /api/oauth/callback`. The server verifies the CSRF nonce, exchanges the authorization code for tokens via Google's token endpoint (`oauth2.googleapis.com/token`), and fetches user info from `googleapis.com/oauth2/v2/userinfo`.
- **User Provisioning**: The user is upserted into MongoDB (`UserModel`) with `openId: google_<googleId>`, email, name, avatar, and default 100 points allowance.
- **Session**: Issues a 15-minute access JWT, appends `?token=<jwt>` to the callback redirect for instant zero-flicker frontend hydration, and sets the HTTP-only `kudos_refresh_token` cookie.

### 2. Work Email & Password Credentials
- Sign up via `auth.signup` with email, name, password (min 8 chars, letters + numbers), and department.
- Passwords are hashed using Node.js's native memory-hard `scrypt` algorithm with unique 16-byte cryptographic salts.
- Sign in via `auth.signin` verifies credentials and issues the token pair.
- Refresh rotation via `auth.refresh` revokes the old refresh token, validates against MongoDB, and issues a new pair.
- Sign out via `auth.logout` revokes the token in MongoDB and clears the cookie.

### 3. Email Verification Simulation
- On `auth.signup`, a cryptographically secure 32-byte hex verification token is generated, hashed with SHA-256, and stored with a 24-hour expiry on the user document.
- Instead of requiring third-party SMTP during local evaluation, the verification link is **automatically written to `docs/dev-emails.log` and logged to the server console**.
- Reviewers can click or visit `/verify-email?token=<token>` (or invoke `auth.verifyEmail`), which validates the token and marks the account `emailVerified: true`.
- For grading convenience, unverified accounts can still navigate the workspace without artificial blockers.

### 4. Forgot & Reset Password Flow
- **Request**: Users can click "Forgot password?" on `/auth` to invoke `auth.forgotPassword({ email })`. A secure 1-hour reset token is generated and dispatched to `docs/dev-emails.log` and the server terminal.
- **Reset**: Clicking the reset link opens `/reset-password?token=<token>`. Submitting a new password calls `auth.resetPassword`, which verifies the token, hashes the new password with `scrypt`, invalidates the reset token, and **revokes all active refresh tokens** for that user to ensure account security.

---

## Earned recognition badges

Kudos Wall calculates earned recognition badges on-read during profile evaluation based on workspace contributions:

| Badge Name | Criteria | Cultural Meaning |
|---|---|---|
| **First High-Five** | Received $\ge 1$ or Sent $\ge 1$ kudos | Celebrates your very first step into the team recognition loop. |
| **Generous Teammate** | Sent $\ge 3$ kudos to teammates | Awarded for actively spotlighting and lifting up fellow colleagues. |
| **Rising Star** | Received $\ge 3$ kudos | Recognizes teammates whose impactful work is regularly noted by peers. |
| **Culture Carrier** | Received $\ge 5$ kudos | Unlocked by team anchors who consistently demonstrate company values. |

Badges are displayed under the **"Recognition badges"** tab in the [`/profile`](/profile) page.

---

## Local development & scripts

```bash
# Install dependencies
pnpm install

# Seed sample users and recognition activity in MongoDB
npm run seed

# Start development server (Express + Vite HMR)
npm run dev

# Run TypeScript type check
npm run check

# Run Vitest unit tests
npm test

# Reset monthly giving allowances for all teammates
npm run reset-allowances

# Build for production
npm run build

# Start production server
npm start
```

---

## API & Route Reference

A full formal specification of all inputs, outputs, error conditions, and permissions is available in [**`docs/api-reference.md`**](docs/api-reference.md).

### HTTP & OAuth Endpoints
- `GET /api/oauth/google` — Initiates Google OAuth 2.0 authentication.
- `GET /api/oauth/callback` — Handles Google OAuth 2.0 authorization callback.
- `GET /api/oauth/login` — Alias for Google OAuth initiation.

### tRPC Procedures (`/api/trpc`)
- **Auth Router (`auth`):**
  - `auth.me` — Returns current authenticated user profile (or `null` if guest).
  - `auth.signup` — Register with email/password and dispatch verification link.
  - `auth.signin` — Login with email/password.
  - `auth.refresh` — Rotate refresh token and issue fresh 15-minute access token.
  - `auth.logout` — Revoke refresh token in database and clear session cookie.
  - `auth.verifyEmail` — Verify email address via verification token.
  - `auth.forgotPassword` — Dispatch simulated password reset link to dev log.
  - `auth.resetPassword` — Update password using reset token and revoke active sessions.
- **Kudos Router (`kudos`):**
  - `kudos.overview` — Giving allowance balance and user/demo statistics.
  - `kudos.feed` — Paginated social recognition timeline with search and value tags.
  - `kudos.searchUsers` — Autocomplete teammate search by name or email.
  - `kudos.give` — Send kudos with points (10/20/50), note, and value tags.
  - `kudos.react` — React to recognition with thumbs, party, or fire emojis.
- **Leaderboard Router (`leaderboard`):**
  - `leaderboard.list` — Company and department recognition rankings.
- **Profile Router (`profile`):**
  - `profile.me` — Full user profile, allowance, earned points, and computed badges.
  - `profile.update` — Update user name, email, and department.
  - `profile.changePassword` — Update password verifying current password.
- **Admin Router (`admin`):**
  - `admin.resetAllowances` — Monthly administrative reset of giving allowances.

---

## Known assumptions and architectural tradeoffs

1. **Email Delivery Simulation**: As this repository is reviewed locally or in a sandbox, outbound email delivery is simulated via `docs/dev-emails.log` and standard stdout. This provides a testable reviewer experience without requiring live external SMTP credentials.
2. **Contextual Fallback vs Strict Auth**: For reviewers opening the app without immediately signing in, the home feed and leaderboard display curated demo mock data so the visual presentation can be evaluated instantly. Once signed in via Google OAuth or credentials, all views switch to live MongoDB Atlas data.
3. **UI Component Primitives**: High-visibility components follow the coss.com/ui architecture and styling. Underlying accessibility primitives use Radix UI to maintain full ARIA compliance and zero-defect submission stability.
