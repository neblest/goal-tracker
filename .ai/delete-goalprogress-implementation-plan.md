# API Endpoint Implementation Plan: DELETE /api/progress/:progressId

## 1. Przegląd punktu końcowego
Endpoint usuwa istniejący wpis postępu (`goal_progress`) identyfikowany przez `progressId`. Usunięcie jest dozwolone wyłącznie wtedy, gdy powiązany cel jest w statusie `active` oraz wpis należy do celu użytkownika.

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: `/api/progress/:progressId`
- Parametry:
  - Wymagane:
    - `progressId` (path) — UUID
- Request body: brak

**Wykorzystywane typy (src/types.ts)**
- `DeleteProgressResponseDto` (alias dla 204 bez body)
- `ApiErrorDto`

## 3. Szczegóły odpowiedzi
- 204 No Content
  - Bez body
- Błędy:
  - 400 — nieprawidłowe `progressId`
  - 401 — brak autentykacji
  - 404 — wpis nie znaleziony (lub brak dostępu)
  - 409 — powiązany cel nie jest `active`
  - 500 — błąd serwera / bazy

## 4. Przepływ danych
1. Route waliduje `progressId` jako UUID.
2. Autentykacja użytkownika.
3. Serwis:
   - Pobiera wpis postępu i powiązany cel (jak w PATCH):
     - Jeśli brak wpisu lub cel nie należy do usera → `progress_not_found`.
     - Jeśli cel `status !== 'active'` → `goal_not_active`.
   - Wykonuje `delete` na `goal_progress`.
4. Route zwraca `204`.

## 5. Względy bezpieczeństwa
- 401 bez tokenu.
- 404 dla braku wpisu lub braku dostępu (nie ujawniać, że rekord istnieje).
- 409 dla celu nieaktywnego.
- W dev RLS wyłączone — konieczne jawne sprawdzanie ownership w serwisie.

## 6. Obsługa błędów
- 400 `invalid_path_params` — `progressId` nie jest UUID.
- 401 `unauthenticated` — brak/niepoprawny token.
- 404 `progress_not_found` — wpis nie istnieje lub nie należy do użytkownika.
- 409 `goal_not_active` — cel powiązany nie jest `active`.
- 500 `internal_error` — błąd DB lub nieoczekiwany błąd.

**Rejestrowanie błędów (tabela błędów):**
- Brak tabeli błędów; logować przez `console.error` w route.

## 7. Wydajność
- Operacja usunięcia jest O(1) po PK.
- Optymalizacja: minimalizować liczbę zapytań (preferować pobranie wymaganych informacji jednym selectem, jeśli relacje PostgREST są dostępne).

## 8. Kroki implementacji
1. W pliku `src/pages/api/progress/[progressId].ts` dodać handler `DELETE` obok `PATCH`.
2. Dodać `progressIdSchema` i współdzielić walidację z handlerem `PATCH`.
3. W serwisie [src/lib/services/goal-progress.service.ts](src/lib/services/goal-progress.service.ts) dodać `deleteProgressEntry(supabase, userId, progressId)`:
   - Lookup wpisu + weryfikacja celu (ownership + status).
   - Delete.
4. W route:
   - Mapować `progress_not_found` → 404, `goal_not_active` → 409, `database_error` → 500.
   - Zwrócić `new Response(null, { status: 204 })`.
5. Manualne testy:
   - 204 dla aktywnego celu.
   - 409 dla nieaktywnego celu.
   - 404 dla nieistniejącego/cudzego wpisu.
