# API Endpoint Implementation Plan: GET `/api/goals/:goalId`

## 1. Przegląd punktu końcowego
Endpoint `GET /api/goals/:goalId` zwraca szczegóły pojedynczego celu dla aktualnie uwierzytelnionego użytkownika. Odpowiedź zawiera:

- pola źródłowe z tabeli `public.goals` (zgodnie z `GoalPublicFieldsDto`),
- obiekt `computed` wyliczony na podstawie `public.goal_progress` oraz `deadline` (zgodnie z `GoalComputedDetailsDto`).

Kluczowe wymagania kontraktu:

- `200` dla sukcesu,
- `401` gdy brak uwierzytelnienia,
- `404` gdy zasób nie istnieje lub nie należy do użytkownika (w praktyce: „not found”).

Stack i reguły implementacji:

- Astro Server Endpoints (handler `GET`, `export const prerender = false`),
- Supabase (Postgres + Auth + RLS),
- walidacja wejścia przez Zod,
- logika DB i mapowanie DTO w serwisie w [src/lib/services](src/lib/services).

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/goals/:goalId`
- Headers:
  - `Authorization: Bearer <access_token>`
- Query params: brak
- Request body: brak

### Parametry
- Wymagane:
  - `goalId` (path param): UUID celu
- Opcjonalne:
  - brak

### Walidacja danych wejściowych (Zod)
Walidacja dotyczy tylko `goalId`:

- `goalId`: `z.string().uuid()`

Rekomendowany mapping statusów:

- niepoprawny UUID w `goalId` → `400 Bad Request` (`invalid_path_params`)

## 3. Szczegóły odpowiedzi

### Sukces (200)
Body musi być zgodne z typem `GetGoalResponseDto` w [src/types.ts](src/types.ts).

Wymagany kształt:

```json
{
  "data": {
    "goal": {
      "id": "uuid",
      "parent_goal_id": "uuid|null",
      "name": "Run 100 km",
      "target_value": "100",
      "deadline": "2026-01-31",
      "status": "active",
      "reflection_notes": "...",
      "ai_summary": null,
      "abandonment_reason": null,
      "created_at": "...",
      "updated_at": "...",
      "computed": {
        "current_value": "45",
        "progress_ratio": 0.45,
        "progress_percent": 45,
        "is_locked": true,
        "days_remaining": 12,
        "entries_count": 4
      }
    }
  }
}
```

Reguły liczb i pól:

- `target_value` i `computed.current_value` muszą być `DecimalString` (string), mimo że DB przechowuje `decimal` jako `number`.
- `computed.entries_count` to liczba wpisów w `goal_progress` dla celu.
- `computed.is_locked = entries_count >= 1`.
- `computed.progress_ratio = current_value / target_value` (number, $0..n$).
- `computed.progress_percent = Math.round(progress_ratio * 100)`.
- `computed.days_remaining` to różnica w dniach między `deadline` (date) a „dzisiaj” (może być ujemna).

### Błędy
Zgodnie ze specyfikacją i zasadami statusów w projekcie:

- `401 Unauthorized` – brak/niepoprawna autentykacja.
- `404 Not Found` – cel nie istnieje lub nie należy do użytkownika.
- `400 Bad Request` – niepoprawny `goalId` (nie-UUID).
- `500 Internal Server Error` – nieoczekiwany błąd po stronie serwera.

Format błędu: `ApiErrorDto` z [src/types.ts](src/types.ts).

## 4. Przepływ danych

### 4.1 Warstwa API (Astro route)
- Nowy plik routingu: [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts)
- Wymagania:
  - `export const prerender = false`
  - `export async function GET(context: APIContext)`
  - pobranie parametru `goalId` z `context.params`
  - walidacja Zod w routingu
  - wywołanie serwisu w [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts)

### 4.2 Uwierzytelnianie
Wariant docelowy (produkcyjny, Bearer token):

1. Odczytaj `Authorization`.
2. Jeśli brak lub nie w formacie `Bearer ...` → `401`.
3. Zweryfikuj token przez `context.locals.supabase.auth.getUser(token)`.
4. Jeśli błąd lub `user=null` → `401`.

Uwaga dot. środowiska dev:

- W repo istnieje migracja wyłączająca RLS w dev. Niezależnie od RLS, endpoint powinien wymuszać własność przez `eq('user_id', user.id)` w zapytaniu do `goals`, aby nie zwrócić cudzych danych.

### 4.3 Serwis domenowy (wydzielenie logiki)
W [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts) dodać funkcję serwisową dla szczegółów celu, np.:

- `getGoalDetails(supabase, userId, goalId): Promise<GoalDetailsDto>`

Zakres odpowiedzialności serwisu:

- pobranie rekordu `goals` po `id` z narzuconym `user_id = userId`,
- pobranie danych z `goal_progress` dla `goalId` (co najmniej: wartości do sumy i liczność),
- wyliczenie `computed` (w tym `entries_count`),
- mapowanie pól dziesiętnych na string (`DecimalString`).

### 4.4 Dostęp do DB (Supabase)

Krok A: pobranie celu

- tabela: `public.goals`
- warunki:
  - `eq('id', goalId)`
  - `eq('user_id', userId)`
- wybierane pola (spójne z `GoalPublicFieldsDto`):
  - `id, parent_goal_id, name, target_value, deadline, status, reflection_notes, ai_summary, abandonment_reason, created_at, updated_at`
- metoda:
  - `.maybeSingle()` (żeby odróżnić brak danych od błędu zapytania)
- jeśli brak danych → `404` (nie ujawniamy czy cudzy rekord istnieje).

Krok B: podsumowanie progress

- tabela: `public.goal_progress`
- filtr: `eq('goal_id', goalId)`
- minimalny zestaw danych:
  - `select('value')` i policzyć:
    - `entries_count = liczba rekordów`
    - `current_value = suma(value)`

Opcjonalna optymalizacja (gdy wpisów rośnie):

- przenieść agregację do DB (RPC / view) aby nie pobierać wszystkich `value`.

### 4.5 Obliczenia `computed`
Obliczenia muszą być spójne z typami w [src/types.ts](src/types.ts) oraz analogiczne do listy (`listGoals`) z [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts):

- `entries_count`: liczba wpisów progress.
- `current_value`: suma `goal_progress.value` → renderować jako `String(sum)`.
- `progress_ratio`: $current\_value / target\_value$.
- `progress_percent`: $\text{round}(progress\_ratio * 100)$.
- `is_locked`: `entries_count >= 1`.
- `days_remaining`:
  - traktuj `deadline` jako datę bez czasu (ustaw 00:00:00),
  - traktuj „today” analogicznie,
  - $\lfloor(deadline - today) / 86400000\rfloor$.

## 5. Względy bezpieczeństwa

### AuthN / AuthZ
- Wymagaj uwierzytelnienia (Bearer token) → brak tokenu = `401`.
- Autoryzacja przez własność zasobu:
  - zawsze filtruj `goals.user_id = user.id` (nawet w dev z wyłączonym RLS).
- Nie ujawniaj istnienia zasobów innych użytkowników:
  - „nie należy do użytkownika” traktować jak `404`.

### IDOR
- `goalId` to identyfikator wrażliwy (łatwy do zgadywania/pozyskania). Warunek `user_id` jest obowiązkowy.

### Walidacja wejścia
- `goalId` musi być UUID (brak dodatkowych parametrów zmniejsza powierzchnię ataku).

### Dane w logach
- Nie logować tokenów z `Authorization`.
- W logach błędów dopuszczalne: endpoint, `goalId`, `userId` (jeśli dostępny), kod błędu Supabase.

## 6. Obsługa błędów

### Envelope
Wszystkie błędy zwracać jako `ApiErrorDto`:

```json
{ "error": { "code": "...", "message": "...", "details": {} } }
```

### Scenariusze błędów i statusy
- `400 invalid_path_params`
  - `goalId` nie jest UUID.
- `401 unauthenticated`
  - brak `Authorization` lub błędny format,
  - token niepoprawny/wygasły,
  - `supabase.auth.getUser(token)` zwraca błąd.
- `404 goal_not_found`
  - brak rekordu `goals` o `id=goalId` z `user_id=user.id`.
- `500 internal_error`
  - błąd zapytań Supabase (`error`),
  - nieobsłużony wyjątek.

### Rejestrowanie błędów w tabeli
W obecnym schemacie nie ma tabeli błędów (np. `error_events`), więc:

- MVP: `console.error(...)` w route/serwisie,
- jeśli w przyszłości wymagane: dodać osobną tabelę audyt/logs lub integrację z narzędziem obserwowalności.

## 7. Wydajność

- Docelowo endpoint powinien wykonać maks. 2 zapytania:
  1) `goals` (po `id` + `user_id`),
  2) `goal_progress` (po `goal_id`) do podsumowania.

Potencjalne wąskie gardła:

- duża liczba wpisów w `goal_progress` → pobieranie wszystkich `value` do sumy może być kosztowne.

Mitigacje (gdy zajdzie potrzeba):

- agregacja po stronie DB (RPC/view) zwracająca `sum(value)` i `count(*)` bez transferu wszystkich rekordów,
- cache po stronie klienta (UI) lub ETag (tylko jeśli spec produktu tego wymaga).

## 8. Kroki implementacji
1. Utwórz route dla szczegółów:
   - plik: [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts)
   - dodaj `export const prerender = false`.

2. Dodaj walidację `goalId` przez Zod:
   - odczyt `context.params.goalId`,
   - jeśli walidacja nie przejdzie → odpowiedź `400` (`invalid_path_params`).

3. Dodaj uwierzytelnianie:
   - pobierz i zweryfikuj Bearer token,
   - jeśli brak/wadliwy → `401`.

4. Wyodrębnij logikę do serwisu w [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts):
   - dodaj `getGoalDetails(supabase, userId, goalId)` zwracające `GoalDetailsDto`.

5. Implementuj pobranie celu (DB):
   - `from('goals').select(...).eq('id', goalId).eq('user_id', userId).maybeSingle()`
   - brak danych → rzuć błąd domenowy mapowany na `404`.

6. Implementuj podsumowanie progress (DB + obliczenia):
   - `from('goal_progress').select('value').eq('goal_id', goalId)`
   - policz `entries_count` oraz `current_value`.

7. Zbuduj DTO odpowiedzi:
   - mapuj `target_value` i `current_value` na string,
   - wylicz `progress_ratio`, `progress_percent`, `days_remaining`, `is_locked`, `entries_count`.

8. Zwróć odpowiedź `200` jako `GetGoalResponseDto`.

9. Dodaj obsługę błędów w route:
   - mapowanie błędów serwisu na `404` / `500`,
   - `console.error` bez logowania tokenów.

10. Scenariusze weryfikacji (manual/integration):
   - `200` dla istniejącego celu użytkownika,
   - `401` bez tokenu lub z tokenem nieważnym,
   - `400` dla `goalId` nie-UUID,
   - `404` dla nieistniejącego celu oraz dla celu innego użytkownika.
