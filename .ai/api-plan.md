# REST API Plan

## 1. Resources

- **Auth (Supabase Auth)** (no direct table)
  - Purpose: registration, login, logout, and obtaining the current user identity.
- **Goals** → `public.goals`
  - Purpose: store goal definition, lifecycle status, reflection notes, AI summary, abandonment reason, and iteration linkage.
- **Goal Progress Entries** → `public.goal_progress`
  - Purpose: store numeric progress entries (and optional notes) for a goal.
- **Goal History (derived resource)** → `public.goals` via `parent_goal_id`
  - Purpose: fetch the iteration chain (previous attempts) for a goal.
- **AI Summary (action on a Goal)** → stored in `public.goals.ai_summary`
  - Purpose: synchronous generation (and later editing) of summaries after completion.

## 2. Endpoints

### Conventions

- **Base path**: `/api`
- **Content type**: `application/json`
- **Auth**: `Authorization: Bearer <access_token>` (Supabase JWT)
- **Envelope** (recommended):
  - Success: `{ "data": <payload> }`
  - Error: `{ "error": { "code": "...", "message": "...", "details"?: any } }`
- **Pagination (offset)**:
  - Query: `page` (1+), `pageSize` (1–100)
  - Response metadata: `{"data": {"items": [...], "page": 1, "pageSize": 20, "total": 123 }}`
- **Decimal fields** (`target_value`, `value`): represent as **string** in JSON to avoid floating point issues.

---

### 2.1 Auth (Supabase)

> Note: Supabase Auth can be used directly from the client. These endpoints are optional “API façade” endpoints if you want all auth traffic to go through your Astro API. If you use direct Supabase Auth client-side, you can omit these endpoints.

#### POST `/api/auth/register`
- **Description**: Register a new user.
- **Request JSON**:
  ```json
  { "email": "user@example.com", "password": "min8chars" }
  ```
- **Response JSON (201)**:
  ```json
  { "data": { "user": { "id": "uuid", "email": "user@example.com" } } }
  ```
- **Errors**:
  - `400` invalid payload
  - `409` email already in use
  - `429` rate limited

#### POST `/api/auth/login`
- **Description**: Login using email + password.
- **Request JSON**:
  ```json
  { "email": "user@example.com", "password": "..." }
  ```
- **Response JSON (200)**:
  ```json
  { "data": { "access_token": "...", "refresh_token": "...", "user": { "id": "uuid", "email": "user@example.com" } } }
  ```
- **Errors**:
  - `400` invalid payload
  - `401` invalid credentials
  - `429` rate limited

#### POST `/api/auth/logout`
- **Description**: Invalidate the session (client should discard tokens).
- **Request**: none
- **Response (204)**: no body
- **Errors**:
  - `401` not authenticated

#### GET `/api/auth/me`
- **Description**: Return current authenticated user identity.
- **Response JSON (200)**:
  ```json
  { "data": { "user": { "id": "uuid", "email": "user@example.com" } } }
  ```
- **Errors**:
  - `401` not authenticated

---

### 2.2 Goals

#### GET `/api/goals`
- **Description**: List user’s goals.
- **Query params**:
  - `status`: `active | completed_success | completed_failure | abandoned`
  - `q`: search by name (case-insensitive substring)
  - `parentGoalId`: filter by `parent_goal_id` (for fetching iterations)
  - `root`: if `true`, only return “root goals” (goals with `parent_goal_id` = null)
  - `sort`: `created_at` (default), `deadline`
  - `order`: `asc | desc` (default `desc`)
  - `page`, `pageSize`
