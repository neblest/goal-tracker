# API Endpoint Implementation Plan: PATCH /api/goals/:goalId

## 1. Przegląd punktu końcowego

Endpoint aktualizuje **edytowalne pola** celu (rekordu w `public.goals`) wskazanego przez `:goalId`.

- Metoda HTTP: `PATCH`
- Ścieżka: `/api/goals/:goalId`
- Autoryzacja: `Authorization: Bearer <access_token>` (Supabase JWT)
- Content-Type: `application/json`
- Cel biznesowy:
  - pozwolić edytować notatki (`reflection_notes`) i podsumowanie (`ai_summary`) w dowolnym momencie,
  - pozwolić edytować pola „definiujące cel” (`name`, `target_value`, `deadline`) **tylko dopóki cel nie jest „locked”** (tj. dopóki nie ma jeszcze żadnego wpisu w `goal_progress`).

Definicja „locked” (zgodnie z typami w [src/types.ts](src/types.ts)):
- `is_locked === true` gdy `entries_count >= 1`.

## 2. Szczegóły żądania

- Metoda HTTP: `PATCH`
- Struktura URL: `/api/goals/:goalId`
- Nagłówki:
  - Wymagane: `Authorization: Bearer <token>`
  - Zalecane: `Content-Type: application/json`

### Parametry

- Wymagane:
  - `goalId` (path) — UUID celu
- Opcjonalne: brak w query

### Request Body (JSON)

Model wejściowy: `UpdateGoalCommand` z [src/types.ts](src/types.ts).

Pola (wszystkie opcjonalne, ale żądanie powinno zawierać **co najmniej jedno**):
- `name?: string`
- `target_value?: DecimalString` (string reprezentujący liczbę dziesiętną)
- `deadline?: string` (YYYY-MM-DD)
- `reflection_notes?: string | null`
- `ai_summary?: string | null`

Reguły biznesowe „allowed fields depend on business rules”:
- Jeśli cel jest „locked” (ma >= 1 wpis `goal_progress`):
  - modyfikacja `name`, `target_value`, `deadline` jest zabroniona → `409`
  - modyfikacja `reflection_notes`, `ai_summary` jest dozwolona

## 3. Wykorzystywane typy

### DTO / Command
Zdefiniowane w [src/types.ts](src/types.ts):
- `UpdateGoalCommand`
- `UpdateGoalResponseDto`
- `ApiErrorDto`
- `DecimalString`

### Proponowane dodatkowe typy pomocnicze (wewnętrzne, opcjonalne)
- `UpdateGoalServiceResult = { id: string; updated_at: string }`
- `UpdateGoalServiceError` (np. union stringów):
  - `goal_not_found`
  - `goal_locked`
  - `database_error`

## 4. Szczegóły odpowiedzi

### Sukces (200)

- Status: `200 OK`
- Body:
  ```json
  { "data": { "goal": { "id": "uuid", "updated_at": "..." } } }
  ```

Zalecenie implementacyjne:
- trzymać się minimalnego payloadu z planu API (tylko `id`, `updated_at`), mimo że `UpdateGoalResponseDto` dopuszcza zwrot części pól.

### Kody błędów

- `401` — brak/niepoprawny token
- `404` — cel nie istnieje lub nie należy do użytkownika
- `409` — konflikt: próba zmiany pól zablokowanych po pierwszym progressie
- `422` — błąd walidacji body (format / wartości)
- `500` — nieoczekiwany błąd serwera / błąd DB

## 5. Przepływ danych

Docelowa architektura: cienki handler + logika w service.

### Warstwa HTTP (Astro API route)
Plik: [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts)

1. Walidacja `goalId` (UUID) przez Zod.
2. Uwierzytelnienie użytkownika na podstawie `Authorization: Bearer`:
   - `const supabase = context.locals.supabase`
   - `supabase.auth.getUser(token)`
