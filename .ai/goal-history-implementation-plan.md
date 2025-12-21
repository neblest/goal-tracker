# API Endpoint Implementation Plan: GET /api/goals/:goalId/history

## 1. Przegląd punktu końcowego
Endpoint zwraca listę wszystkich iteracji (wersji) celu należących do tego samego „łańcucha historii” co `goalId`. Łańcuch jest definiowany przez relację samoodwołującą `goals.parent_goal_id`:
- „root” łańcucha to rekord, którego `parent_goal_id IS NULL`.
- kolejne iteracje to potomkowie root’a (rekurencyjnie po `parent_goal_id`).

Wynik ma być sortowalny po `created_at` oraz zawierać minimalny zestaw pól celu + `computed.current_value` (suma wpisów w `goal_progress`) oraz `ai_summary`.

## 2. Szczegóły żądania
- Metoda HTTP: GET
- Struktura URL: `/api/goals/:goalId/history`
- Parametry:
  - Wymagane:
    - `goalId` (path param): UUID
  - Opcjonalne (query params):
    - `sort`: `created_at` (domyślnie `created_at`; inne wartości niedozwolone)
    - `order`: `asc | desc` (rekomendowana domyślna: `asc`, aby zwracać historię chronologicznie)
- Request Body: brak

## 3. Wykorzystywane typy
### 3.1. DTO (response)
Dodać do [src/types.ts](src/types.ts):
- `GetGoalHistoryQueryDto`
  - `sort?: "created_at"`
  - `order?: "asc" | "desc"`
- `GoalHistoryItemDto`
  - `id: string`
  - `parent_goal_id: string | null`
  - `name: string`
  - `status: GoalStatus`
  - `deadline: string` (YYYY-MM-DD)
  - `computed: { current_value: DecimalString }`
  - `ai_summary: string | null`
- `GetGoalHistoryResponseDto = ApiSuccessDto<{ items: GoalHistoryItemDto[] }>`

Uwagi dot. typów:
- `current_value` musi być zwracane jako `DecimalString` (spójnie z resztą API), mimo że w DB jest `decimal`.
- W specyfikacji response nie ma `target_value` ani innych pól — nie dodawać ich do payloadu.

### 3.2. Command modele
Dla GET nie ma request body — nie tworzyć Command.

