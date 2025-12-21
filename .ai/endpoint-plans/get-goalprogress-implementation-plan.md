# API Endpoint Implementation Plan: GET /api/goals/:goalId/progress

## 1. Przegląd punktu końcowego
Celem endpointa jest zwrócenie listy wpisów postępu (`goal_progress`) dla wskazanego celu (`goals`) z paginacją typu offset oraz możliwością sortowania po `created_at`. Endpoint musi działać wyłącznie dla zalogowanego użytkownika i zwracać `404`, jeśli cel nie istnieje lub nie należy do użytkownika.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/api/goals/:goalId/progress`
- Parametry:
  - Wymagane:
    - `goalId` (path) — UUID
  - Opcjonalne (query):
    - `sort`: `created_at` (domyślnie `created_at`)
    - `order`: `asc | desc` (domyślnie `desc`)
    - `page`: liczba całkowita >= 1 (domyślnie `1`)
    - `pageSize`: liczba całkowita 1..100 (domyślnie `20`)
- Request body: brak

**Wykorzystywane typy (src/types.ts)**
- `GetGoalProgressQueryDto`
- `GetGoalProgressResponseDto`
- `GoalProgressEntryDto`
- `OffsetPaginatedDto<T>`
- `ApiErrorDto`
- `DecimalString` (reprezentacja pól `decimal` jako string w API)

## 3. Szczegóły odpowiedzi
- 200 OK
  - JSON:
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
- Błędy:
  - 400 — nieprawidłowe `goalId` lub query params
  - 401 — brak autentykacji
  - 404 — cel nie istnieje / nie należy do użytkownika
  - 500 — błąd serwera / bazy

Uwaga dot. pól `decimal`:
- W DB `goal_progress.value` jest typu `decimal` i w wygenerowanych typach bywa reprezentowany jako `number`.
- API wymaga `value` jako `string` (`DecimalString`), więc w warstwie serwisu konieczna jest konwersja `String(row.value)`.

## 4. Przepływ danych
1. Warstwa route (Astro endpoint) parsuje i waliduje:
   - `goalId` z `context.params.goalId`.
   - query params z `new URL(context.request.url).searchParams`.
2. Warstwa route wykonuje autentykację:
   - Docelowo: `Authorization: Bearer <token>` i `supabase.auth.getUser(token)`.
   - Zgodnie z obecnym wzorcem w repo: dopuszczalny tryb dev z twardo ustawionym `DEV_USER_ID` (do usunięcia przed produkcją).
3. Serwis (np. nowy) sprawdza dostępność celu:
   - `select id from goals where id = :goalId and user_id = :userId`.
   - Jeśli brak rekordu: błąd `goal_not_found` mapowany na `404`.
4. Serwis pobiera dane z `goal_progress`:
   - `select id, goal_id, value, notes, created_at, updated_at` z `{ count: 'exact' }`.
   - Sortowanie: `.order('created_at', { ascending: order === 'asc' })`.
   - Paginacja: `.range(from, to)`.
5. Serwis mapuje wynik do `OffsetPaginatedDto<GoalProgressEntryDto>`:
   - `value` konwertowane do `DecimalString`.
   - `total` ustawiane na `count ?? 0`.
6. Route zwraca `GetGoalProgressResponseDto`.

## 5. Względy bezpieczeństwa
- Uwierzytelnianie:
  - Wymagane `401` przy braku/niepoprawnym tokenie.
- Autoryzacja:
  - Endpoint musi działać tylko na celach należących do użytkownika.
  - Docelowo RLS na tabelach (`goals`, `goal_progress`) powinno wymuszać izolację danych. Migracja dev wyłącza RLS, więc i tak należy jawnie filtrować po `user_id` poprzez sprawdzenie celu (ochrona w logice aplikacyjnej).
- Walidacja danych:
  - UUID w path.
  - Query params ograniczone do dozwolonych wartości i zakresów.
- Zapobieganie wyciekom danych:
  - Nie zwracać wpisów postępu, jeśli `goalId` nie należy do użytkownika (zwrócić `404`, a nie np. `403`, zgodnie ze specyfikacją).

## 6. Obsługa błędów
**Scenariusze i kody:**
- 400 `invalid_path_params` — `goalId` nie jest UUID.
- 400 `invalid_query_params` — np. `page=0`, `pageSize>100`, `order` spoza enum.
- 401 `unauthenticated` — brak/niepoprawny Bearer token.
- 404 `goal_not_found` — cel nie istnieje lub nie jest własnością użytkownika.
- 500 `internal_error` — błąd Supabase/PostgREST lub nieoczekiwany błąd runtime.

**Rejestrowanie błędów (tabela błędów):**
- W aktualnym schemacie brak tabeli na logi błędów; używać `console.error` w endpointach (jak w istniejących route’ach) i opcjonalnie zintegrować z zewnętrznym narzędziem (Sentry/Logtail) w przyszłości.

## 7. Wydajność
- Paginacja zawsze po stronie DB (`range`) oraz `count: 'exact'`.
- Indeks `goal_progress_goal_id_idx` wspiera filtr `.eq('goal_id', goalId)`.
- Ryzyko kosztu `count: 'exact'` dla bardzo dużych tabel — na MVP akceptowalne; w przyszłości rozważyć `planned`/`estimated` lub cache.

## 8. Kroki implementacji
1. Dodać endpoint file dla tej trasy: `src/pages/api/goals/[goalId]/progress.ts`.
2. W pliku endpointa:
   - `export const prerender = false`.
   - Dodać `goalIdSchema` (`z.string().uuid()`), analogicznie do [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts).
   - Dodać `getGoalProgressQuerySchema` z domyślnymi wartościami (`sort`, `order`, `page`, `pageSize`).
3. Utworzyć serwis w `src/lib/services`:
   - Preferowane: nowy plik `src/lib/services/goal-progress.service.ts` (żeby nie rozdymać istniejącego serwisu celów).
   - Zaimplementować funkcję `listGoalProgress(supabase, userId, goalId, query)`.
4. W serwisie:
   - Sprawdzić dostęp do celu (select z `goals` po `id` + `user_id`).
   - Pobierać wpisy z `goal_progress` z paginacją i sortowaniem.
   - Mapować `value` do `string`.
5. W endpoint:
   - Wywołać serwis i zwrócić `200` z `GetGoalProgressResponseDto`.
   - Mapować błędy serwisu (`goal_not_found`, `database_error`) na 404/500.
6. Dodać/uzupełnić scenariusze testowe manualne (curl/HTTP client):
   - 200 z `order=asc/desc`.
   - 400 dla błędnych parametrów.
   - 404 dla cudzych/nieistniejących celów.
   - 401 dla braku tokenu (po włączeniu produkcyjnej autentykacji).
