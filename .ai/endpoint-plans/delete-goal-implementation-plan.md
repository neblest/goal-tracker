# API Endpoint Implementation Plan: DELETE /api/goals/:goalId

## 1. Przegląd punktu końcowego
Endpoint usuwa pojedynczy cel (goal) należący do zalogowanego użytkownika.

Wymaganie MVP: pozwolić na usunięcie tylko wtedy, gdy cel nie ma jeszcze żadnych wpisów progresu w tabeli goal_progress. Jeśli wpisy istnieją, zwrócić 409.

- Metoda HTTP: DELETE
- URL: /api/goals/:goalId
- Autoryzacja: Bearer JWT (Supabase Auth) w nagłówku Authorization
- Sukces: 204 No Content (bez body)

## 2. Szczegóły żądania
- Metoda HTTP: DELETE
- Struktura URL: /api/goals/:goalId
- Nagłówki:
  - Content-Type: (opcjonalny; brak body)
  - Authorization: Bearer <access_token> (w produkcji)
- Parametry:
  - Wymagane:
    - goalId (path) – UUID celu
  - Opcjonalne: brak
- Request Body: brak

## 3. Wykorzystywane typy
Źródła typów i envelope są już zdefiniowane w [src/types.ts](src/types.ts).

- DTO:
  - DeleteGoalResponseDto (204, brak body)
  - ApiErrorDto<...> (wspólny format błędów)

- Modele wejścia (Command/Params):
  - Rekomendowane podejście minimalne: nie dodawać nowego Command DTO, ponieważ nie ma body.
  - Jeśli zespół chce spójności: dodać DeleteGoalParams (lub DeleteGoalCommand) zawierający { goalId: string } (tylko wewnętrznie, nie jako API body).

- Walidacja:
  - Zod schema dla parametru goalId (UUID), analogicznie do GET/PATCH w [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts).

## 4. Przepływ danych
1. Router (Astro Server Endpoint) odbiera żądanie DELETE w [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts).
2. Walidacja path param:
   - goalId musi być poprawnym UUID.
   - Jeśli nie, zwrócić 400 z ApiErrorDto (code: invalid_path_params).
3. Uwierzytelnienie:
   - W produkcji: odczytać Authorization: Bearer <token> i wykonać supabase.auth.getUser(token).
   - Jeśli brak/niepoprawny token lub brak user: zwrócić 401 (code: unauthenticated).
   - W dev środowisku repo aktualnie używa stałego userId (DEFAULT_USER_ID / hardcode) – plan wdrożenia powinien zachować aktualny pattern, ale mieć jasny TODO do przełączenia na prawdziwe auth.
4. Warunek MVP (brak progress entries):
   - Serwis sprawdza liczbę wpisów w goal_progress dla goalId.
   - Jeśli count >= 1: zwrócić 409 (code: goal_has_progress).
5. Usuwanie:
   - Serwis usuwa rekord z goals z warunkiem eq(id, goalId) i eq(user_id, userId).
   - Jeśli usunięto 0 rekordów: 404 (code: goal_not_found).
   - Jeśli usunięto 1 rekord: 204 No Content.
6. Obsługa błędów DB:
   - Błędy Supabase/PostgREST mapować na 500 (code: internal_error) i logować.

Rekomendowane miejsce logiki: dodać funkcję serwisową deleteGoal do [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts) (zgodnie z backend.instructions.md: wydzielać logikę do services).

## 5. Względy bezpieczeństwa
- Autentykacja:
  - W produkcji wymagana walidacja JWT przez supabase.auth.getUser(token).
  - Nie akceptować user_id z klienta; userId zawsze pochodzi z tokena.
- Autoryzacja:
  - W produkcji RLS na tabelach goals i goal_progress powinna wymuszać własność (auth.uid() = user_id).
  - Uwaga: repo ma migrację wyłączającą RLS w dev ([supabase/migrations/20251221000000_disable_rls_for_dev.sql](supabase/migrations/20251221000000_disable_rls_for_dev.sql)) — nie wolno wdrażać jej na produkcję.
- Klucz Supabase:
  - Upewnić się, że backend używa klucza anon w środowiskach, gdzie polegamy na RLS.
  - Nie używać service-role key w publicznie dostępnych endpointach.
- Nadużycia/DoS:
  - DELETE jest relatywnie tani, ale nadal warto rozważyć rate limit na poziomie reverse-proxy (opcjonalnie, poza MVP).
- Informacje w odpowiedziach:
  - 404 dla celu spoza uprawnień (nie ujawniać, czy cudzy cel istnieje).

