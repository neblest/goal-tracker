# API Endpoint Implementation Plan: POST /api/goals/:goalId/progress

## 1. Przegląd punktu końcowego
Endpoint dodaje nowy wpis postępu (`goal_progress`) do wskazanego celu. Dozwolone jest to wyłącznie dla celu w statusie `active`. Po utworzeniu wpisu zwraca metadane nowego wpisu, podstawowe dane celu (id + status) oraz wartości obliczone: `current_value` i `progress_percent`.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/api/goals/:goalId/progress`
- Parametry:
  - Wymagane:
    - `goalId` (path) — UUID
- Request body (JSON):
  - Wymagane:
    - `value`: `DecimalString` (musi być > 0)
  - Opcjonalne:
    - `notes`: string

Przykład:
```json
{ "value": "10", "notes": "Optional note" }
```

**Wykorzystywane typy (src/types.ts)**
- `CreateGoalProgressCommand`
- `CreateGoalProgressResponseDto`
- `ApiErrorDto`
- `DecimalString`

## 3. Szczegóły odpowiedzi
- 201 Created
  - JSON:
    ```json
    {
      "data": {
        "progress": { "id": "uuid", "goal_id": "uuid", "value": "10", "notes": "Optional note" },
        "goal": { "id": "uuid", "status": "active" },
        "computed": { "current_value": "55", "progress_percent": 55 }
      }
    }
    ```
- Błędy:
  - 400 — nieprawidłowe `goalId`
  - 401 — brak autentykacji
  - 404 — cel nie znaleziony / brak dostępu
  - 409 — cel nie jest `active` (nie można dodać postępu)
  - 422 — walidacja request body (`value` musi być > 0; invalid JSON)
  - 500 — błąd serwera / bazy

## 4. Przepływ danych
1. Route waliduje `goalId` (UUID).
2. Route parsuje JSON body:
   - Jeśli JSON niepoprawny: `422 validation_error`.
3. Route waliduje body przez Zod:
   - `value`: string, format liczby dziesiętnej, `parseFloat(value) > 0`.
   - `notes`: opcjonalne (zalecane `.trim()` + rozsądny limit długości, np. 2000 znaków).
   - Jeśli nie przejdzie: `422 validation_error`.
4. Route wykonuje autentykację (Bearer token; obecnie dopuszczony dev pattern z `DEV_USER_ID`).
5. Serwis wykonuje logikę domenową:
   - Pobiera cel: `select id, status from goals where id=:goalId and user_id=:userId`.
   - Jeśli brak: `goal_not_found` → `404`.
   - Jeśli `status !== 'active'`: `goal_not_active` → `409`.
6. Serwis tworzy wpis postępu:
   - `insert into goal_progress(goal_id, value, notes)`.
   - `value` zapisywane jako `number` (`parseFloat(command.value)`), ale w odpowiedzi zwracane jako string.
7. Serwis oblicza `current_value` i `progress_percent`:
   - Minimalna (MVP) opcja: pobrać `value` wszystkich wpisów dla `goalId` i zsumować w aplikacji.
   - Preferowana (skalowalna) opcja: użyć agregacji po stronie DB (PostgREST aggregate jeśli dostępne) albo dodać funkcję SQL/RPC do sumowania (wymaga migracji, jeśli zdecydujecie się na to podejście).
   - `progress_percent = round((current_value / target_value) * 100)`.
8. Route zwraca `201` z `CreateGoalProgressResponseDto`.

## 5. Względy bezpieczeństwa
- Uwierzytelnianie:
  - Wymagany `401` bez poprawnego tokenu.
- Autoryzacja:
  - Najpierw weryfikować `goals.user_id = userId` (nawet jeśli RLS jest włączone; w dev RLS jest wyłączone).
- Integralność domenowa:
  - Blokada dodawania postępu dla statusów innych niż `active` (409).
  - Nie ufać `goalId` z klienta — zawsze wiązać wpisy z celem sprawdzonym pod kątem ownership.
- Walidacja:
  - Odrzucić `value <= 0` (422).

## 6. Obsługa błędów
**Scenariusze i kody:**
- 400 `invalid_path_params` — `goalId` nie jest UUID.
- 401 `unauthenticated` — brak/niepoprawny token.
- 404 `goal_not_found` — cel nie istnieje lub nie należy do użytkownika.
- 409 `goal_not_active` — `goals.status !== 'active'`.
- 422 `validation_error` — invalid JSON lub body nie spełnia schematu.
- 500 `internal_error` — błąd DB/nieoczekiwany błąd.

**Rejestrowanie błędów (tabela błędów):**
- Brak dedykowanej tabeli błędów w schemacie; logować przez `console.error` i ewentualnie dodać obserwowalność w przyszłości.

## 7. Wydajność
- Wstawienie wpisu jest O(1).
- Obliczanie `current_value`:
  - MVP (sumowanie w aplikacji po pobraniu wpisów) jest O(n) po liczbie wpisów i może być kosztowne przy dużej historii.
  - Wersja docelowa: agregacja w DB (sum) ogranicza transfer danych.
- Warto rozważyć transakcyjność:
  - Supabase JS nie oferuje prostych transakcji wielozapytaniowych bez RPC; jeśli spójność jest krytyczna, rozważyć funkcję SQL (RPC), która: (a) sprawdza status celu, (b) insertuje wpis, (c) zwraca agregaty.

## 8. Kroki implementacji
1. W tym samym pliku co GET: `src/pages/api/goals/[goalId]/progress.ts` dodać handler `POST`.
2. Dodać schematy Zod:
   - `goalIdSchema` (współdzielony z GET w tym pliku).
   - `createGoalProgressSchema` dla body.
3. Utworzyć/rozszerzyć serwis w `src/lib/services/goal-progress.service.ts`:
   - `createGoalProgressEntry(supabase, userId, goalId, command)`.
   - W środku: weryfikacja celu + statusu, insert wpisu, obliczenie agregatów.
4. Ustalić implementację obliczeń:
   - MVP: pobrać `target_value` celu + wartości wpisów i policzyć.
   - Alternatywa: agregacja w DB lub RPC (opisać w PR jako optional follow-up).
5. Obsłużyć mapowanie błędów w route:
   - `goal_not_found` → 404
   - `goal_not_active` → 409
   - `database_error` → 500
6. Manualne testy:
   - 201 dla celu `active`.
   - 409 dla celu `abandoned/completed_*`.
   - 422 dla `value="0"` lub invalid JSON.
   - 404 dla cudzych/nieistniejących celów.
