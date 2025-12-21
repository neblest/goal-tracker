# API Endpoint Implementation Plan: POST /api/goals/:goalId/retry

## 1. Przegląd punktu końcowego
Endpoint tworzy nowy cel w statusie `active` jako ponowienie (retry) wcześniejszego celu, ale tylko jeśli oryginalny cel jest `completed_failure` albo `abandoned`.

Nowy cel:
- ma `parent_goal_id = :goalId` (łącząc iteracje w historię),
- kopiuje `name` z poprzedniego celu, chyba że klient poda nowe `name`,
- przyjmuje nowe `target_value` i `deadline` z requestu,
- startuje ze statusem `active`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/goals/:goalId/retry`
- Uwierzytelnianie: wymagane (`Authorization: Bearer <access_token>`)

Parametry:
- Wymagane:
  - `goalId` (path) – UUID.
  - `target_value` (body) – DecimalString > 0.
  - `deadline` (body) – YYYY-MM-DD.
- Opcjonalne:
  - `name` (body) – nowa nazwa; jeśli brak, kopiuj nazwę z celu źródłowego.

Request body:
```json
{ "target_value": "70", "deadline": "2026-02-28" }
```

Walidacja (Zod):
- `goalId`: UUID → błędy formatu jako `400`.
- Body:
  - `target_value`: string regex decimal + `parseFloat(val) > 0`.
  - `deadline`: format `YYYY-MM-DD` oraz (zalecenie spójne z tworzeniem celu) musi być w przyszłości.
  - `name` (opcjonalnie): trim, min 1, max 500.
  - `.strict()` aby odrzucać nieznane pola.
  - Błędy walidacji → `422`.

Wykorzystywane typy (DTO/Command):
- `RetryGoalCommand`
- `RetryGoalResponseDto`
- `ApiErrorDto`

## 3. Szczegóły odpowiedzi
- Sukces: `201 Created`
  ```json
  { "data": { "goal": { "id": "new-uuid", "parent_goal_id": "old-uuid", "status": "active" } } }
  ```

## 4. Przepływ danych
1. Route: waliduje `goalId`.
2. Route: parsuje JSON body i waliduje `RetryGoalCommand`.
3. Route: uwierzytelnia użytkownika i uzyskuje `userId`.
4. Service (np. `src/lib/services/goal-lifecycle.service.ts`):
   - Pobiera cel źródłowy: `select id, user_id, status, name from goals where id = goalId and user_id = userId`.
   - Jeśli brak → `goal_not_found`.
   - Jeśli `status` nie jest `completed_failure` ani `abandoned` → błąd konfliktu (np. `goal_not_retryable`) mapowany na `409`.
   - Ustala `newName = command.name ?? source.name`.
   - Tworzy nowy rekord w `goals`:
     - `user_id = userId`
     - `parent_goal_id = source.id`
     - `name = newName`
     - `target_value = parseFloat(command.target_value)`
     - `deadline = command.deadline`
     - `status = 'active'`
     - `abandonment_reason = null`, `ai_summary = null` (pozostają puste na starcie)
   - Zwraca `id`, `parent_goal_id`, `status` nowego celu.
5. Route: zwraca `RetryGoalResponseDto` z kodem `201`.

## 5. Względy bezpieczeństwa
- AuthN wymagane.
- AuthZ: filtr `user_id` w każdym zapytaniu.
- Brak eskalacji uprawnień: nie pozwala wskazać `user_id` ani `parent_goal_id` poza kontrolą serwisu.
- Walidacja: `deadline` i `target_value` by ograniczyć błędy domenowe i nadużycia.

## 6. Obsługa błędów
- `401` – brak/niepoprawny token.
- `400 invalid_path_params` – `goalId` nie-UUID.
- `404 goal_not_found` – cel nie istnieje lub nie należy do użytkownika.
- `409 goal_not_retryable` – status nie jest `completed_failure` ani `abandoned`.
- `422 validation_error` – niepoprawne `target_value/deadline/name` lub niepoprawny JSON.
- `500 internal_error` – błędy DB.

Rejestrowanie błędów:
- Brak tabeli błędów; `console.error`.

## 7. Wydajność
- 1 odczyt celu + 1 insert.
- Użyć `select(...).maybeSingle()` aby uniknąć dodatkowych zapytań.

## 8. Kroki implementacji
1. Dodać route: `src/pages/api/goals/[goalId]/retry.ts` (`export const prerender = false`).
2. Zaimplementować walidację `goalId` i body `RetryGoalCommand` (Zod, `.strict()`).
3. Dodać serwis `retryGoal(supabase, userId, goalId, command)`.
4. Zaimplementować regułę statusu źródłowego oraz insert nowego celu z `parent_goal_id`.
5. Zwrócić `201` + `RetryGoalResponseDto`.
6. Ręczne testy:
   - retry z `completed_failure`
   - retry z `abandoned`
   - retry z `active`/`completed_success` → `409`
   - invalid body → `422`
   - cudzy goalId → `404`