## 4. Szczegóły odpowiedzi
### 4.1. Sukces (200)
Zwrócić JSON:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "parent_goal_id": "uuid|null",
        "name": "Run 100 km",
        "status": "completed_failure",
        "deadline": "2026-01-31",
        "computed": { "current_value": "60" },
        "ai_summary": "..."
      }
    ]
  }
}
```

### 4.2. Błędy
- `400` dla nieprawidłowych danych wejściowych (np. niepoprawny UUID, niepoprawne query params)
- `401` dla braku/niepoprawnej autentykacji
- `404` gdy `goalId` nie istnieje lub nie należy do zalogowanego użytkownika
- `500` dla błędów serwera/DB

## 5. Przepływ danych
### 5.1. Warstwa route (Astro API)
Plik: utworzyć [src/pages/api/goals/[goalId]/history.ts](src/pages/api/goals/%5BgoalId%5D/history.ts)

Kroki w handlerze `GET(context)`:
1. Walidacja `goalId` (Zod: `z.string().uuid()`), błąd → `400` (`invalid_path_params`).
2. Walidacja query params:
   - `sort`: enum tylko `created_at`, default `created_at`
   - `order`: enum `asc|desc`, default `asc`
   Błąd → `400` (`invalid_query_params`).
3. Autentykacja użytkownika (Supabase Auth):
   - Odczytać `Authorization: Bearer <token>`.
   - `supabase.auth.getUser(token)`.
   - Brak/niepoprawny token → `401` (`unauthenticated`).
   (W dev repo istnieje „DEV_USER_ID shortcut”; ten endpoint powinien docelowo iść ścieżką produkcyjną, analogicznie do pozostałych route’ów.)
4. Wywołać serwis: `listGoalHistory(supabase, user.id, goalId, query)`.
5. Zwrócić `200` z `GetGoalHistoryResponseDto`.

### 5.2. Warstwa service
Utworzyć nowy serwis (rekomendowane) w [src/lib/services/goal-history.service.ts](src/lib/services/goal-history.service.ts) albo dodać funkcję do istniejącego [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts).

Rekomendowany podpis:
- `listGoalHistory(supabase: SupabaseClient, userId: string, goalId: string, query: GetGoalHistoryQueryDto): Promise<{ items: GoalHistoryItemDto[] }>`

Logika serwisu (wariant preferowany — 1 zapytanie rekurencyjne + 1 agregacja):
1. Sprawdzić dostęp do `goalId`:
   - `select id from goals where id = goalId and user_id = userId`.
   - jeśli brak → throw `goal_not_found` (mapowane na `404`).
2. Pobranie całego łańcucha historii przez rekurencję (CTE):
   - Najpierw znaleźć root dla `goalId` idąc „w górę” po `parent_goal_id`.
   - Następnie od root’a zejść „w dół” po `parent_goal_id`, zbierając wszystkie potomne cele.

Ponieważ Supabase JS nie wspiera bezpośrednio CTE w `.from().select()`, zastosować jedno z podejść:

**Podejście A (zalecane): funkcja SQL + `supabase.rpc`**
- Dodać migrację SQL tworzącą funkcję `public.get_goal_history(p_goal_id uuid)` zwracającą zestaw rekordów `goals` w ramach łańcucha.
- Następnie w serwisie: `supabase.rpc("get_goal_history", { p_goal_id: goalId })`.
- Po stronie aplikacji posortować przez `.sort()` jeśli funkcja nie przyjmuje parametrów sortowania.

**Podejście B: funkcja SQL z parametrami sortowania**
- Funkcja `public.get_goal_history(p_goal_id uuid, p_order text)` wykonuje `ORDER BY created_at` wg parametru.
- W serwisie przekazać `order`.

3. Dla listy goalId’ów z historii policzyć `current_value`:
   - Jedno zapytanie do `goal_progress`:
     - `select goal_id, value from goal_progress where goal_id in (...)`
   - Zgrupować po `goal_id`, zsumować `value`.
   - Zmapować do `DecimalString`.
   Alternatywa (wydajniejsza, jeżeli w SQL): policzyć `current_value` w funkcji SQL poprzez `LEFT JOIN goal_progress` + `GROUP BY`.
4. Zbudować `GoalHistoryItemDto[]`:
   - w `computed` umieścić tylko `current_value`.
5. Zwrócić `{ items }`.

## 6. Względy bezpieczeństwa
- Autentykacja: wymagany Bearer token, zwrot `401` gdy brak/niepoprawny.
- Autoryzacja / ochrona przed IDOR:
  - Jawnie weryfikować `user_id` przy sprawdzeniu dostępu do `goalId`.
  - Jeśli używana jest funkcja SQL (`rpc`): preferować **SECURITY INVOKER** (domyślnie) tak, aby RLS na `goals` i `goal_progress` nadal obowiązywał.
  - Nie używać `SECURITY DEFINER` bez ścisłych kontroli `auth.uid()` i ustawionego `search_path`.
- Walidacja wejścia:
  - UUID w path.
  - `sort` i `order` whitelistowane.
- Ograniczenie ujawniania informacji:
  - Dla zasobów nie należących do usera zwracać `404` (nie „forbidden”), spójnie z obecnymi serwisami.

## 7. Obsługa błędów
### 7.1. Mapowanie błędów (route)
- Zod path/query fail → `400`:
  - `invalid_path_params` / `invalid_query_params`
- Auth brak/niepoprawny → `401`:
  - `unauthenticated`
- Serwis rzuca `goal_not_found` → `404`
- Serwis rzuca `database_error` → `500`
- Inne nieoczekiwane wyjątki → `500` (`internal_error`)

### 7.2. Rejestrowanie błędów
W obecnym schemacie DB nie ma opisanej tabeli na logi błędów — traktować jako **nie dotyczy**.
- Logowanie minimalne: `console.error("GET /api/goals/:goalId/history error:", error)` (spójnie z istniejącymi route’ami).
- Jeśli w przyszłości pojawi się tabela błędów / obserwowalność: dodać centralny helper logger w `src/lib` i wywoływać go w `catch`.

## 8. Wydajność
- Rekurencja w DB:
  - Wykorzystać istniejące indeksy: `goals_parent_goal_id_idx` (dla zejścia w dół) oraz `goals_user_id_idx`.
  - Dodać ochronę przed cyklami danych:
    - w CTE trzymać `path` (tablica uuid) i odfiltrowywać powtórzenia (`WHERE NOT child.id = ANY(path)`),
    - opcjonalnie limit głębokości (np. 100) jako bezpiecznik.
- Unikać N+1:
  - `current_value` liczyć zbiorczo (1 query na `goal_progress` albo agregacja w SQL).
- Sortowanie:
  - Sortować po `created_at` w DB (preferowane) lub w aplikacji (jeżeli RPC zwraca niesortowane dane).

## 9. Kroki implementacji
1. Dodać typy do [src/types.ts](src/types.ts): `GetGoalHistoryQueryDto`, `GoalHistoryItemDto`, `GetGoalHistoryResponseDto`.
2. Utworzyć route [src/pages/api/goals/[goalId]/history.ts](src/pages/api/goals/%5BgoalId%5D/history.ts):
   - `export const prerender = false`
   - Zod walidacja `goalId` i query
   - Autentykacja przez `Authorization` i `supabase.auth.getUser`
   - Wywołanie serwisu i mapowanie błędów na statusy.
3. Utworzyć serwis [src/lib/services/goal-history.service.ts](src/lib/services/goal-history.service.ts) i zaimplementować `listGoalHistory`.
4. Dodać migrację SQL tworzącą funkcję `public.get_goal_history(...)` opartą o `WITH RECURSIVE`:
   - krok 1: `ancestors` do znalezienia root
   - krok 2: `descendants` od root’a w dół
   - (opcjonalnie) agregacja `current_value` w SQL.
5. Podłączyć serwis w route i dopiąć typowanie odpowiedzi (`satisfies GetGoalHistoryResponseDto`).
6. Dopisać scenariusze testowe (manualne / Postman):
   - 200 dla istniejącego `goalId` (różne `order`)
   - 400 dla nieprawidłowego UUID
   - 400 dla `sort != created_at`
   - 401 bez tokena
   - 404 dla nieistniejącego `goalId`.
