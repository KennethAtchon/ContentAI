# Authentication Journeys

Covers: Sign Up, Sign In, Sign Out, Auth Guards, and role-based access.

---

## 1. Sign Up (New User Registration)

**Entry:** `/sign-up` or "Get Started" / "Start Free Trial" CTAs on `/` and `/pricing`

**What the user sees:**
- Card with four fields: Full Name, Email Address, Password (min 6 chars, show/hide toggle), Confirm Password
- Trust indicators: "14-day free trial" and "No credit card required"
- "Continue with Google" OAuth button
- Link to `/sign-in` for existing users

**What the user can do:**
- Register with email/password
- Register with Google OAuth

**Steps (email/password):**
1. Fill out the form
2. Frontend validates: passwords match, min length met
3. Firebase `signUp(email, password, name)` called
4. On success → `smartRedirect({ isNewUser: true })` → `/pricing`

**Steps (Google OAuth):**
1. Click "Continue with Google"
2. Firebase `signInWithGoogle()` called
3. On success → `smartRedirect({ isNewUser: true })` → `/pricing`

**Backend side-effect:**
- First authenticated API call triggers `authMiddleware` which upserts the user into PostgreSQL (`users` table) with `role: "user"`

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant FB as Firebase Auth
    participant BE as Backend (Hono)
    participant DB as PostgreSQL

    U->>FE: Fill sign-up form / click Google
    FE->>FB: signUp(email, password, name) OR signInWithGoogle()
    FB-->>FE: Firebase token + user object
    FE->>FE: smartRedirect(isNewUser=true) → /pricing
    Note over FE,BE: First API call later...
    FE->>BE: Any authenticated request (with Firebase ID token)
    BE->>FB: Verify ID token
    FB-->>BE: Decoded token (uid, email, name)
    BE->>DB: INSERT INTO users ... ON CONFLICT DO UPDATE
    DB-->>BE: User row
    BE-->>FE: Response
```

---

## 2. Sign In (Returning User)

**Entry:** `/sign-in` or redirected from any auth-guarded route

**What the user sees:**
- Email and Password fields
- "Continue with Google" button
- Link to `/sign-up`
- Inline error messages for wrong credentials

**Steps:**
1. Enter credentials (or click Google)
2. Firebase `signIn(email, password)` or `signInWithGoogle()` called
3. On success → `smartRedirect({ isNewUser: false })`
   - If `redirect_url` query param exists → navigate to that URL
   - Otherwise → `/studio/discover`

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant FB as Firebase Auth

    U->>FE: Enter credentials
    FE->>FB: signIn(email, password)
    alt Success
        FB-->>FE: Firebase session
        FE->>FE: Check redirect_url param
        alt redirect_url exists
            FE->>FE: Navigate to redirect_url
        else
            FE->>FE: Navigate to /studio/discover
        end
    else Error
        FB-->>FE: AuthError code
        FE->>FE: getAuthErrorMessage(code) → show inline error
    end
```

---

## 3. Sign Out

**Entry:** User avatar dropdown in any authenticated page header, or Account sidebar

**Steps:**
1. Click avatar → dropdown → "Sign Out"
2. `logout()` from `useApp()` context calls Firebase `signOut()`
3. Firebase auth state clears
4. React Query cache becomes stale
5. User redirected to `/sign-in`

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant FB as Firebase Auth
    participant RQ as React Query Cache

    U->>FE: Click avatar → Sign Out
    FE->>FB: signOut()
    FB-->>FE: Auth state cleared
    FE->>RQ: Cache invalidated (auth-dependent queries stale)
    FE->>FE: Navigate to /sign-in
```

---

## 4. Auth Guard Behavior

The `AuthGuard` component wraps all protected routes.

| Guard Type | Requires | Redirect When Failed |
|---|---|---|
| `authType="user"` | Any authenticated user | `/sign-in?redirect_url=<original>` |
| `authType="admin"` | `role: "admin"` in user profile | `/` (home) |

**Flow for unauthenticated access to a protected route:**

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (AuthGuard)
    participant FB as Firebase Auth

    U->>FE: Navigate to /studio/generate
    FE->>FB: Check auth state
    FB-->>FE: No active session
    FE->>FE: Store /studio/generate as redirect_url
    FE->>FE: Navigate to /sign-in?redirect_url=/studio/generate
    U->>FE: Sign in successfully
    FE->>FE: Read redirect_url → navigate to /studio/generate
```

---

## 5. Admin Role Elevation

**Entry:** `/admin/verify`

**What the user sees:**
- A single input for a secret admin code
- Submit button

**Steps:**
1. Enter secret code
2. `POST /api/admin/verify` — backend hashes input and compares to `ADMIN_SPECIAL_CODE_HASH`
3. On match: PostgreSQL `users.role` updated to `"admin"`, Firebase custom claims updated
4. User re-authenticates (or refreshes token) to pick up new role
5. Can now access all `/admin/*` routes

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant FB as Firebase Admin

    U->>FE: Enter secret admin code
    FE->>BE: POST /api/admin/verify { code }
    BE->>BE: hash(code) == ADMIN_SPECIAL_CODE_HASH?
    alt Match
        BE->>DB: UPDATE users SET role='admin' WHERE uid=...
        BE->>FB: setCustomUserClaims(uid, { role: 'admin' })
        BE-->>FE: { success: true }
        FE->>FE: Show success, prompt re-auth
    else No match
        BE-->>FE: 401 Unauthorized
        FE->>FE: Show error message
    end
```