3. Parsowanie i walidacja JSON body przez Zod.
4. Wywołanie service: `updateGoal(supabase, user.id, goalId, command)`.
5. Mapowanie błędów z service na statusy HTTP.
6. Zwrócenie envelope: sukces `{ data: ... }` / błąd `{ error: ... }`.

### Warstwa serwisowa (business logic)
Plik: [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts)

Dodać funkcję:
- `updateGoal(supabase: SupabaseClient, userId: string, goalId: string, command: UpdateGoalCommand): Promise<{ id: string; updated_at: string }>`

Przepływ w service:
1. Pobierz aktualny cel (musi należeć do użytkownika):
   - select: `id, user_id, name, target_value, deadline, updated_at`
   - filtr: `.eq("id", goalId).eq("user_id", userId)`
   - jeśli brak → `goal_not_found`
2. Ustal `entries_count` dla `goal_progress`:
   - zapytanie do `goal_progress` po `goal_id = goalId` z `count: "exact"`, bez pobierania pełnych wierszy
   - `is_locked = count >= 1`
3. Jeśli `is_locked` i request zawiera `name` lub `target_value` lub `deadline`:
   - wariant bardziej „fair”: porównaj z obecną wartością i rzucaj `goal_locked` tylko gdy wartość się realnie zmienia
   - wariant prostszy (MVP): zawsze `goal_locked` gdy te pola są obecne w body
4. Zbuduj payload do update jako whitelistę pól (mass-assignment protection):
   - uwzględnij tylko pola z `UpdateGoalCommand`
   - nie pozwalaj aktualizować `status`, `user_id`, `parent_goal_id`, `abandonment_reason`, `created_at`
5. Wykonaj update:
   - `.from("goals").update(payload).eq("id", goalId).eq("user_id", userId).select("id, updated_at").single()`
6. Zwróć `{ id, updated_at }`.

Uwagi dot. numeric/decimal:
- DB ma `target_value decimal`, natomiast API przyjmuje `DecimalString`.
- W obecnym `createGoal` konwersja jest `parseFloat(command.target_value)`.
- Rekomendacja: utrzymać spójność (parseFloat) lub przejść na wysyłanie string do PostgREST (lepsze dla precyzji, ale może wymagać obejścia typów TS). Decyzję ustalić zespołowo.

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie**
   - Wymagane `Authorization: Bearer ...`.
   - `401` dla braku lub niepoprawnego tokenu.

2. **Autoryzacja / Ownership**
   - Zawsze filtruj po `user_id` w zapytaniach do `goals`.
   - W produkcji zakładać włączone RLS na `public.goals` i `public.goal_progress` (migracja dev wyłącza RLS lokalnie).

3. **Walidacja i whitelisting pól**
   - Aktualizuj wyłącznie pola z `UpdateGoalCommand`.
   - Odrzuć payloady z nieznanymi polami (Zod `strict()`), aby ograniczyć ryzyko mass assignment.

4. **Reguły biznesowe dot. lock**
   - Zapobiegaj edycji kluczowych pól po pierwszym progresie (409).

5. **Odporność na nadużycia**
   - Rozważyć rate limiting na poziomie reverse proxy / edge (poza zakresem implementacji w tym repo).

6. **Brak wycieku informacji**
   - `404` dla „nie istnieje” i „nie należy do usera” (tak jak w GET).

## 7. Obsługa błędów

### Mapowanie błędów na HTTP

- `400 invalid_path_params` — `goalId` nie jest UUID (spójnie z GET)
- `401 unauthenticated` — brak/niepoprawny token
- `404 goal_not_found` — brak rekordu `goals` dla `(id, user_id)`
- `409 goal_locked` — próba zmiany `name/target_value/deadline` gdy `entries_count >= 1`
- `422 validation_error` — błędne body (format, wartości, puste body)
- `500 internal_error` — błąd DB lub nieobsłużony wyjątek

### Scenariusze błędów (przykłady)