## 6. Obsługa błędów
Wszystkie odpowiedzi błędów w formacie:
{ "error": { "code": string, "message": string, "details"?: any } }

Scenariusze błędów i kody:
- 400 invalid_path_params
  - Gdy goalId nie jest UUID.
- 401 unauthenticated
  - Brak nagłówka Authorization lub nieważny token (w produkcji).
- 404 goal_not_found
  - Cel nie istnieje lub nie należy do użytkownika (w praktyce: brak rekordu po filtrze user_id).
- 409 goal_has_progress
  - Cel ma co najmniej 1 wpis w goal_progress i nie można go usunąć w MVP.
- 500 internal_error
  - Błąd DB / nieoczekiwany wyjątek.

Mapowanie błędów serwisu → HTTP:
- throw new Error("goal_not_found") → 404
- throw new Error("goal_has_progress") → 409
- throw new Error("database_error") → 500

## 7. Wydajność
- Zapytania:
  - 1 zapytanie count do goal_progress po goal_id.
  - 1 zapytanie delete do goals.
- Indeksy:
  - Istnieje indeks goal_progress_goal_id_idx na goal_progress(goal_id) (szybkie count).
  - Istnieje indeks goals_user_id_idx, ale delete filtruje po (id, user_id). Dla większej skali można rozważyć indeks złożony (user_id, id), ale dla MVP obecne indeksy zwykle wystarczą.
- Pamiętać o potencjalnym race condition:
  - Między sprawdzeniem count a delete ktoś może dopisać progress. Dla MVP akceptowalne, ale warto zanotować jako ryzyko.
  - Docelowo: egzekwować regułę w DB (np. trigger blokujący delete, jeśli istnieje progress) albo wykonać atomową operację w RPC.

## 8. Kroki implementacji
1. Ustalić kontrakt błędów i kody
   - Przyjąć code dla konfliktu: goal_has_progress.
   - Utrzymać spójność z istniejącymi endpointami (invalid_path_params, unauthenticated, internal_error).

2. Dodać logikę serwisową
   - W [src/lib/services/goals.service.ts](src/lib/services/goals.service.ts) dodać funkcję deleteGoal(supabase, userId, goalId).
   - Implementacja (proponowana):
     - Sprawdzić dostępność celu (opcjonalnie): select id from goals where id=goalId and user_id=userId maybeSingle.
       - Jeśli brak: throw goal_not_found.
     - Policz wpisy progress: select("*", { count: "exact", head: true }).eq("goal_id", goalId).
       - Jeśli count >= 1: throw goal_has_progress.
     - Usuń cel: delete().eq("id", goalId).eq("user_id", userId).
       - Jeśli backend nie zwraca liczby usuniętych rekordów, użyć select("id") po delete (jeśli wspierane), albo poprzedniego selecta jako źródła 404.
     - Na error z Supabase: console.error i throw database_error.

3. Dodać handler DELETE w API route
   - W [src/pages/api/goals/[goalId].ts](src/pages/api/goals/%5BgoalId%5D.ts) dodać export async function DELETE(context).
   - Skopiować wzorzec walidacji goalId (goalIdSchema) z istniejącego GET/PATCH.
   - Dodać auth:
     - Dev: użyć stałego user id (jak w GET/PATCH).
     - Prod: odkomentować i użyć Authorization Bearer + supabase.auth.getUser.

4. Zwracanie odpowiedzi
   - Sukces: zwrócić Response z status 204 i bez body.
   - Błędy: zwrócić JSON z ApiErrorDto oraz odpowiednim status.

5. Logging
   - Na poziomie endpointu i serwisu logować console.error z kontekstem (method, goalId, userId jeśli bezpieczne, oraz error z Supabase).
   - W projekcie nie ma obecnie tabeli do logów błędów; jeśli w przyszłości zostanie dodana, przepiąć logowanie w jednym miejscu (np. wspólny helper).

6. Scenariusze weryfikacji (manualne)
   - 204: usunięcie celu bez progress.
   - 409: próba usunięcia celu z progress (count >= 1).
   - 404: usunięcie nieistniejącego celu / cudzego celu.
   - 400: goalId nie jest UUID.
   - 401: brak/niepoprawny token (po włączeniu auth w produkcji).

7. (Opcjonalnie, poza MVP) Wzmocnienie reguły na poziomie DB
   - Dodać trigger BEFORE DELETE na goals, który blokuje delete, jeśli istnieje rekord w goal_progress dla danego goal_id.
   - Alternatywnie: dodać funkcję SQL (RPC) wykonującą atomowy check+delete.
