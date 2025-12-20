# Database Schema Plan for GoalTracker

This document outlines the PostgreSQL database schema for the GoalTracker MVP, based on the product requirements, technical stack, and planning session decisions.

## 1. Tables, Columns, and Constraints

### Custom Types

A custom `ENUM` type will be created to represent the possible statuses of a goal.

```sql
CREATE TYPE public.goal_status AS ENUM (
  'active',
  'completed_success',
  'completed_failure',
  'abandoned'
);
```

### `Users` Table

Will be managed by Supabase auth

### `goals` Table

The central table for storing goal definitions, progress, and outcomes.

-   `id`: `uuid`
    -   **Constraints**: `PRIMARY KEY`, `DEFAULT gen_random_uuid()`
    -   **Description**: The unique identifier for the goal.
-   `user_id`: `uuid`
    -   **Constraints**: `NOT NULL`, `REFERENCES profiles(id)`
    -   **Description**: The user who owns this goal.
-   `parent_goal_id`: `uuid`
    -   **Constraints**: `REFERENCES goals(id)`
    -   **Description**: Self-referencing key for goal iterations (history).
-   `name`: `text`
    -   **Constraints**: `NOT NULL`
    -   **Description**: The name of the goal.
-   `target_value`: `decimal`
    -   **Constraints**: `NOT NULL`, `CHECK (target_value > 0)`
    -   **Description**: The numerical target value for the goal.
-   `deadline`: `date`
    -   **Constraints**: `NOT NULL`
    -   **Description**: The date by which the goal should be completed.
-   `status`: `public.goal_status`
    -   **Constraints**: `NOT NULL`, `DEFAULT 'active'`
    -   **Description**: The current status of the goal.
-   `reflection_notes`: `text`
    -   **Description**: User's general, editable notes about the goal.
-   `ai_summary`: `text`
    -   **Description**: The AI-generated or manually entered summary after goal completion.
-   `abandonment_reason`: `text`
    -   **Description**: The reason for abandoning the goal.
-   `created_at`: `timestamptz`
    -   **Constraints**: `NOT NULL`, `DEFAULT now()`
    -   **Description**: Timestamp of when the goal was created.
-   `updated_at`: `timestamptz`
    -   **Constraints**: `NOT NULL`, `DEFAULT now()`
    -   **Description**: Timestamp of the last goal update.

### `goal_progress` Table

Stores individual progress entries for each goal.

-   `id`: `uuid`
    -   **Constraints**: `PRIMARY KEY`, `DEFAULT gen_random_uuid()`
    -   **Description**: The unique identifier for the progress entry.
-   `goal_id`: `uuid`
    -   **Constraints**: `NOT NULL`, `REFERENCES goals(id)`
    -   **Description**: The goal this progress entry belongs to.
-   `value`: `decimal`
    -   **Constraints**: `NOT NULL`
    -   **Description**: The numerical value of this progress entry.
-   `notes`: `text`
    -   **Description**: Optional notes for this specific entry.
-   `created_at`: `timestamptz`
    -   **Constraints**: `NOT NULL`, `DEFAULT now()`
    -   **Description**: Timestamp of when the entry was created.
-   `updated_at`: `timestamptz`
    -   **Constraints**: `NOT NULL`, `DEFAULT now()`
    -   **Description**: Timestamp of the last entry update.


## 2. Table Relationships

-   **`profiles` to `auth.users`**: One-to-One. Each user in `auth.users` has one corresponding entry in `profiles`.
-   **`profiles` to `goals`**: One-to-Many. A user can have many goals.
-   **`goals` to `goals`**: One-to-Many (Self-referencing). A goal can be a parent to many subsequent iterations (child goals).
-   **`goals` to `goal_progress`**: One-to-Many. A goal can have many progress entries.

## 3. Indexes

To optimize query performance, the following indexes will be created:

-   `CREATE INDEX ON public.goals (user_id);`
-   `CREATE INDEX ON public.goals (parent_goal_id);`
-   `CREATE INDEX ON public.goals (user_id, status);`
-   `CREATE INDEX ON public.goals (user_id, created_at DESC);`
-   `CREATE INDEX ON public.goal_progress (goal_id);`

## 4. Row Level Security (RLS) Policies

RLS will be enabled on all tables to ensure users can only access and modify their own data.

### `profiles` Table Policies

```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile.
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can update their own profile.
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
```

### `goals` Table Policies

```sql
-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can perform all operations on their own goals.
CREATE POLICY "Users can manage their own goals"
ON public.goals FOR ALL
USING (auth.uid() = user_id);
```

### `goal_progress` Table Policies

```sql
-- Enable RLS
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage progress for their own goals.
CREATE POLICY "Users can manage progress for their own goals"
ON public.goal_progress FOR ALL
USING ((
  SELECT user_id
  FROM public.goals
  WHERE id = goal_id
) = auth.uid());
```

## 5. Additional Design Notes

-   **Goal Immutability (F-03)**: The rule that a goal's name, target value, and deadline become immutable after the first progress entry will be enforced in the application's business logic, not at the database level.
-   **Automatic Status Change (F-07)**: The logic for automatically changing a goal's status upon deadline expiry will be triggered by application logic during a user's visit, rather than a database cron job, simplifying the MVP infrastructure.
-   **Goal Name Uniqueness (F-02)**: A `UNIQUE` constraint on the goal name is intentionally omitted to allow users to easily retry goals with the same name across different iterations.
-   **Triggers for `updated_at`**: Standard triggers will be set up to automatically update the `updated_at` column on any row modification for all tables.