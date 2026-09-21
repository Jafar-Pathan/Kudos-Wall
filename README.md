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
| **UI Primitives** | Radix UI primitives + Lucide React | Accessible dialog, tabs, avatars, forms, buttons, and icons. |
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

## Authentication architecture

Kudos Wall supports two authentication methods with a unified session system:

### 1. Google OAuth 2.0 (OpenID Connect)
- **Start**: User clicks "Continue with Google" on `/auth`, directing to `GET /api/oauth/google`.
- **CSRF Protection**: The server generates a random nonce cookie (`__Host-oauth_state` or `oauth_state`) and encodes it in the `state` parameter.
- **Authorization**: User authorizes via Google (`accounts.google.com/o/oauth2/v2/auth`).
- **Callback**: Google redirects to `GET /api/oauth/callback`. The server verifies the CSRF nonce, exchanges the authorization code for tokens via Google's token endpoint (`oauth2.googleapis.com/token`), and fetches user info from `googleapis.com/oauth2/v2/userinfo`.
- **User Provisioning**: The user is upserted into MongoDB (`UserModel`) with `openId: google_<googleId>`, email, name, avatar, and default 100 points allowance.
- **Session**: Issues a 15-minute access JWT and sets the HTTP-only `kudos_refresh_token` cookie before redirecting to `/`. The frontend `useAuth` hook automatically restores the session.

### 2. Work Email & Password Credentials
- Sign up via `auth.signup` with email, name, password (min 8 chars, letters + numbers), and department.
- Passwords are hashed using Node.js's native memory-hard `scrypt` algorithm with unique 16-byte salts.
- Sign in via `auth.signin` verifies credentials and issues the token pair.
- Refresh rotation via `auth.refresh` revokes the old refresh token, validates against MongoDB, and issues a new pair.
- Sign out via `auth.logout` revokes the token in MongoDB and clears the cookie.

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

### HTTP & OAuth Endpoints
- `GET /api/oauth/google` — Initiates Google OAuth 2.0 authentication.
- `GET /api/oauth/callback` — Handles Google OAuth 2.0 authorization callback.
- `GET /api/oauth/login` — Alias for Google OAuth initiation.

### tRPC Procedures (`/api/trpc`)
- **Auth:**
  - `auth.me` — Returns current authenticated user profile.
  - `auth.signup` — Register with email/password.
  - `auth.signin` — Login with email/password.
  - `auth.refresh` — Rotate refresh token and get fresh access token.
  - `auth.logout` — Revoke refresh token and clear cookie.
- **Kudos:**
  - `kudos.feed` — Paginated social recognition feed with search and value tags.
  - `kudos.overview` — Points to give, received count, and team stats.
  - `kudos.give` — Send kudos with points, custom message, and company value tags.
  - `kudos.react` — React to recognition with thumbs, party, or fire emojis.
  - `kudos.searchUsers` — Autocomplete teammate search by name or email.
- **Leaderboard:**
  - `leaderboard.list` — Company and department recognition rankings.
- **Profile:**
  - `profile.update` — Update user name, email, and department.
  - `profile.changePassword` — Update password with verification of current password.
- **Admin:**
  - `admin.resetAllowances` — Monthly reset of giving allowances.
