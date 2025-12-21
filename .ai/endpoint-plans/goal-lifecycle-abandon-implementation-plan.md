# API Endpoint Implementation Plan: POST /api/goals/:goalId/abandon

## 1. Przegląd punktu końcowego
Endpoint pozwala użytkownikowi ręcznie porzucić (abandon) cel, ale wyłącznie jeśli cel jest aktualnie `active`. Zapisuje `abandonment_reason` i ustawia `status = abandoned`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/goals/:goalId/abandon`
- Uwierzytelnianie: wymagane (`Authorization: Bearer <access_token>`)

Parametry:
- Wymagane:
  - `goalId` (path) – UUID.
  - `reason` (body) – niepusty string.
- Opcjonalne: brak.

Request body:
```json
{ "reason": "No time" }
```

Walidacja (Zod):
- `goalId`: `z.string().uuid()` → błędy formatu jako `400`.
- Body:
  - JSON object.
  - `reason`: `z.string().trim().min(1)`.
  - Zalecany limit długości (np. max 1000–2000 znaków) by uniknąć nadużyć.
  - Błędy walidacji → `422` (zgodnie ze specyfikacją).

Wykorzystywane typy (DTO/Command):
- `AbandonGoalCommand`
- `AbandonGoalResponseDto`
- `ApiErrorDto`

## 3. Szczegóły odpowiedzi
- Sukces: `200 OK`
  ```json
  { "data": { "goal": { "id": "uuid", "status": "abandoned", "abandonment_reason": "No time" } } }
  ```

## 4. Przepływ danych
1. Route: waliduje `goalId` (Zod).
2. Route: parsuje JSON body i waliduje `reason` (Zod).
3. Route: uwierzytelnia użytkownika i uzyskuje `userId`.
4. Service (np. `src/lib/services/goal-lifecycle.service.ts`):
   - Pobiera cel: `select id, status from goals where id = goalId and user_id = userId`.
   - Jeśli brak → błąd `goal_not_found`.
   - Jeśli `status != active` → błąd konfliktu (np. `goal_not_active`).
   - Aktualizuje rekord:
     - `status = 'abandoned'`
     - `abandonment_reason = reason`
   - Zwraca `{ id, status, abandonment_reason }`.
5. Route: zwraca `AbandonGoalResponseDto`.

## 5. Względy bezpieczeństwa
- AuthN: wymagane.
- AuthZ: zawsze filtruj po `user_id` (defense-in-depth i kompatybilność z dev, gdzie RLS może być wyłączone).
- Walidacja: `reason` trim + limit długości.
- Unikaj ujawniania cudzych zasobów: jeśli cel nie należy do usera, zachowuje się jak `404`.

## 6. Obsługa błędów
- `401` – brak/niepoprawny token.
- `400 invalid_path_params` – `goalId` nie jest UUID.
- `404 goal_not_found` – cel nie istnieje lub nie należy do użytkownika.
- `409 goal_not_active` – cel nie jest `active`.
- `422 validation_error` – brak `reason` lub pusty/niepoprawny payload.
- `500 internal_error` – błędy DB / nieoczekiwane wyjątki.

Rejestrowanie błędów:
- Brak tabeli błędów w schemacie; logować `console.error` w route + service.

## 7. Wydajność
- 1 odczyt + 1 update na żądanie.
- Indeks `goals_user_id_idx` wspiera filtr `user_id`; dodatkowo warto polegać na `id` (PK) i filtrować również po `user_id`.

## 8. Kroki implementacji
1. Dodać route: `src/pages/api/goals/[goalId]/abandon.ts` (`export const prerender = false`).
2. Dodać Zod schema dla `goalId` i body `{ reason }`.
3. Dodać funkcję serwisową `abandonGoal(supabase, userId, goalId, command)` w `src/lib/services/goal-lifecycle.service.ts`.
4. W serwisie wymusić regułę `status === 'active'`, w przeciwnym razie rzucić błąd mapowany na `409`.
5. Zwrócić response zgodny z `AbandonGoalResponseDto`.
6. Ręczne testy:
   - abandon aktywnego celu
   - abandon celu już completed/abandoned → `409`
   - goalId nie-UUID → `400`
   - brak reason → `422`
   - cudzy goalId → `404`
