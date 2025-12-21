# API Endpoint Implementation Plan: GET `/api/goals`

## 1. Przegląd punktu końcowego
Endpoint `GET /api/goals` zwraca stronicowaną listę celów aktualnie uwierzytelnionego użytkownika. Lista może być filtrowana po statusie, po relacji iteracji (`parent_goal_id`), ograniczana do „root goals”, przeszukiwana po nazwie oraz sortowana.

Dla każdego celu endpoint zwraca:
- pola z tabeli `public.goals` (publiczne, zgodnie z DTO)
- obiekt `computed` wyliczany na podstawie `public.goal_progress` oraz `deadline`

Wymagania kontraktu:
- `200` dla sukcesu
- `401` gdy brak uwierzytelnienia
- `400` dla niepoprawnych query params

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- URL: `/api/goals`
- Headers:
  - `Authorization: Bearer <access_token>`
- Request body: brak

### Parametry
Wszystkie parametry są opcjonalne.

- `status`: `active | completed_success | completed_failure | abandoned`
- `q`: wyszukiwanie po `name` (case-insensitive substring)
- `parentGoalId`: filtr po `parent_goal_id`
- `root`: jeśli `true`, tylko cele z `parent_goal_id = null`
- `sort`: `created_at` (domyślnie) | `deadline`
- `order`: `asc | desc` (domyślnie `desc`)
- `page`: domyślnie `1`
- `pageSize`: domyślnie `20`

### Zasady i konflikty parametrów (zalecane do ustandaryzowania)
- `root=true` i jednocześnie `parentGoalId` → `400` (konflikt filtrów)
- `page` i `pageSize` muszą być dodatnimi liczbami całkowitymi
- `pageSize` powinien mieć limit (np. max 100) aby ograniczyć koszt zapytań

## 3. Wykorzystywane typy
Źródło: `src/types.ts`.

### DTO
- `GetGoalsQueryDto`
- `GetGoalsResponseDto`
- `OffsetPaginatedDto<GoalListItemDto>`
- `GoalListItemDto`
- `GoalPublicFieldsDto`
- `GoalComputedListDto`
- `ApiErrorDto`
- `DecimalString`

### Typy DB
- `DbGoalRow` (`public.goals`)
- `DbGoalProgressRow` (`public.goal_progress`)
- `GoalStatus` (`public.goal_status`)

## 4. Szczegóły odpowiedzi

### Sukces (200)
Zwracany JSON ma format:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "parent_goal_id": "uuid|null",
        "name": "Run 100 km",
        "target_value": "100",
        "deadline": "2026-01-31",
        "status": "active",
        "reflection_notes": "...",
        "ai_summary": null,
        "abandonment_reason": null,
        "created_at": "2025-12-20T12:00:00Z",
        "updated_at": "2025-12-20T12:00:00Z",
        "computed": {
          "current_value": "45",
          "progress_ratio": 0.45,
          "progress_percent": 45,
          "is_locked": true,
          "days_remaining": 12
        }
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

Wymagania typów/liczb:
- `target_value` i `computed.current_value` muszą być `DecimalString` (string) zgodnie z planem API.
- `computed.progress_ratio = current_value / target_value` (number, $0..n$).
- `computed.progress_percent = round(progress_ratio * 100)` (number).
- `computed.is_locked = true` jeśli istnieje co najmniej 1 wpis w `goal_progress`.
- `computed.days_remaining` to liczba dni `deadline - today` (może być ujemna).

### Błędy
- `401` – not authenticated
- `400` – invalid query params
- `500` – server error

## 5. Przepływ danych

### 5.1 Warstwa API (Astro route)
- Plik: `src/pages/api/goals/index.ts`
- Zasady:
  - `export const prerender = false`
  - Handler musi być w formacie `export async function GET(context: APIContext)` (uppercase)
  - Walidacja wejścia Zod w route
  - Logika DB w serwisie `src/lib/services`

### 5.2 Uwierzytelnianie
1. Odczytaj `Authorization`.
2. Jeśli brak lub zły format (nie `Bearer ...`) → `401`.
3. Wywołaj `context.locals.supabase.auth.getUser(token)`.
4. Jeśli błąd / brak usera → `401`.

Uwaga środowiskowa:
- W repo istnieje migracja wyłączająca RLS w dev. Niezależnie od RLS, endpoint powinien wymuszać `goals.user_id = user.id` w zapytaniu, aby nie zwrócić cudzych danych w trybie dev.

### 5.3 Walidacja i normalizacja query params (Zod)
Podejście:
- Parsuj `URLSearchParams` do obiektu z wartościami typu string.
- Użyj Zod do walidacji oraz do domyślnych wartości.
- Dodatkowa walidacja konfliktu `root=true` + `parentGoalId`.

Rekomendowane zasady walidacji:
- `status`: enum
- `q`: trim, min 1, max np. 200
- `parentGoalId`: uuid
- `root`: akceptuj wyłącznie `"true"` lub `"false"`
- `sort`: enum `created_at|deadline` (default `created_at`)
- `order`: enum `asc|desc` (default `desc`)
- `page`: int >= 1 (default 1)
- `pageSize`: int >= 1 (default 20), max np. 100

Wynik walidacji mapuj do `GetGoalsQueryDto` (plus wartości domyślne) aby ujednolicić komunikację z serwisem.

### 5.4 Serwis domenowy
- Plik: `src/lib/services/goals.service.ts`
- Dodaj funkcję serwisową (nowa, obok `createGoal`):
  - `listGoals(supabase, userId, query)`

Zakres odpowiedzialności serwisu:
- budowa zapytania do `goals` z filtrami i paginacją
- pobranie danych do computed (progress)
- wyliczenie `computed` i mapowanie do DTO

