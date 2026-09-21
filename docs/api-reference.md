# Kudos Wall — tRPC API Reference

This document provides a comprehensive specification of the **tRPC API surface** (`AppRouter`) used by the Kudos Wall application.

All procedures are accessible at the base endpoint:
```http
POST /api/trpc/:procedureName
GET  /api/trpc/:procedureName?batch=1&input=:encodedJson
```
Requests typically use the standard tRPC batch link client with `superjson` transformation and `credentials: "include"`.

---

## Authentication & Authorization Model

Kudos Wall enforces three procedure access tiers:

1. **`publicProcedure`**: Accessible without credentials. Contextually detects `ctx.user` via `Authorization: Bearer <accessToken>` header or HTTP-only `kudos_refresh_token` cookie. If authenticated, returns real user data; if unauthenticated, returns demo/guest fallback data or processes public auth actions.
2. **`protectedProcedure`**: Requires a valid, active user session. Throws `TRPCClientError` (`UNAUTHORIZED`, HTTP 401) if no authenticated user is resolved.
3. **`adminProcedure`**: Requires an authenticated user with `role === "admin"`. Throws `TRPCClientError` (`FORBIDDEN`, HTTP 403) for standard users.

---

## 1. Authentication Router (`auth`)

| Procedure | Type | Access | Summary |
|---|---|---|---|
| [`auth.me`](#authme) | Query | Public / Optional Session | Retrieves the currently authenticated user profile. |
| [`auth.signup`](#authsignup) | Mutation | Public | Registers a new account with email verification simulation. |
| [`auth.signin`](#authsignin) | Mutation | Public | Authenticates with email and password, issuing access JWT and refresh cookie. |
| [`auth.refresh`](#authrefresh) | Mutation | Public (Cookie required) | Rotates refresh token and issues a new 15-minute access token. |
| [`auth.logout`](#authlogout) | Mutation | Public | Revokes refresh token in database and clears session cookies. |
| [`auth.verifyEmail`](#authverifyemail) | Mutation | Public | Verifies email address using the simulation token. |
| [`auth.forgotPassword`](#authforgotpassword) | Mutation | Public | Dispatches a password reset simulation link to console & dev log. |
| [`auth.resetPassword`](#authresetpassword) | Mutation | Public | Resets user password using a valid reset token and revokes sessions. |

### `auth.me`
- **Description**: Returns the sanitized user profile for the active session, or `null` if unauthenticated.
- **Input**: None (`void`)
- **Output**:
  ```ts
  type PublicUser = {
    id: string;
    name: string | null;
    email: string | null;
    role: "user" | "admin";
    department: "Engineering" | "Design" | "Marketing" | "Sales";
    avatar: string | null;
    givingAllowance: number;
    earnedPoints: number;
    emailVerified: boolean;
    lastSignedIn: Date;
    createdAt: Date;
  } | null;
  ```

### `auth.signup`
- **Description**: Creates a new user record with scrypt-hashed password. Generates an email verification token, logs simulation link to `docs/dev-emails.log` and console, and sets the HTTP-only refresh cookie.
- **Input**:
  ```ts
  {
    name: string; // min 2, max 80 chars
    email: string; // valid email format, max 320 chars
    password: string; // min 8, max 128 chars, alphanumeric complexity
    department?: "Engineering" | "Design" | "Marketing" | "Sales"; // default "Engineering"
  }
  ```
- **Output**:
  ```ts
  {
    user: PublicUser;
    accessToken: string; // 15-minute signed JWT
    expiresIn: number;   // 900 seconds
  }
  ```

### `auth.signin`
- **Description**: Validates work email and password via timing-safe scrypt comparison. Updates `lastSignedIn` and returns JWT session.
- **Input**:
  ```ts
  {
    email: string;
    password: string;
  }
  ```
- **Output**:
  ```ts
  {
    user: PublicUser;
    accessToken: string;
    expiresIn: number;
  }
  ```

### `auth.refresh`
- **Description**: Consumes the `kudos_refresh_token` HTTP-only cookie, rotates the token in MongoDB, and issues a fresh 15-minute access token.
- **Input**: None (`void`)
- **Output**:
  ```ts
  {
    user: PublicUser;
    accessToken: string;
    expiresIn: number;
  }
  ```

### `auth.logout`
- **Description**: Revokes stored refresh token in MongoDB and clears the HTTP-only refresh cookie.
- **Input**: None (`void`)
- **Output**:
  ```ts
  { success: true }
  ```

### `auth.verifyEmail`
- **Description**: Validates an email verification token generated during signup. Sets `emailVerified: true` on the user doc and clears the one-time token.
- **Input**:
  ```ts
  {
    token: string; // 64-char hex token
  }
  ```
- **Output**:
  ```ts
  {
    success: true;
    email: string;
    name: string | null;
  }
  ```

### `auth.forgotPassword`
- **Description**: Generates a 1-hour secure password reset token, writes simulated dispatch link to `docs/dev-emails.log` and stdout. Returns generic success message to prevent user enumeration.
- **Input**:
  ```ts
  {
    email: string;
  }
  ```
- **Output**:
  ```ts
  {
    success: true;
    message: string;
  }
  ```

### `auth.resetPassword`
- **Description**: Consumes password reset token, verifies validity, hashes new password with scrypt, clears reset token, and revokes all active refresh tokens to force re-login across devices.
- **Input**:
  ```ts
  {
    token: string;
    newPassword: string; // min 8, max 128 chars, alphanumeric
  }
  ```
- **Output**:
  ```ts
  {
    success: true;
    message: string;
  }
  ```

---

## 2. Kudos Router (`kudos`)

| Procedure | Type | Access | Summary |
|---|---|---|---|
| [`kudos.overview`](#kudosoverview) | Query | Public / Contextual | Returns giving allowance balance and kudos count for logged-in user or mock demo values for guests. |
| [`kudos.feed`](#kudosfeed) | Query | Public / Contextual | Paginated timeline of public recognition cards with real-time reactions and user search. |
| [`kudos.searchUsers`](#kudossearchusers) | Query | Public / Contextual | Autocomplete search for teammates by name/email (excluding self). |
| [`kudos.give`](#kudosgive) | Mutation | Protected | Sends recognition points, value tags, and note atomically from sender to recipient. |
| [`kudos.react`](#kudosreact) | Mutation | Protected | Toggles or adds emoji reaction (thumbs, party, fire) to a kudos card. |

### `kudos.overview`
- **Input**: None (`void`)
- **Output**:
  ```ts
  {
    allowance: number; // Points remaining to give this cycle (max 100)
    received: number;  // Total kudos count received
    sent: number;      // Total kudos count given
  }
  ```

### `kudos.feed`
- **Input**:
  ```ts
  {
    limit?: number;   // 1 to 30, default 10
    cursor?: string;  // Cursor ID for infinite scrolling
    search?: string;  // Case-insensitive filter over message and teammate names
  }
  ```
- **Output**:
  ```ts
  {
    rows: Array<{
      id: string;
      senderId: string;
      recipientId: string;
      points: number;
      message: string;
      tags: string[];
      reactions: {
        thumbs: number;
        party: number;
        fire: number;
      };
      sender: {
        id: string;
        name: string;
        avatar: string | null;
        department: string;
      };
      recipient: {
        id: string;
        name: string;
        avatar: string | null;
        department: string;
      };
      createdAt: Date;
    }>;
    nextCursor?: string;
  }
  ```

### `kudos.searchUsers`
- **Input**:
  ```ts
  {
    query?: string;     // Search term (default "")
    excludeId?: string; // Current user ID to prevent self-selection
  }
  ```
- **Output**:
  ```ts
  Array<{
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department: string;
  }>
  ```

### `kudos.give`
- **Input**:
  ```ts
  {
    recipientId: string;
    points: 10 | 20 | 50;
    message: string; // 8 to 280 characters
    tags: Array<"#Teamwork" | "#CustomerObsession" | "#Innovation">; // 1 to 3 tags
  }
  ```
- **Output**:
  ```ts
  {
    id: string;
    senderId: string;
    recipientId: string;
    points: number;
    message: string;
    valueTags: string[];
    senderName: string;
    recipientName: string;
    createdAt: Date;
  }
  ```

### `kudos.react`
- **Input**:
  ```ts
  {
    kudosId: string;
    reaction: "thumbs" | "party" | "fire";
  }
  ```
- **Output**:
  ```ts
  {
    id: string;
    reactions: Record<string, number>;
  }
  ```

---

## 3. Leaderboard Router (`leaderboard`)

| Procedure | Type | Access | Summary |
|---|---|---|---|
| [`leaderboard.list`](#leaderboardlist) | Query | Public / Contextual | Ranks teammates by total earned points, with optional department filter. |

### `leaderboard.list`
- **Input**:
  ```ts
  {
    department?: "Engineering" | "Design" | "Marketing" | "Sales";
  }
  ```
- **Output**:
  ```ts
  Array<{
    id: string;
    name: string;
    avatar: string | null;
    department: "Engineering" | "Design" | "Marketing" | "Sales";
    earnedPoints: number;
  }>
  ```

---

## 4. Profile Router (`profile`)

| Procedure | Type | Access | Summary |
|---|---|---|---|
| [`profile.me`](#profileme) | Query | Protected | Full profile view for the logged-in user including computed badges. |
| [`profile.update`](#profileupdate) | Mutation | Protected | Updates teammate profile details (name, email, department). |
| [`profile.changePassword`](#profilechangepassword) | Mutation | Protected | Updates password after verifying current password. |

### `profile.me`
- **Input**: None (`void`)
- **Output**:
  ```ts
  {
    person: PublicUser;
    stats: {
      sent: number;
      received: number;
      badges: string[]; // e.g. ["First High-Five", "Generous Teammate", "Rising Star", "Culture Carrier"]
    };
    allowance: number;
    earnedPoints: number;
  }
  ```

### `profile.update`
- **Input**:
  ```ts
  {
    name: string;       // 2 to 80 characters
    email: string;      // valid unique email format
    department: "Engineering" | "Design" | "Marketing" | "Sales";
  }
  ```
- **Output**: `PublicUser`

### `profile.changePassword`
- **Input**:
  ```ts
  {
    currentPassword: string;
    newPassword: string; // 8 to 128 characters, alphanumeric
  }
  ```
- **Output**:
  ```ts
  { success: true }
  ```

---

## 5. Admin Router (`admin`)

| Procedure | Type | Access | Summary |
|---|---|---|---|
| [`admin.resetAllowances`](#adminresetallowances) | Mutation | Admin Only | Administrative task: resets giving allowance of all users back to 100 pts. |

### `admin.resetAllowances`
- **Input**: None (`void`)
- **Output**:
  ```ts
  {
    updated: number; // Count of modified user records
  }
  ```
