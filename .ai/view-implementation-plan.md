# API Endpoint Implementation Plan: POST /api/goals (Create Goal)

## 1. Przegląd punktu końcowego
- **Metoda / URL**: `POST /api/goals`
- **Cel**: Utworzenie nowego celu użytkownika (nowa iteracja celu). Może być celem „root” (`parent_goal_id = null`) albo kolejną iteracją istniejącego celu (`parent_goal_id = <uuid>`).
- **Własność danych**: Cel jest zawsze przypisany do aktualnie uwierzytelnionego użytkownika (`goals.user_id`). RLS w Supabase wymusza, że użytkownik widzi/modyfikuje tylko swoje rekordy.
- **Kontrakt typów**: request/response DTO są zdefiniowane w [src/types.ts](src/types.ts).
- **Stack**: Astro (Server Endpoints) + TypeScript + Supabase (Postgres + Auth + RLS). Szczegóły: [.ai/tech-stack.md](.ai/tech-stack.md).

## 2. Szczegóły żądania
- **Metoda HTTP**: POST
- **Struktura URL**: `/api/goals`
- **Headers (zalecane)**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <access_token>` (jeżeli aplikacja nie używa cookies do SSR; jeśli używa, to token pobierany z cookies)
- **Parametry**: brak w URL/query.
- **Request Body** (JSON):
  - **Wymagane**:
    - `name: string`
    - `target_value: string` (DecimalString; np. `"100"`)
    - `deadline: string` (format `YYYY-MM-DD`)
  - **Opcjonalne**:
    - `parent_goal_id?: string | null` (uuid albo `null`)

### Walidacja danych wejściowych (Zod)
W endpointzie należy zastosować Zod (zgodnie z regułami) do walidacji request body:
- `name`
  - `string`, `.trim()`, min 1
  - zalecany limit długości (np. 200–500 znaków) aby ograniczyć nadużycia (DoS/rozmiar payloadu).
- `target_value` (DecimalString)
  - `string`, niepuste
  - walidacja, że jest liczbą dziesiętną dodatnią (np. regex dla decimal + parsing)
  - reguła domenowa: `> 0` (spójne z CHECK w DB: `target_value > 0`).
- `deadline`
  - `string` w formacie `YYYY-MM-DD`
  - reguła domenowa: musi być w przyszłości względem „dzisiaj” (np. `deadline > today`), zgodnie ze spec.
  - uwaga: DB trzyma `date` (bez strefy); porównanie najlepiej wykonać w UTC na poziomie „daty”, bez czasu.
- `parent_goal_id`
  - `uuid` lub `null` lub brak pola

### Mapowanie do Command modelu
- Wejście mapuje się 1:1 do `CreateGoalCommand` z [src/types.ts](src/types.ts).

## 3. Wykorzystywane typy
Poniższe typy powinny być użyte w implementacji endpointu:
- **Request**: `CreateGoalCommand`
- **Response (201)**: `CreateGoalResponseDto`
- **Błędy (envelope)**:
  - `ApiErrorDto` / `ApiErrorBodyDto`
- **Pomocnicze**:
  - `DecimalString`
  - `GoalStatus` (dla domyślnego statusu `active` na DB)

## 4. Szczegóły odpowiedzi
### Sukces: 201 Created
- **Body**: `CreateGoalResponseDto`
- **Kształt** (zgodnie ze spec):
  ```json
  {
    "data": {
      "goal": {
        "id": "uuid",
        "status": "active",
        "name": "Run 100 km",
        "target_value": "100",
        "deadline": "2026-01-31",
        "parent_goal_id": null
      }
    }
  }
  ```
- **Uwagi**:
  - `target_value` w odpowiedzi musi pozostać stringiem (DecimalString), nawet jeśli DB przechowuje `decimal`.
  - `status` domyślnie `active` (DB default), ale można zwrócić wartość z DB.

### Błędy
Wymagane przez spec i reguły statusów:
- `401 Unauthorized` – brak/niepoprawna autentykacja.
- `422 Unprocessable Entity` – błąd walidacji semantycznej (np. `target_value <= 0`, `deadline` nie w przyszłości).
- `400 Bad Request` – niepoprawny JSON, brak `Content-Type: application/json`, złe typy pól na poziomie parsowania (opcjonalnie; reguły statusów w projekcie to dopuszczają).
- `404 Not Found` – jeśli podany `parent_goal_id` nie istnieje lub nie należy do użytkownika.
- `500 Internal Server Error` – nieoczekiwany błąd po stronie serwera.

> Uwaga o spójności: spec endpointu mówi o `422` dla walidacji; lista „prawidłowych kodów” w zadaniu zawiera `400`. Najprostsze pogodzenie: **400** dla błędów składni/transportu, **422** dla błędów reguł domenowych.

## 5. Przepływ danych
1. **Wejście requestu** do Astro Server Endpoint.
2. **Autentykacja**:
   - pobranie tokenu z `Authorization: Bearer ...` (lub z cookies – jeśli projekt ma już SSR auth),
   - weryfikacja tokenu i uzyskanie `user.id`.
3. **Walidacja Zod** request body.
4. **Walidacja `parent_goal_id` (jeśli podano)**:
   - sprawdzić, czy rekord istnieje i należy do użytkownika.
   - jeśli nie: 404.
5. **Insert do DB (Supabase)**:
   - insert do `public.goals` pól: `user_id`, `parent_goal_id`, `name`, `target_value`, `deadline`.
   - oczekiwanie na zwrot wstawionego rekordu (`select`) aby zbudować odpowiedź.
6. **Zbudowanie odpowiedzi**:
   - zwrócić 201 + JSON zgodny z `CreateGoalResponseDto`.

### Warstwa service
Zgodnie z wytycznymi Astro, logikę DB i reguły domenowe warto wydzielić do serwisu:
- nowy plik: `src/lib/services/goals.service.ts`
- odpowiedzialności serwisu:
  - `assertParentGoalAccessible(...)`
  - `createGoal(...)`
  - mapowanie DB → DTO (w tym `DecimalString`)

## 6. Względy bezpieczeństwa
- **AuthN**:
  - endpoint wymaga użytkownika zalogowanego; brak tokenu = 401.
- **AuthZ**:
  - weryfikacja `parent_goal_id` musi uwzględniać własność (ten sam `user_id`).
  - RLS na `goals` wymusza izolację użytkowników (policies `auth.uid() = user_id`).
- **Unikanie IDOR**:
  - nie zwracać informacji, czy cudzy `parent_goal_id` istnieje — traktować jak 404.
- **Walidacja wejścia**:
  - ograniczyć rozmiar i długości stringów (`name`), aby ograniczyć DoS.
  - `target_value` jako string wymaga rygorystycznej walidacji, by uniknąć dziwnych formatów (np. `1e999`).
- **Mass assignment**:
  - w insercie jawnie podać dozwolone kolumny; nie przepuszczać nieznanych pól.
- **Sekrety**:
  - używać `import.meta.env` (już stosowane).

## 7. Wydajność
- Insert to pojedyncza operacja + opcjonalny select/validacja `parent_goal_id`.
- Indeksy istnieją (`goals_parent_goal_id_idx`, `goals_user_id_idx`), więc sprawdzenia ownership po `id` są szybkie.
- W przyszłości (opcjonalnie) można zredukować liczbę round-tripów:
  - walidacja `parent_goal_id` i insert w transakcji RPC albo w jednym zapytaniu (jeśli pojawi się potrzeba),
  - na start: prosty i czytelny flow (1–2 zapytania) jest wystarczający.

## 8. Kroki implementacji
1. **Utworzyć endpoint Astro**
   - ścieżka: `src/pages/api/goals/index.ts`
   - wymagane: `export const prerender = false`
   - eksport: `export async function POST(context)`.

2. **Zaimplementować autentykację w endpointzie**
   - pobrać token z `Authorization`.
   - uzyskać usera:
     - opcja A (minimalna, bearer): `context.locals.supabase.auth.getUser(token)` do walidacji,
     - do operacji DB z RLS: utworzyć klienta Supabase „per-request” z nagłówkiem `Authorization: Bearer <token>` (bez importowania `supabaseClient` z `src/db`, zgodnie z zasadą „nie importuj globalnego klienta do routów”).
   - jeśli brak usera: zwrócić 401.

3. **Zdefiniować Zod schema dla `CreateGoalCommand`**
   - schema powinna zwracać typy zgodne z `CreateGoalCommand`.
   - odróżnić:
     - 400 dla błędu parsowania JSON
     - 422 dla błędów walidacji/constraintów domenowych.

4. **Dodać serwis**
   - nowy folder `src/lib/services/` (jeśli nie istnieje) i plik `goals.service.ts`.
   - funkcje:
     - `validateAndNormalizeCreateGoalInput(...)` (opcjonalnie; jeśli trzymamy wszystko w endpointzie, to minimum to Zod w endpointzie)
     - `assertParentGoalAccessible(supabase, userId, parentGoalId)`
     - `createGoal(supabase, userId, command)`.

5. **Sprawdzanie `parent_goal_id`**
   - jeśli `parent_goal_id` jest `null` lub brak: pominąć.
   - jeśli uuid:
     - query: `select id from goals where id = parent_goal_id and user_id = userId`.
     - jeśli 0 rekordów: 404.

6. **Insert do `public.goals`**
   - `insert({ user_id: userId, parent_goal_id, name, target_value, deadline })`
   - `.select('id,status,name,target_value,deadline,parent_goal_id').single()`
   - zwrócić 201 z `CreateGoalResponseDto`.

7. **Standaryzacja błędów (envelope)**
   - dla odpowiedzi błędów używać `ApiErrorDto` z [src/types.ts](src/types.ts).
   - zdefiniować spójne kody, np.:
     - `unauthenticated`
     - `validation_error`
     - `parent_goal_not_found`
     - `internal_error`

8. **Rejestrowanie błędów**
   - w aktualnym schemacie nie ma tabeli „error logs”, więc:
     - logować błędy serwera do console/loggera (na poziomie hostingu/observability),
     - nie zapisywać payloadów zawierających potencjalne dane wrażliwe.

9. **Walidacja działania**
   - ręcznie (lub testem integracyjnym) sprawdzić scenariusze:
     - 201 dla poprawnych danych
     - 401 bez tokenu
     - 422 dla `target_value = "0"` i `deadline` przeszły/„dzisiaj”
     - 404 dla nieistniejącego `parent_goal_id`
     - 400 dla niepoprawnego JSON.