- **Response JSON (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "uuid",
          "parent_goal_id": "uuid|null",
          "name": "Run 100 km",
          "target_value": "100",
          "deadline": "2026-01-31",
          "status": "active",
          "reflection_notes": "...",
          "ai_summary": null,
          "abandonment_reason": null,
          "created_at": "2025-12-20T12:00:00Z",
          "updated_at": "2025-12-20T12:00:00Z",
          "computed": {
            "current_value": "45",
            "progress_ratio": 0.45,
            "progress_percent": 45,
            "is_locked": true,
            "days_remaining": 12
          }
        }
      ],
      "page": 1,
      "pageSize": 20,
      "total": 1
    }
  }
  ```
- **Success codes**: `200`
- **Errors**:
  - `401` not authenticated
  - `400` invalid query params

#### POST `/api/goals`
- **Description**: Create a new goal (new iteration).
- **Request JSON**:
  ```json
  {
    "name": "Run 100 km",
    "target_value": "100",
    "deadline": "2026-01-31",
    "parent_goal_id": null
  }
  ```
- **Response JSON (201)**:
  ```json
  { "data": { "goal": { "id": "uuid", "status": "active", "name": "Run 100 km", "target_value": "100", "deadline": "2026-01-31" } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `422` validation error (e.g., `target_value` <= 0, deadline not in the future)

#### GET `/api/goals/:goalId`
- **Description**: Get goal details, including computed progress and progress entries summary.
- **Response JSON (200)**:
  ```json
  {
    "data": {
      "goal": {
        "id": "uuid",
        "parent_goal_id": "uuid|null",
        "name": "Run 100 km",
        "target_value": "100",
        "deadline": "2026-01-31",
        "status": "active",
        "reflection_notes": "...",
        "ai_summary": null,
        "abandonment_reason": null,
        "created_at": "...",
        "updated_at": "...",
        "computed": {
          "current_value": "45",
          "progress_ratio": 0.45,
          "progress_percent": 45,
          "is_locked": true,
          "days_remaining": 12,
          "entries_count": 4
        }
      }
    }
  }
  ```
- **Success codes**: `200`
- **Errors**:
  - `401` not authenticated
  - `404` not found (or not owned by user under RLS)

#### PATCH `/api/goals/:goalId`
- **Description**: Update mutable parts of a goal.
- **Request JSON** (allowed fields depend on business rules):
  ```json
  {
    "name": "Run 120 km",
    "target_value": "120",
    "deadline": "2026-02-15",
    "reflection_notes": "New reflections...",
    "ai_summary": "Edited summary..."
  }
  ```
- **Response JSON (200)**:
  ```json
  { "data": { "goal": { "id": "uuid", "updated_at": "..." } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` conflict (immutable fields locked after first progress)
  - `422` validation error

#### DELETE `/api/goals/:goalId`
- **Description**: Delete a goal.
- **Recommendation**: For MVP, allow deletion only when there are no progress entries yet; otherwise return `409`.
- **Response (204)**: no body
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` cannot delete goal with progress entries (recommended)

---

### 2.3 Goal Progress Entries

#### GET `/api/goals/:goalId/progress`
- **Description**: List progress entries for a goal.
- **Query params**:
  - `sort`: `created_at` (default)
  - `order`: `asc | desc` (default `desc`)
  - `page`, `pageSize`
- **Response JSON (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "uuid",
          "goal_id": "uuid",
          "value": "10",
          "notes": "Felt good today",
          "created_at": "...",
          "updated_at": "..."
        }
      ],
      "page": 1,
      "pageSize": 20,
      "total": 3
    }
  }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` goal not found (or not owned)

#### POST `/api/goals/:goalId/progress`
- **Description**: Add a progress entry to an **active** goal.
- **Request JSON**:
  ```json
  { "value": "10", "notes": "Optional note" }
  ```
- **Response JSON (201)**:
  ```json
  {
    "data": {
      "progress": { "id": "uuid", "goal_id": "uuid", "value": "10", "notes": "Optional note" },
      "goal": { "id": "uuid", "status": "active" },
      "computed": { "current_value": "55", "progress_percent": 55 }
    }
  }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` goal not found
  - `409` goal is not active (cannot add progress)
  - `422` validation error (`value` must be > 0)

#### PATCH `/api/progress/:progressId`
- **Description**: Edit an existing progress entry **only if the goal is active**.
- **Request JSON**:
  ```json
  { "value": "12", "notes": "Updated note" }
  ```
- **Response JSON (200)**:
  ```json
  { "data": { "progress": { "id": "uuid", "value": "12", "notes": "Updated note" } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` goal is not active (cannot edit)
  - `422` validation error

#### DELETE `/api/progress/:progressId`
- **Description**: Delete a progress entry **only if the goal is active**.
- **Response (204)**: no body
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` goal is not active (cannot delete)

---

### 2.4 Goal Lifecycle Actions (Business Logic)

#### POST `/api/goals/sync-statuses`
- **Description**: Apply automatic status transitions for the current user’s goals.
  - If `current_value >= target_value` → `completed_success`
  - If now is after the goal deadline day at 23:59 (local policy) AND `current_value < target_value` → `completed_failure`
  - If status is `abandoned` → never auto-change
- **Idempotent**: repeated calls should not change results after already applied.
- **Request JSON** (optional):
  ```json
  { "goal_ids": ["uuid", "uuid"] }
  ```
- **Response JSON (200)**:
  ```json
  { "data": { "updated": [{ "id": "uuid", "from": "active", "to": "completed_failure" }] } }
  ```
- **Errors**:
  - `401` not authenticated
  - `400` invalid payload

#### POST `/api/goals/:goalId/abandon`
- **Description**: Manually abandon an active goal with a reason.
- **Request JSON**:
  ```json
  { "reason": "No time" }
  ```
- **Response JSON (200)**:
  ```json
  { "data": { "goal": { "id": "uuid", "status": "abandoned", "abandonment_reason": "No time" } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` goal not active
  - `422` validation error (reason required)

#### POST `/api/goals/:goalId/retry`
- **Description**: Create a new active goal as a retry of a failed/abandoned goal.
- **Request JSON**:
  ```json
  { "target_value": "70", "deadline": "2026-02-28" }
  ```
  - `name` is copied by default; client may optionally send a new name.
- **Response JSON (201)**:
  ```json
  { "data": { "goal": { "id": "new-uuid", "parent_goal_id": "old-uuid", "status": "active" } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` only allowed when status is `completed_failure` or `abandoned`
  - `422` validation error

#### POST `/api/goals/:goalId/continue`
- **Description**: Create a new active goal as a continuation after success (optionally using AI suggestion).
- **Request JSON**:
  ```json
  { "target_value": "120", "deadline": "2026-02-28", "name": "Run 120 km" }
  ```
- **Response JSON (201)**:
  ```json
  { "data": { "goal": { "id": "new-uuid", "parent_goal_id": "old-uuid", "status": "active" } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` only allowed when status is `completed_success`
  - `422` validation error

---

### 2.5 Goal History (Iterations)

#### GET `/api/goals/:goalId/history`
- **Description**: List all iterations in the same chain as `goalId`.
- **Query params**:
  - `sort`: `created_at` (default)
  - `order`: `asc | desc`
- **Response JSON (200)**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "uuid",
          "parent_goal_id": "uuid|null",
          "name": "Run 100 km",
          "status": "completed_failure",
          "deadline": "2026-01-31",
          "computed": { "current_value": "60" },
          "ai_summary": "..."
        }
      ]
    }
  }
  ```
- **Implementation note**: Use a recursive query (CTE) to find the root and all descendants via `parent_goal_id`.
- **Errors**:
  - `401` not authenticated
  - `404` not found

---

### 2.6 AI Summary

#### POST `/api/goals/:goalId/ai-summary/generate`
- **Description**: Synchronously generate an AI summary for a completed goal (success/failure) if it has at least 3 progress entries.
- **Request JSON** (optional overrides):
  ```json
  { "force": false }
  ```
- **Response JSON (200)**:
  ```json
  {
    "data": {
      "goal": { "id": "uuid", "ai_summary": "..." },
      "suggestions": {
        "next_goal": { "name": "Run 120 km", "target_value": "120", "deadline_hint_days": 30 }
      }
    }
  }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `409` invalid state (goal not completed, or abandoned)
  - `412` not enough data (less than 3 progress entries)
  - `429` rate limited
  - `502` AI provider error

#### PATCH `/api/goals/:goalId/ai-summary`
- **Description**: Edit the AI summary (or manually enter it after failures).
- **Request JSON**:
  ```json
  { "ai_summary": "My own summary..." }
  ```
- **Response JSON (200)**:
  ```json
  { "data": { "goal": { "id": "uuid", "ai_summary": "My own summary..." } } }
  ```
- **Errors**:
  - `401` not authenticated
  - `404` not found
  - `422` validation error

## 3. Authentication and Authorization

- **Primary mechanism**: Supabase Auth issues a JWT access token.
- **Client sends**: `Authorization: Bearer <access_token>` on every API call.
- **Server validation**:
  - Verify the JWT by calling Supabase auth (or by relying on Supabase PostgREST + RLS if directly querying through Supabase).
- **Authorization**:
  - Data access is enforced by **Row Level Security** in Postgres:
    - `public.goals`: only rows where `user_id = auth.uid()`
    - `public.goal_progress`: only rows that belong to a goal owned by `auth.uid()`
  - API must not accept `user_id` from client; it is derived from the authenticated user.

## 4. Validation and Business Logic

### 4.1 Validation rules (by resource)

#### Goals (`public.goals`)
- `name`
  - required on create
  - non-empty string, trimmed, max length recommended (e.g., 200)
- `target_value`
  - required on create
  - must be a decimal string representing a number `> 0` (matches DB check constraint)
- `deadline`
  - required on create
  - must be a valid date string `YYYY-MM-DD`
  - must be in the future on create (MVP requirement)
- `status`
  - enum: `active | completed_success | completed_failure | abandoned`
  - client cannot set arbitrary transitions; only allowed through lifecycle actions or auto-sync
- `reflection_notes`
  - optional, editable at any time
- `ai_summary`
  - optional, editable at any time; generation allowed only on completed success/failure
- `abandonment_reason`
  - required when abandoning

#### Goal progress (`public.goal_progress`)
- `goal_id`
  - derived from URL path on create
- `value`
  - required on create/update
  - must be a decimal string; recommended to enforce `> 0` in API (PRD semantics)
- `notes`
  - optional text

### 4.2 Business rules mapped to API behavior

- **F-02 Create goals**
  - Implemented via `POST /api/goals`.
- **F-03 Immutability after first progress entry**
  - API computes `is_locked = (entries_count >= 1)`.
  - If locked: reject updates to `name`, `target_value`, `deadline` with `409`.
- **F-04 / F-16 Progress tracking + edit restrictions**
  - `POST /api/goals/:goalId/progress` allowed only when goal status is `active`.
  - `PATCH /api/progress/:progressId` allowed only when goal status is `active`.
- **F-05 Reflection notes always editable**
  - `PATCH /api/goals/:goalId` always allows `reflection_notes` updates regardless of status.
- **F-06 Status set**
  - API uses the DB enum; status changes only through:
    - auto-sync (`POST /api/goals/sync-statuses`)
    - abandon (`POST /api/goals/:goalId/abandon`)
- **F-07 Automatic completion**
  - Implemented via `POST /api/goals/sync-statuses`.
  - Rule details:
    - success: `sum(progress.value) >= target_value`
    - failure: time is after deadline day 23:59 (policy-defined timezone) AND not success
    - abandoned goals are excluded from auto-failure
- **F-08 Manual abandon with reason**
  - Implemented via `POST /api/goals/:goalId/abandon`.
- **F-09 AI summary generation with retries**
  - Implemented via `POST /api/goals/:goalId/ai-summary/generate`.
  - Requires: goal status in `completed_success|completed_failure` AND entries_count >= 3.
  - Retries: the DB schema does not store attempt counts; for strict enforcement, add either:
    - `goals.ai_summary_attempts int not null default 0`, or
    - a separate table `goal_ai_summary_attempts`.
  - Until such persistence exists, retries can only be enforced per-session or best-effort.
- **F-10 / F-11 Suggestions**
  - Returned from `ai-summary/generate` response as a `suggestions.next_goal` object and/or embedded in `ai_summary` text.
- **F-12 Retry goal**
  - Implemented via `POST /api/goals/:goalId/retry`.
- **F-13 History of iterations**
  - Implemented via `GET /api/goals/:goalId/history` using `parent_goal_id` chain.
- **F-14 Progress visualization**
  - API provides computed fields in goal responses: `current_value`, `progress_percent`, `days_remaining`.
- **F-17 Confirm before saving progress**
  - This is primarily a UI requirement.
  - API supports it implicitly by making `POST /progress` a single, explicit action after user confirmation.

### 4.3 Performance and security considerations

- **RLS-first design**: rely on Postgres RLS as the primary authorization layer.
- **Rate limiting**:
  - Apply stricter rate limits to:
    - `/api/auth/*` (credential attacks)
    - `/api/goals/:goalId/ai-summary/generate` (cost control)
- **Input hardening**:
  - Zod validation in every endpoint.
  - Enforce max lengths for text fields (`name`, `notes`, `reflection_notes`, `ai_summary`, `abandonment_reason`).
- **Query efficiency**:
  - Use existing indexes:
    - `goals(user_id)` for listing
    - `goals(user_id, status)` for filtering by status
    - `goals(user_id, created_at desc)` for default sort
    - `goal_progress(goal_id)` for progress lookups
  - For computed sums, use a single aggregate query per goal (or batch aggregates for list endpoints).
- **Timezone policy** (deadline at 23:59):
  - Define a single timezone (e.g., user’s locale or application default) and apply consistently in `sync-statuses`.
