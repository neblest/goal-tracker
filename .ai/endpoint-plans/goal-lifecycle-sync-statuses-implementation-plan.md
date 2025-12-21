# API Endpoint Implementation Plan: POST /api/goals/sync-statuses

## 1. Przegląd punktu końcowego
Endpoint służy do zastosowania automatycznych przejść statusów dla celów bieżącego użytkownika.

Reguły biznesowe:
- Jeśli `current_value >= target_value` → ustaw `status = completed_success`.
- Jeśli "teraz" jest po dniu `deadline` o 23:59 (lokalna polityka czasu) **oraz** `current_value < target_value` → ustaw `status = completed_failure`.
- Jeśli `status = abandoned` → nigdy nie zmieniaj automatycznie.
- Idempotencja: wielokrotne wywołania nie powinny powodować kolejnych zmian po jednorazowym zastosowaniu tych reguł.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/goals/sync-statuses`
- Uwierzytelnianie: wymagane (`Authorization: Bearer <access_token>`), zgodnie z podejściem używanym w istniejących endpointach.
- Request body: opcjonalny JSON.

Parametry:
- Wymagane: brak
- Opcjonalne:
  - `goal_ids?: string[]` – lista UUID celów do przeliczenia; jeśli brak, przelicz wszystkie cele użytkownika.

Walidacja (Zod):
- Jeśli body jest **puste** lub nieobecne → traktuj jak `{}`.
- Jeśli body jest obecne:
  - Musi być obiektem.
  - `goal_ids` (jeśli jest) musi być tablicą UUID-ów, dopuszczalne `[]`.
- Błąd walidacji payload → `400` (zgodnie ze specyfikacją tego endpointa).

Wykorzystywane typy (DTO/Command):
- `SyncStatusesCommand`
- `SyncStatusesResponseDto`
- `ApiErrorDto`

## 3. Szczegóły odpowiedzi
- Sukces: `200 OK`
  - Body:
    ```json
    { "data": { "updated": [{ "id": "uuid", "from": "active", "to": "completed_failure" }] } }
    ```
  - `updated` zawiera wyłącznie cele, których status faktycznie uległ zmianie.

## 4. Przepływ danych
1. Route: parsuje JSON (jeśli jest), waliduje Zod.
2. Route: uwierzytelnia użytkownika (Bearer token) i uzyskuje `userId`.
3. Service (np. `src/lib/services/goal-lifecycle.service.ts`):
   - Pobiera listę celów do przetworzenia:
     - filtr: `user_id = userId`
     - filtr statusów: co najmniej `status = active` (abandoned/complete nie wymagają auto-zmiany).
     - jeśli `goal_ids` podane: dodatkowo filtr `id IN (goal_ids)`.
   - Dla pobranych celów wylicza `current_value` jako `SUM(goal_progress.value)` (0 gdy brak wpisów).
   - Dla każdego celu ocenia reguły przejść:
     - success jeśli `current_value >= target_value`
     - failure jeśli `now > endOfDeadlineDay(deadline)` i `current_value < target_value`
   - Aktualizuje tylko te rekordy, które spełniają warunek zmiany (minimalna liczba zapisów; idempotencja).
   - Zwraca listę zmian: `{ id, from, to }`.
4. Route: mapuje wynik do `SyncStatusesResponseDto` i zwraca `200`.

Definicja `endOfDeadlineDay(deadline)`:
- `deadline` jest typu `date` (YYYY-MM-DD).
- Polityka lokalna: koniec dnia `23:59:59.999` w lokalnej strefie czasu procesu serwera.
- Implementacyjnie: utworzyć obiekt `Date` z `deadline` i ustawić godziny na 23:59:59.999.

## 5. Względy bezpieczeństwa
- AuthN: zawsze wymagaj użytkownika; bez tokenu → `401`.
- AuthZ: operuj wyłącznie na rekordach użytkownika (`user_id = userId`) nawet gdy RLS jest włączone (defense-in-depth) i szczególnie w dev, gdy RLS bywa wyłączone.
- Nie ujawniaj informacji o istnieniu cudzych zasobów: filtr `user_id` sprawia, że cele spoza konta nie są zwracane.
- Odporność na nadużycia:
  - limit długości `goal_ids` (np. 1–200) w Zod, aby ograniczyć obciążenie.
  - opcjonalnie: rate limiting na poziomie edge/proxy (poza zakresem implementacji w kodzie, ale warto odnotować).

## 6. Obsługa błędów
Zalecane mapowanie błędów (spójne z istniejącymi route’ami):
- `401 unauthenticated`
  - brak/niepoprawny Bearer token.
- `400 invalid_payload`
  - body nie jest JSON-em, nie jest obiektem, `goal_ids` nie jest tablicą UUID.
- `500 internal_error`
  - błędy Supabase/DB, nieoczekiwane wyjątki.

Scenariusze brzegowe:
- `goal_ids` zawiera UUID należące do innego użytkownika → ignorowane (bo query filtruje po `user_id`), brak wycieku danych.
- Cel jest `abandoned` → brak zmiany.
- Cel już ma `completed_*` → brak zmiany.

Rejestrowanie błędów:
- W projekcie nie ma dedykowanej tabeli błędów; logować przez `console.error` w route/service (zgodnie z obecnym stylem) + ewentualnie integracja z monitoringiem w przyszłości.

## 7. Wydajność
- Kluczowe jest ograniczenie liczby zapytań:
  - Preferowane: 2 zapytania (cele + agregacja postępu) i batch update.
  - MVP dopuszcza pętlę aktualizacji tylko dla rekordów do zmiany, ale unikać N+1 na progres.
- Agregacja postępu:
  - Możliwa przez jedno zapytanie do `goal_progress` z `in(goal_id, ids)` i sumowanie po stronie aplikacji.
- Indeksy:
  - `goals_user_id_status_idx` i `goal_progress_goal_id_idx` już istnieją i wspierają typowe filtrowanie.

## 8. Kroki implementacji
1. Dodać nowy route: `src/pages/api/goals/sync-statuses.ts` (`export const prerender = false`).
2. Zaimplementować schemat Zod dla body (`goal_ids?: uuid[]`), mapowanie błędów na `400/401/500`.
3. Utworzyć service `src/lib/services/goal-lifecycle.service.ts` (lub dodać do istniejącego `goals.service.ts`, ale preferowane wydzielenie), funkcja np. `syncStatuses(supabase, userId, command)`.
4. W serwisie: pobrać cele aktywne użytkownika (opcjonalnie `goal_ids`), pobrać progres i policzyć `current_value`.
5. Zastosować reguły statusów i wykonać aktualizacje tylko gdy wymagane.
6. Zwrócić `updated[]` i opakować w `SyncStatusesResponseDto`.
7. Dodać test scenariuszy (jeśli repo ma testy; jeśli nie – przynajmniej ręczne testy curl w README/dev-notatkach):
   - brak body → przelicza wszystkie
   - body z `goal_ids` → przelicza podzbiór
   - idempotencja (drugie wywołanie zwraca `updated: []`)
   - deadline przekroczony po 23:59 lokalnie
8. Przejrzeć zgodność z RLS (dev/prod) i upewnić się, że filtr `user_id` jest zawsze stosowany.