1. Brak nagłówka Authorization → `401`
2. Token nieprawidłowy/wygasły → `401`
3. `goalId` nie jest UUID → `400`
4. Puste body `{}` / brak JSON → `422`
5. `target_value` nie jest liczbą w stringu / <= 0 → `422`
6. `deadline` nie jest `YYYY-MM-DD` lub jest w przeszłości (jeśli wymusimy) → `422`
7. Cel nie istnieje / nie należy do usera → `404`
8. Cel ma progres i body próbuje zmienić `name/target_value/deadline` → `409`
9. Błąd Supabase/PostgREST → `500`

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

- W obecnym schemacie DB (migracje w [supabase/migrations](supabase/migrations)) nie ma tabeli do logowania błędów aplikacyjnych.
- MVP: logowanie przez `console.error` (jak w GET) z kontekstem: method, route, userId (jeśli znany), goalId, oraz błąd.
- Jeśli zespół chce twarde logi w DB:
  - dodać osobną migrację tworzącą np. `public.api_error_logs` (RLS + polityki),
  - logować tylko bezpieczne dane (bez tokenów i bez wrażliwych payloadów).

## 8. Wydajność

- Zapytania DB (wariant prosty):
  1) `select` celu
  2) `count` wpisów `goal_progress`
  3) `update` celu

Optymalizacje (opcjonalne, jeśli zajdzie potrzeba):
- Zastąpić (1)+(2) jedną funkcją SQL (RPC) zwracającą `is_locked` i bieżące pola.
- Upewnić się, że istnieje indeks na `goal_progress.goal_id` (jest: `goal_progress_goal_id_idx`).

## 9. Kroki implementacji

1. **Dodaj schematy Zod w route**
   - W [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts) dodać `export async function PATCH(context)`.
   - `goalIdSchema = z.string().uuid()`.
   - `updateGoalSchema = z.object({ ... }).strict().refine(atLeastOneField)`.

2. **Walidacja wejścia**
   - `400` dla złego `goalId`.
   - `422` dla błędnego body:
     - body nie jest JSON,
     - body jest `{}`,
     - `target_value` nie przechodzi walidacji,
     - `deadline` ma zły format / jest w przeszłości (jeśli wymuszone).

3. **Uwierzytelnienie**
   - Włączyć produkcyjny kod z `Authorization` (usunąć DEV_USER_ID dla tego endpointu).
   - `401` jeśli brak Bearer lub `supabase.auth.getUser()` zwraca błąd.

4. **Wyodrębnienie logiki do service**
   - W [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts) dodać `updateGoal(...)`.
   - Utrzymać wzorzec błędów jak w `getGoalDetails` (rzucanie `new Error("goal_not_found")`, `new Error("database_error")`).
   - Dodać nowy kod błędu: `goal_locked`.

5. **Implementacja reguły lock**
   - Pobierz `entries_count` z `goal_progress`.
   - Jeśli locked i request dotyka pól immutable (minimum MVP) → rzuć `goal_locked`.

6. **Update w DB**
   - Zbuduj payload tylko z dozwolonych pól.
   - Wykonaj update po `(id, user_id)`.

7. **Konwersje decimal**
   - Jeśli aktualizowany `target_value`:
     - waliduj `DecimalString`.
     - konwertuj do DB numeric w sposób uzgodniony (parseFloat lub string).

8. **Zwracanie odpowiedzi**
   - `200` z `{ data: { goal: { id, updated_at } } }`.

9. **Mapowanie błędów w handlerze**
   - `goal_not_found` → `404`
   - `goal_locked` → `409`
   - `database_error` → `500`
   - pozostałe → `500`

10. **Test scenariusze (manual / e2e)**
   - PATCH z poprawnym tokenem i zmianą `reflection_notes` → `200`.
   - PATCH z celem bez progressu i zmianą `name/target_value/deadline` → `200`.
   - PATCH z celem z progress i próbą zmiany `deadline` → `409`.
   - PATCH bez tokenu → `401`.
   - PATCH na nieistniejący `goalId` → `404`.
   - PATCH z `{}` → `422`.
