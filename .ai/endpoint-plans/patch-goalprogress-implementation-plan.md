# API Endpoint Implementation Plan: PATCH /api/progress/:progressId

## 1. Przegląd punktu końcowego
Endpoint edytuje istniejący wpis postępu (`goal_progress`) identyfikowany przez `progressId`. Edycja jest dozwolona wyłącznie wtedy, gdy powiązany cel (`goals`) ma status `active` oraz wpis należy do celu należącego do aktualnego użytkownika. Endpoint aktualizuje tylko podane pola (`value`, `notes`).

## 2. Szczegóły żądania
- Metoda HTTP: PATCH
- Struktura URL: `/api/progress/:progressId`
- Parametry:
  - Wymagane:
    - `progressId` (path) — UUID
- Request body (JSON):
  - Opcjonalne:
    - `value`: `DecimalString` (> 0)
    - `notes`: string
  - Wymaganie domenowe: musi być podane co najmniej jedno pole.

Przykład:
```json
{ "value": "12", "notes": "Updated note" }
```

**Wykorzystywane typy (src/types.ts)**
- `UpdateProgressCommand`
- `UpdateProgressResponseDto`
- `GoalProgressEntryDto` (częściowo)
- `ApiErrorDto`
- `DecimalString`

## 3. Szczegóły odpowiedzi
- 200 OK
  - JSON:
    ```json
    { "data": { "progress": { "id": "uuid", "value": "12", "notes": "Updated note", "updated_at": "..." } } }
    ```
- Błędy:
  - 400 — nieprawidłowe `progressId`
  - 401 — brak autentykacji
  - 404 — wpis nie znaleziony (lub brak dostępu)
  - 409 — powiązany cel nie jest `active`
  - 422 — walidacja body (w tym invalid JSON / puste body)
  - 500 — błąd serwera / bazy

## 4. Przepływ danych
1. Route waliduje `progressId` jako UUID.
2. Route parsuje JSON body:
   - invalid JSON → `422 validation_error`.
3. Route waliduje body przez Zod:
   - `value` (jeśli obecne): decimal string, `> 0`.
   - `notes` (jeśli obecne): string (zalecany limit, np. 2000).
   - `.strict()` oraz `.refine(Object.keys(data).length > 0)`.
4. Autentykacja (Bearer token lub dev `DEV_USER_ID`).
5. Serwis:
   - Pobiera rekord `goal_progress` oraz powiązany cel w celu weryfikacji ownership i statusu.
     - Podejście A (czytelne):
       1) `select goal_id, value, notes, updated_at from goal_progress where id=:progressId`.
       2) `select id, user_id, status from goals where id=:goalId`.
     - Podejście B (jedno zapytanie): select z relacją FK `goal_progress -> goals` (jeśli PostgREST relacje są poprawnie wykryte).
   - Jeśli wpis nie istnieje lub cel nie jest użytkownika: `progress_not_found` → 404.
   - Jeśli cel ma status != `active`: `goal_not_active` → 409.
   - Wykonuje update:
     - `value` zapisywane jako `number` (`parseFloat`), `notes` bez zmian.
     - Zwraca `id`, `goal_id` (opcjonalnie), `value`, `notes`, `updated_at`.
   - Konwertuje `value` w odpowiedzi do string.
6. Route zwraca `200` z `UpdateProgressResponseDto`.

## 5. Względy bezpieczeństwa
- Uwierzytelnianie: 401 bez poprawnego tokenu.
- Autoryzacja: wpis musi należeć do celu użytkownika.
  - Docelowo RLS na `goal_progress` wymusza to, ale w dev RLS jest wyłączone, więc wymagane są jawne sprawdzenia w serwisie.
- Reguła biznesowa: brak edycji, gdy cel nie jest `active` (409).
- Minimalizacja informacji: dla braku dostępu zwracać `404` (zgodnie ze spec).

## 6. Obsługa błędów
- 400 `invalid_path_params` — `progressId` nie jest UUID.
- 401 `unauthenticated` — brak/niepoprawny token.
- 404 `progress_not_found` — wpis nie istnieje lub nie należy do użytkownika.
- 409 `goal_not_active` — cel powiązany nie jest `active`.
- 422 `validation_error` — invalid JSON, puste body, `value <= 0`.
- 500 `internal_error` — błąd DB lub nieoczekiwany błąd.

**Rejestrowanie błędów (tabela błędów):**
- Brak tabeli błędów w DB; `console.error` w route + opcjonalna integracja z APM.

## 7. Wydajność
- Update to O(1).
- Jeśli użyte są 2 zapytania (pobranie progress + pobranie celu), to stały narzut; możliwe do zoptymalizowania do 1 zapytania z relacją.
- Indeksy:
  - PK na `goal_progress.id` wspiera lookup wpisu.
  - Indeks `goals_user_id_idx` wspiera weryfikację ownership.

## 8. Kroki implementacji
1. Dodać endpoint file: `src/pages/api/progress/[progressId].ts` z `export const prerender = false`.
2. W endpoint:
   - `progressIdSchema = z.string().uuid()`.
   - `updateProgressSchema`:
     - `value` jako decimal string `> 0`.
     - `notes` optional.
     - `.strict()` + `.refine(atLeastOneField)`.
3. Utworzyć/rozszerzyć serwis [src/lib/services/goal-progress.service.ts](src/lib/services/goal-progress.service.ts):
   - `updateProgressEntry(supabase, userId, progressId, command)`.
4. W serwisie:
   - Pobierać progress + cel, weryfikować ownership i `status === 'active'`.
   - Wykonać update i zwrócić DTO.
5. W endpoint:
   - Mapować błędy serwisu na 404/409/500.
   - Zwrócić 200 z `UpdateProgressResponseDto`.
6. Manualne testy:
   - 200 dla aktywnego celu.
   - 409 gdy cel `abandoned/completed_*`.
   - 404 dla nieistniejącego/cudzego wpisu.
   - 422 dla `{}` lub invalid JSON.
