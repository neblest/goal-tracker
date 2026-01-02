import type { Enums, Tables } from "./db/database.types";

/**
 * Shared API envelope types (recommended in api-plan.md)
 */
export interface ApiErrorBodyDto<Code extends string = string, Details = unknown> {
  code: Code;
  message: string;
  details?: Details;
}

export interface ApiErrorDto<Code extends string = string, Details = unknown> {
  error: ApiErrorBodyDto<Code, Details>;
}

export interface ApiSuccessDto<Data> {
  data: Data;
}

export interface OffsetPaginationMetaDto {
  page: number;
  pageSize: number;
  total: number;
}

export interface OffsetPaginatedDto<Item> extends OffsetPaginationMetaDto {
  items: Item[];
}

/**
 * JSON representation of numeric "decimal" fields.
 *
 * DB uses `number` for `target_value` and `goal_progress.value`,
 * but API plan requires them as **string** to avoid floating point issues.
 */
export type DecimalString = string;

/**
 * Uses Record<> to satisfy `@typescript-eslint/consistent-indexed-object-style`.
 */
export type WithDecimalStrings<T, Keys extends keyof T> = Omit<T, Keys> & Record<Keys, DecimalString>;

/**
 * Database entity types (source-of-truth)
 */
export type GoalStatus = Enums<"goal_status">;
export type DbGoalRow = Tables<"goals">;
export type DbGoalProgressRow = Tables<"goal_progress">;

/**
 * Auth DTOs
 *
 * Supabase Auth is not represented in `Database` types (it is an auth service, not `public.*` tables),
 * so these DTOs are intentionally minimal and represent what the API plan returns.
 */
export interface AuthUserDto {
  id: string;
  email: string | null;
}

export interface RegisterCommand {
  email: string;
  password: string;
}

export type RegisterResponseDto = ApiSuccessDto<{
  user: AuthUserDto;
}>;

export interface LoginCommand {
  email: string;
  password: string;
}

export type LoginResponseDto = ApiSuccessDto<{
  access_token: string;
  refresh_token: string;
  user: AuthUserDto;
}>;

/**
 * 204 No Content responses (no JSON body).
 *
 * Note: `void` is intentionally not used here due to lint rules.
 */
export type NoContentResponseDto = undefined;

export type LogoutResponseDto = NoContentResponseDto;

export type MeResponseDto = ApiSuccessDto<{
  user: AuthUserDto;
}>;

/**
 * Goals DTOs
 */
export type GoalPublicFieldsDto = WithDecimalStrings<
  Pick<
    DbGoalRow,
    | "id"
    | "parent_goal_id"
    | "name"
    | "target_value"
    | "deadline"
    | "status"
    | "reflection_notes"
    | "ai_summary"
    | "ai_generation_attempts"
    | "abandonment_reason"
    | "created_at"
    | "updated_at"
  >,
  "target_value"
>;

export interface GoalComputedListDto {
  /** sum(goal_progress.value) for this goal, rendered as DecimalString */
  current_value: DecimalString;
  /** current_value / target_value (0..n) */
  progress_ratio: number;
  /** rounded percent (0..100+) */
  progress_percent: number;
  /** entries_count >= 1; when true, some fields become immutable */
  is_locked: boolean;
  /** deadline - now in days (can be negative after deadline depending on policy) */
  days_remaining: number;
}

export interface GoalComputedDetailsDto extends GoalComputedListDto {
  entries_count: number;
}

export type GoalListItemDto = GoalPublicFieldsDto & {
  computed: GoalComputedListDto;
};

export interface GetGoalsQueryDto {
  status?: GoalStatus;
  q?: string;
  parentGoalId?: string;
  root?: boolean;
  sort?: "created_at" | "deadline";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export type GetGoalsResponseDto = ApiSuccessDto<OffsetPaginatedDto<GoalListItemDto>>;

export interface CreateGoalCommand {
  name: DbGoalRow["name"];
  /** DecimalString per API plan */
  target_value: DecimalString;
  /** YYYY-MM-DD */
  deadline: DbGoalRow["deadline"];
  parent_goal_id?: DbGoalRow["parent_goal_id"];
}

export type CreateGoalResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "status" | "name" | "target_value" | "deadline" | "parent_goal_id">;
}>;

export type GoalDetailsDto = GoalPublicFieldsDto & {
  computed: GoalComputedDetailsDto;
};

export type GetGoalResponseDto = ApiSuccessDto<{
  goal: GoalDetailsDto;
}>;

