# WearOn - Data Models

## Database: Supabase (PostgreSQL)

Migrations are in `supabase/migrations/`.

---

## Tables

### users

Extends Supabase `auth.users` with profile data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK(auth.users) | User ID |
| email | TEXT | NOT NULL | Email address |
| display_name | TEXT | - | Display name |
| avatar_url | TEXT | - | Profile picture URL |
| gender | TEXT | CHECK(male/female/other) | User gender |
| age | INTEGER | CHECK(13-120) | User age |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### user_credits

Credit balance tracking per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Record ID |
| user_id | UUID | FK(users), UNIQUE | User reference |
| balance | INTEGER | DEFAULT 10, NOT NULL | Current balance |
| total_earned | INTEGER | DEFAULT 10 | Lifetime earned |
| total_spent | INTEGER | DEFAULT 0 | Lifetime spent |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### credit_transactions

Audit log for all credit operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Transaction ID |
| user_id | UUID | FK(users), NOT NULL | User reference |
| amount | INTEGER | NOT NULL | +/- amount |
| type | TEXT | CHECK(signup_bonus/generation/refund) | Transaction type |
| description | TEXT | - | Human-readable description |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Timestamp |

### generation_sessions

Virtual try-on generation history and status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Session ID |
| user_id | UUID | FK(users), NOT NULL | User reference |
| status | TEXT | CHECK(pending/processing/completed/failed) | Current status |
| model_image_url | TEXT | NOT NULL | Person photo URL |
| outfit_image_url | TEXT | - | Clothing photo URL |
| accessories | JSONB | DEFAULT '[]' | Array of {type, url} |
| stitched_image_url | TEXT | - | Composite image (if used) |
| prompt_system | TEXT | NOT NULL | AI system prompt |
| prompt_user | TEXT | - | User custom prompt |
| generated_image_url | TEXT | - | Result image URL |
| credits_used | INTEGER | DEFAULT 1 | Credits consumed |
| error_message | TEXT | - | Error details if failed |
| processing_time_ms | INTEGER | - | Processing duration |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Request time |
| completed_at | TIMESTAMPTZ | - | Completion time |

### analytics_events

Platform usage and event tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Event ID |
| event_type | TEXT | NOT NULL | Event name |
| user_id | UUID | FK(users) | User (nullable) |
| metadata | JSONB | DEFAULT '{}' | Event data |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Timestamp |

### roles (RBAC)

Available system roles.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Role ID |
| name | TEXT | Role name (user/moderator/admin) |

### permissions (RBAC)

Available permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Permission ID |
| name | TEXT | Permission (e.g., users:read) |

### role_permissions (RBAC)

Role-to-permission mapping.

| Column | Type | Description |
|--------|------|-------------|
| role_id | UUID | FK(roles) |
| permission_id | UUID | FK(permissions) |

### user_roles (RBAC)

User-to-role assignment.

| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | FK(users) |
| role_id | UUID | FK(roles) |

---

## Database Functions

### handle_new_user()
**Trigger:** After INSERT on `auth.users`

Creates user profile, grants 10 free credits, logs signup bonus transaction.

### deduct_credits(user_id, amount, description)
Atomically deducts credits with row-level locking. Returns FALSE if insufficient.

### refund_credits(user_id, amount, description)
Adds credits back to user balance (e.g., on failed generation).

### user_has_permission(user_id, permission_name)
Checks if user has specific permission via RBAC.

### user_has_role(user_id, role_name)
Checks if user has specific role.

---

## Indexes

| Table | Index | Columns |
|-------|-------|---------|
| generation_sessions | idx_..._user_id | user_id |
| generation_sessions | idx_..._created_at | created_at DESC |
| generation_sessions | idx_..._status | status |
| credit_transactions | idx_..._user_id | user_id |
| credit_transactions | idx_..._created_at | created_at DESC |
| analytics_events | idx_..._type_created | event_type, created_at |

---

## Realtime

Enabled on `generation_sessions` table for live status updates.

---

*Generated: 2026-02-01 | WearOn Data Models*