### 5.5 Dostęp do DB (Supabase)

#### Krok A: pobranie celów + total
Zapytanie do `public.goals`:
- zawsze `eq('user_id', userId)`
- filtry:
  - `status` → `eq('status', status)`
  - `q` → `ilike('name', `%${q}%`)`
  - `parentGoalId` → `eq('parent_goal_id', parentGoalId)`
  - `root=true` → `is('parent_goal_id', null)`
- sort:
  - `order(sort, { ascending: order === 'asc' })`
  - domyślnie `created_at desc`
- paginacja:
  - `from = (page - 1) * pageSize`
  - `to = from + pageSize - 1`
  - `range(from, to)`
- count:
  - `select(fields, { count: 'exact' })`

Wybierane pola `goals` (zgodnie z `GoalPublicFieldsDto`):
- `id, parent_goal_id, name, target_value, deadline, status, reflection_notes, ai_summary, abandonment_reason, created_at, updated_at`

#### Krok B: dane do computed (`goal_progress`)
Dla `goalIds` z bieżącej strony:

MVP (najprostszy):
- pobierz `goal_progress` rekordy dla `goal_id IN goalIds`
- w JS policz per `goal_id`:
  - `entries_count`
  - `current_value = sum(value)`

Optymalizacja (gdy liczba wpisów rośnie):
- przenieś agregację do DB (RPC/view) i pobieraj tylko `sum` i `count`.

### 5.6 Obliczenia `computed`
Dla każdego celu:
- `current_value`: suma `goal_progress.value` (DecimalString)
- `progress_ratio`:
  - $ratio = current / target$
  - guard: jeśli target niepoprawny → `0` (nie powinno wystąpić przez CHECK w DB)
- `progress_percent`: `Math.round(ratio * 100)`
- `is_locked`: `entries_count >= 1`
- `days_remaining`: różnica dni między `deadline` (date) a „today”

Rekomendacja dot. obliczania dni:
- Traktuj `deadline` jako datę bez czasu (YYYY-MM-DD).
- Obliczaj „today” jako datę bez czasu (np. UTC midnight), aby uniknąć problemów stref czasowych.

## 6. Względy bezpieczeństwa
- Wymagaj tokena i waliduj przez Supabase Auth.
- Zawsze filtruj `goals.user_id = user.id` (nawet przy RLS wyłączonym w dev).
- Nie ufaj parametrom klienta w kontekście autoryzacji (client nie podaje userId).
- Ogranicz `pageSize` i długość `q` (mitigacja DoS).

Potencjalne zagrożenia:
- Zbyt duże `pageSize` → koszt zapytań i transferu
- `q` z `ilike` → ryzyko wolniejszych zapytań przy dużej liczbie rekordów
- RLS wyłączone w dev → ryzyko wycieku bez filtra `user_id`

## 7. Obsługa błędów

### Format błędu
Używaj `ApiErrorDto`:
```json
{ "error": { "code": "...", "message": "...", "details": { } } }
```

### Scenariusze błędów
- `401 unauthenticated`
  - brak `Authorization`
  - zły format `Authorization`
  - `getUser(token)` zwraca błąd lub `user=null`
- `400 invalid_query_params`
  - wartość spoza enum (`status`, `sort`, `order`)
  - niepoprawne `uuid` w `parentGoalId`
  - niepoprawne `root` (inne niż `true|false`)
  - `page`/`pageSize` <= 0 lub NaN
  - konflikt filtrów (`root=true` + `parentGoalId`)
- `500 internal_error`
  - błędy Supabase DB (`error` z query)
  - nieobsłużone wyjątki

### Rejestrowanie błędów (logging)
- W obecnym schemacie nie ma tabeli do logowania błędów aplikacyjnych.
- MVP:
  - `console.error` z kontekstem (endpoint, userId jeśli dostępny, query, supabase error).
- Opcjonalnie później:
  - dodać zewnętrzny system logowania/monitoringu albo tabelę `error_events`.

## 8. Wydajność
- Paginacja musi być zawsze aktywna (nawet bez parametrów → default `page=1`, `pageSize=20`).
- Minimalizuj ilość danych pobieranych z DB (wybieraj tylko wymagane kolumny).
- `goal_progress`:
  - MVP: liczenie w JS jest OK przy małym `pageSize`
  - skalowanie: agregacja po stronie DB (RPC/view) ogranicza transfer

## 9. Kroki implementacji
1. Dodaj handler `GET` w `src/pages/api/goals/index.ts` (zostaw `prerender=false`).
2. Zaimplementuj Zod schema dla query params + normalizacja typów + domyślne wartości.
3. Zaimplementuj auth (Bearer token) i zwracanie `401`.
4. Dodaj w `src/lib/services/goals.service.ts` funkcję `listGoals(...)` i przenieś do niej logikę DB.
5. W serwisie:
   - pobierz cele z `count: 'exact'` oraz `.range(from, to)`
   - pobierz wpisy `goal_progress` dla `goalIds`
   - wylicz `computed` i zmapuj pola decimal na string
6. W route:
   - zbuduj `GetGoalsResponseDto`
   - zwróć `200`.
7. Zaimplementuj obsługę błędów:
   - walidacja → `400`
   - auth → `401`
   - supabase/unexpected → `500` + log
8. Smoke testy (manual):
   - bez tokena → `401`
   - `?page=0` → `400`
   - `?root=true&parentGoalId=<uuid>` → `400`
   - `?status=active&sort=deadline&order=asc` → `200`
   - `?q=run` → `200` z filtrowaniem case-insensitive
