# API Endpoint Implementation Plan: POST /api/goals/:goalId/continue

## 1. Przegląd punktu końcowego
Endpoint tworzy nowy cel w statusie `active` jako kontynuację po sukcesie (`completed_success`) wcześniejszego celu.

Nowy cel:
- ma `parent_goal_id = :goalId`.
- przyjmuje `name`, `target_value`, `deadline` z requestu (w tym przypadku `name` jest wymagane).
- startuje ze statusem `active`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/goals/:goalId/continue`
- Uwierzytelnianie: wymagane (`Authorization: Bearer <access_token>`)

Parametry:
- Wymagane:
  - `goalId` (path) – UUID.
  - `name` (body) – tekst (wymagane).
  - `target_value` (body) – DecimalString > 0.
  - `deadline` (body) – YYYY-MM-DD.
- Opcjonalne: brak.

Request body:
```json
{ "target_value": "120", "deadline": "2026-02-28", "name": "Run 120 km" }
```

Walidacja (Zod):
- `goalId`: UUID → `400`.
- Body (strict):
  - `name`: trim, min 1, max 500.
  - `target_value`: decimal string + `> 0`.
  - `deadline`: regex YYYY-MM-DD + (zalecenie spójne z tworzeniem celu) data w przyszłości.
  - błędy walidacji → `422`.

Wykorzystywane typy (DTO/Command):
- `ContinueGoalCommand`
- `ContinueGoalResponseDto`
- `ApiErrorDto`

## 3. Szczegóły odpowiedzi
- Sukces: `201 Created`
  ```json
  { "data": { "goal": { "id": "new-uuid", "parent_goal_id": "old-uuid", "status": "active" } } }
  ```

## 4. Przepływ danych
1. Route: waliduje `goalId`.
2. Route: parsuje JSON body i waliduje `ContinueGoalCommand`.
3. Route: uwierzytelnia użytkownika i uzyskuje `userId`.
4. Service (np. `src/lib/services/goal-lifecycle.service.ts`):
   - Pobiera cel źródłowy: `select id, status from goals where id = goalId and user_id = userId`.
   - Jeśli brak → `goal_not_found`.
   - Jeśli `status !== completed_success` → błąd konfliktu (np. `goal_not_continuable`) mapowany na `409`.
   - Tworzy nowy rekord w `goals`:
     - `user_id = userId`
     - `parent_goal_id = source.id`
     - `name = command.name`
     - `target_value = parseFloat(command.target_value)`
     - `deadline = command.deadline`
     - `status = 'active'`
   - Zwraca `{ id, parent_goal_id, status }` nowego celu.
5. Route: zwraca `ContinueGoalResponseDto` z kodem `201`.

## 5. Względy bezpieczeństwa
- AuthN wymagane.
- AuthZ: zawsze filtruj `user_id`.
- Walidacja wejścia (szczególnie `target_value`, `deadline`) minimalizuje niepoprawne dane domenowe.

## 6. Obsługa błędów
- `401` – brak/niepoprawny token.
- `400 invalid_path_params` – `goalId` nie-UUID.
- `404 goal_not_found` – cel nie istnieje lub nie należy do usera.
- `409 goal_not_continuable` – status źródłowego celu ≠ `completed_success`.
- `422 validation_error` – niepoprawne `name/target_value/deadline` lub niepoprawny JSON.
- `500 internal_error` – błędy DB.

Rejestrowanie błędów:
- Brak tabeli błędów; logować `console.error`.

## 7. Wydajność
- 1 odczyt + 1 insert.
- Minimalny koszt obliczeniowy.

## 8. Kroki implementacji
1. Dodać route: `src/pages/api/goals/[goalId]/continue.ts` (`export const prerender = false`).
2. Dodać Zod schema dla `goalId` i body `ContinueGoalCommand` (strict).
3. Dodać serwis `continueGoal(supabase, userId, goalId, command)`.
4. W serwisie wymusić regułę `status === 'completed_success'`.
5. Insert nowego celu z `parent_goal_id`.
6. Zwrócić `201` + `ContinueGoalResponseDto`.
7. Ręczne testy:
   - continue z `completed_success`
   - continue z innym statusem → `409`
   - invalid body → `422`
   - cudzy goalId → `404`