/**
 * Update rules are enforced by API logic; the type models allowed fields.
 * - `name`, `target_value`, `deadline` may be rejected with 409 if `is_locked`.
 * - `reflection_notes` and `ai_summary` are always editable per plan.
 */
export interface UpdateGoalCommand {
  name?: DbGoalRow["name"];
  target_value?: DecimalString;
  deadline?: DbGoalRow["deadline"];
  reflection_notes?: DbGoalRow["reflection_notes"];
  ai_summary?: DbGoalRow["ai_summary"];
}

export type UpdateGoalResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "updated_at"> &
    Partial<Pick<GoalPublicFieldsDto, "name" | "target_value" | "deadline" | "reflection_notes" | "ai_summary">>;
}>;

export type DeleteGoalResponseDto = NoContentResponseDto;

/**
 * Goal Progress Entries DTOs
 */
export type GoalProgressEntryDto = WithDecimalStrings<
  Pick<DbGoalProgressRow, "id" | "goal_id" | "value" | "notes" | "created_at" | "updated_at">,
  "value"
>;

export interface GetGoalProgressQueryDto {
  sort?: "created_at";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export type GetGoalProgressResponseDto = ApiSuccessDto<OffsetPaginatedDto<GoalProgressEntryDto>>;

export interface CreateGoalProgressCommand {
  value: DecimalString;
  notes?: DbGoalProgressRow["notes"];
}

export type CreateGoalProgressResponseDto = ApiSuccessDto<{
  progress: Pick<GoalProgressEntryDto, "id" | "goal_id" | "value" | "notes">;
  goal: Pick<DbGoalRow, "id" | "status">;
  computed: {
    current_value: DecimalString;
    progress_percent: number;
  };
}>;

export interface UpdateProgressCommand {
  value?: DecimalString;
  notes?: DbGoalProgressRow["notes"];
}

export type UpdateProgressResponseDto = ApiSuccessDto<{
  progress: Pick<GoalProgressEntryDto, "id" | "goal_id" | "value" | "notes" | "updated_at">;
}>;

export type DeleteProgressResponseDto = NoContentResponseDto;

/**
 * Goal Lifecycle Actions (business logic)
 */
export interface SyncStatusesCommand {
  goal_ids?: DbGoalRow["id"][];
}

export type SyncStatusesResponseDto = ApiSuccessDto<{
  updated: {
    id: DbGoalRow["id"];
    from: GoalStatus;
    to: GoalStatus;
  }[];
}>;

export interface AbandonGoalCommand {
  reason: NonNullable<DbGoalRow["abandonment_reason"]>;
}

export type AbandonGoalResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "status" | "abandonment_reason">;
}>;

export type CompleteGoalResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "status" | "ai_summary" | "ai_generation_attempts">;
}>;

export interface RetryGoalCommand {
  target_value: DecimalString;
  deadline: DbGoalRow["deadline"];
  name?: DbGoalRow["name"];
}

export type RetryGoalResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "parent_goal_id" | "status">;
}>;

export interface ContinueGoalCommand {
  target_value: DecimalString;
  deadline: DbGoalRow["deadline"];
  name: DbGoalRow["name"];
}

export type ContinueGoalResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "parent_goal_id" | "status">;
}>;

/**
 * Goal History (iterations)
 */
export interface GoalHistoryItemDto {
  id: DbGoalRow["id"];
  parent_goal_id: DbGoalRow["parent_goal_id"];
  name: DbGoalRow["name"];
  status: GoalStatus;
  deadline: DbGoalRow["deadline"];
  created_at: DbGoalRow["created_at"];
  updated_at: DbGoalRow["updated_at"];
  computed: {
    current_value: DecimalString;
  };
  ai_summary: DbGoalRow["ai_summary"];
}

export interface GetGoalHistoryQueryDto {
  sort?: "created_at";
  order?: "asc" | "desc";
}

export type GetGoalHistoryResponseDto = ApiSuccessDto<{
  items: GoalHistoryItemDto[];
}>;

/**
 * AI Summary
 */
export interface GenerateAiSummaryCommand {
  force?: boolean;
}

export interface AiSummaryNextGoalSuggestionDto {
  name: DbGoalRow["name"];
  target_value: DecimalString;
  deadline_hint_days: number;
}

export type GenerateAiSummaryResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id"> & {
    ai_summary: NonNullable<DbGoalRow["ai_summary"]>;
  };
}>;

export interface UpdateAiSummaryCommand {
  ai_summary: NonNullable<DbGoalRow["ai_summary"]>;
}

export type UpdateAiSummaryResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "ai_summary">;
}>;
