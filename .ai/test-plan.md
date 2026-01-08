<analiza_projektu>
**1. Kluczowe komponenty projektu:**
*   **Frontend (Astro + React):** Aplikacja hybrydowa wykorzystująca Astro do renderowania statycznego (SSR) oraz React v19 do interaktywnych wysp (komponenty `goals/*`, `auth/*`). Stylowanie oparte na Tailwind CSS v4.
*   **Backend (Astro API Routes):** Endpointy w `src/pages/api/` obsługujące logikę biznesową (Auth, Goals, Progress, AI).
*   **Warstwa Danych (Supabase):** Baza danych PostgreSQL (definicje w `database.types.ts`), obsługa uwierzytelniania (Auth) oraz klient `supabase-js`.
*   **Logika Biznesowa (Services):** Wydzielona logika w `src/lib/services/` (m.in. `goals.service.ts`, `goal-lifecycle.service.ts`, `ai-summary.service.ts`). Obsługuje cykl życia celów, obliczanie postępów i walidację reguł (np. blokowanie edycji).
*   **Integracja AI (OpenRouter):** Generowanie podsumowań celów (`src/lib/services/openrouter.client.ts`) z wykorzystaniem prompt engineeringu i rate limitera.
*   **Zabezpieczenia:** Rate limiter (`src/lib/middleware/rate-limiter.ts`), walidacja Zod, autoryzacja sesji oparta na ciasteczkach HttpOnly (`getUserFromRequest`).

**2. Specyfika stosu technologicznego i wpływ na testowanie:**
*   **Astro & React:** Konieczność testowania zarówno statycznie renderowanych stron, jak i hydratacji komponentów Reactowych. Testy E2E (np. Playwright) będą kluczowe dla weryfikacji interakcji użytkownika.
*   **Supabase & Auth:** Testy muszą uwzględniać mockowanie klienta Supabase w testach jednostkowych oraz obsługę ciasteczek HttpOnly w testach integracyjnych. Należy zweryfikować Row Level Security (RLS) lub logikę w serwisach sprawdzającą `user_id`.
*   **Async Logic & AI:** Testowanie integracji z AI jest nieterministyczne i kosztowne. Należy mockować odpowiedzi OpenRoutera w CI/CD i skupić się na obsłudze błędów (timeout, błędy API) oraz rate limitach.
*   **Daty i Strefy Czasowe:** Projekt intensywnie operuje na datach (terminy celów, `sync-statuses`). Testy muszą uwzględniać różne strefy czasowe (serwer vs klient).

**3. Priorytety testowe:**
1.  **Cykl życia celu (Core):** Tworzenie, dodawanie postępów, blokowanie edycji, zamykanie celu (sukces/porażka). To jest serce aplikacji.
2.  **Bezpieczeństwo Danych (Data Isolation):** Weryfikacja, czy użytkownik A nie ma dostępu do celów/postępów użytkownika B (IDOR).
3.  **Integracja AI i Koszty:** Sprawdzenie, czy rate limiter działa poprawnie, aby uniknąć nadmiernych kosztów, oraz czy aplikacja nie "wybucha" przy błędzie API AI.
4.  **Uwierzytelnianie:** Rejestracja, logowanie, wylogowanie, wygasanie sesji.

**4. Potencjalne obszary ryzyka:**
*   **Obliczenia na liczbach zmiennoprzecinkowych:** Baza używa `number`, API używa `DecimalString`. Ryzyko błędów zaokrągleń przy sumowaniu postępów.
*   **Spójność danych przy współbieżności:** Endpoint `sync-statuses` może działać równolegle z akcjami użytkownika.
*   **Wydajność historii celów:** Rekurencyjne pobieranie historii (`get_goal_history` RPC) może być wąskim gardłem przy długich łańcuchach celów.
*   **Obsługa błędów sieciowych:** Zachowanie UI (loadery, komunikaty) w przypadku braku połączenia, zwłaszcza w komponentach Reactowych.
</analiza_projektu>

<plan_testów>

# Plan Testów QA dla Projektu "Aimbition" (Goal Tracker)

## 1. Wprowadzenie i Cele
Celem niniejszego planu jest zapewnienie jakości aplikacji "Aimbition" – systemu do śledzenia celów osobistych z integracją AI. Aplikacja oparta jest o stack Astro, React oraz Supabase. Głównym celem testów jest weryfikacja poprawności logiki biznesowej, bezpieczeństwa danych użytkowników, stabilności integracji z usługami AI oraz użyteczności interfejsu.

## 2. Zakres Testów
**W zakresie (In-Scope):**
*   Funkcjonalności zarządzania celami (CRUD, cykl życia: Active, Completed, Abandoned, Failed).
*   System śledzenia postępów i blokowania edycji kluczowych pól.
*   Moduł uwierzytelniania i zarządzania sesją (HttpOnly Cookies).
*   Integracja z OpenRouter API (generowanie podsumowań AI) oraz mechanizm Rate Limiting.
*   Interfejs użytkownika (responsywność, obsługa formularzy).
*   Logika backendowa (API Routes, Services).

**Poza zakresem (Out-of-Scope):**
*   Testy wydajnościowe samej infrastruktury Supabase i OpenRouter.
*   Testy bezpieczeństwa penetracyjnego (poza podstawowymi testami autoryzacji i IDOR).
*   Kompatybilność z przeglądarkami Internet Explorer.

## 3. Typy Testów

### 3.1. Testy Jednostkowe (Unit Tests)
Skupione na logice biznesowej zawartej w katalogu `src/lib/services/` oraz `src/lib/utils/`.
*   **Narzędzie:** Vitest
*   **Kluczowe obszary:**
    *   Walidacja danych wejściowych (Zod schemas, funkcje w `validation.ts`).
    *   Logika obliczania postępów (konwersja `number` <-> `DecimalString`).
    *   Logika cyklu życia celu (np. czy można wznowić cel zakończony sukcesem).
    *   Rate Limiter (algorytm sliding window).

### 3.2. Testy Integracyjne (API Integration Tests)
Weryfikacja komunikacji między API Routes a bazą danych Supabase.
*   **Kluczowe obszary:**
    *   Endpointy `/api/goals/*` i `/api/auth/*`.
    *   Poprawność zapytań SQL i zwracanych struktur DTO.
    *   Weryfikacja uprawnień (czy użytkownik widzi tylko swoje cele).
    *   Integracja z mockowanym serwisem AI.

### 3.3. Testy E2E (End-to-End)
Symulacja pełnych ścieżek użytkownika w przeglądarce.
*   **Narzędzie:** Playwright
*   **Kluczowe obszary:**
    *   Rejestracja i logowanie.
    *   Stworzenie celu, dodanie postępu, weryfikacja blokady edycji.
    *   Zakończenie celu i wygenerowanie podsumowania AI.
    *   Dashboard i filtrowanie list.

## 4. Scenariusze Testowe

### 4.1. Moduł Uwierzytelniania (Auth)
| ID | Tytuł Scenariusza | Oczekiwany Rezultat | Priorytet |
|----|-------------------|---------------------|-----------|
| AUTH-01 | Rejestracja nowego użytkownika z poprawnymi danymi | Konto utworzone, przekierowanie do dashboardu, ciastka sesyjne ustawione. | Wysoki |
| AUTH-02 | Próba rejestracji na istniejący email | Błąd 409, komunikat dla użytkownika. | Średni |
| AUTH-03 | Logowanie z niepoprawnym hasłem | Błąd 401, brak dostępu. | Wysoki |
| AUTH-04 | Dostęp do chronionej trasy `/app/goals` bez logowania | Przekierowanie do `/login`. | Wysoki |
| AUTH-05 | Wylogowanie użytkownika | Usunięcie ciastek sesyjnych, brak dostępu do API. | Średni |

### 4.2. Zarządzanie Celami (Goals Lifecycle)
| ID | Tytuł Scenariusza | Warunki Wstępne | Oczekiwany Rezultat | Priorytet |
|----|-------------------|-----------------|---------------------|-----------|
| GOAL-01 | Utworzenie nowego celu | Zalogowany użytkownik | Cel utworzony ze statusem `active`, widoczny na liście. | Wysoki |
| GOAL-02 | Edycja "Target Value" pustego celu | Cel bez wpisów postępu | Wartość zaktualizowana. | Średni |
| GOAL-03 | Próba edycji "Target Value" po dodaniu postępu | Cel ma 1 wpis postępu | API zwraca błąd `goal_locked`, UI blokuje pole. | Wysoki |
| GOAL-04 | Porzucenie celu (Abandon) | Cel aktywny | Status zmienia się na `abandoned`, wymagane podanie powou. | Średni |
| GOAL-05 | Automatyczna zmiana statusu na "Failed" | Cel aktywny, data > deadline, progress < target | Skrypt `sync-statuses` zmienia status na `completed_failure`. | Wysoki |
| GOAL-06 | Kontynuacja celu (Continue) | Cel `completed_success`, jest najnowszy w łańcuchu | Utworzenie nowego celu powiązanego z rodzicem. | Średni |

### 4.3. Śledzenie Postępów (Progress)
| ID | Tytuł Scenariusza | Oczekiwany Rezultat | Ryzyko |
|----|-------------------|---------------------|--------|
| PROG-01 | Dodanie wpisu postępu (wartość dodatnia) | Przeliczenie % postępu celu, aktualizacja `current_value`. | Błędy zaokrągleń |
| PROG-02 | Dodanie wpisu z wartością dziesiętną (np. 0.5) | Poprawne zsumowanie w bazie i wyświetlenie. | Typy danych |
| PROG-03 | Usunięcie wpisu postępu | Ponowne przeliczenie % postępu, odblokowanie edycji celu jeśli to był jedyny wpis. | Spójność danych |
| PROG-04 | Próba dodania postępu do celu zakończonego | Błąd API `goal_not_active`. | Logika biznesowa |

### 4.4. Integracja z AI (AI Summary)
| ID | Tytuł Scenariusza | Oczekiwany Rezultat | Priorytet |
|----|-------------------|---------------------|-----------|
| AI-01 | Generowanie podsumowania dla zakończonego celu (>3 wpisy) | Otrzymanie podsumowania JSON, zapisanie w bazie. | Wysoki |
| AI-02 | Próba generowania dla celu z <3 wpisami | Błąd `not_enough_data`, przycisk generowania nieaktywny/zablokowany. | Średni |
| AI-03 | Przekroczenie limitu zapytań (Rate Limit) | Błąd 429, informacja "Too many requests", blokada na określony czas. | Wysoki |
| AI-04 | Obsługa błędu dostawcy AI (np. Timeout) | Aplikacja nie crashuje, wyświetla komunikat "Try again later". | Średni |

### 4.5. Bezpieczeństwo (Security)
| ID | Tytuł Scenariusza | Oczekiwany Rezultat |
|----|-------------------|---------------------|
| SEC-01 | IDOR: Próba pobrania celu innego użytkownika przez API (`GET /api/goals/{other_id}`) | Błąd 404 (Not Found) - bezpieczniej niż 403. |
| SEC-02 | IDOR: Próba dodania postępu do celu innego użytkownika | Błąd 404/403. |
| SEC-03 | XSS: Wstrzyknięcie skryptu w polu `notes` postępu | Tekst wyrenderowany jako plain text, skrypt niewykonany. |

## 5. Środowisko Testowe

*   **Lokalne (Local/Dev):**
    *   Baza danych: Lokalna instancja Supabase (Docker) lub projekt deweloperski w chmurze.
    *   Zmienne: `.env.test` z kluczem API OpenRouter ustawionym na mock lub sandbox.
*   **CI/CD (GitHub Actions):**
    *   Baza danych: Tymczasowa instancja Supabase lub konteneryzowana baza PostgreSQL.
    *   AI: Mockowanie odpowiedzi HTTP dla `openrouter.client.ts`.

## 6. Narzędzia

1.  **Vitest:** Uruchamianie testów jednostkowych i integracyjnych backendu.
2.  **Playwright:** Testy E2E (obsługa wielu przeglądarek: Chromium, Firefox, WebKit).
3.  **Supabase CLI:** Zarządzanie lokalną bazą danych i migracjami do celów testowych.
4.  **ESLint / Prettier:** Statyczna analiza kodu (zapewniona w projekcie).
5.  **Postman / Bruno:** Ręczne testy eksploracyjne API.

## 7. Harmonogram Testów

1.  **Setup (Tydzień 1):** Konfiguracja środowiska testowego (Vitest, Playwright, Mocki Supabase).
2.  **Unit & Integration (Tydzień 1-2):** Pokrycie serwisów (`src/lib/services`) i API Routes. Priorytet: `goals.service.ts` i `goal-lifecycle.service.ts`.
3.  **E2E (Tydzień 2-3):** Implementacja krytycznych ścieżek (Happy Path: Rejestracja -> Cel -> Postęp -> Sukces).
4.  **Edge Cases & Security (Tydzień 3):** Testy Rate Limitera, IDOR, stref czasowych.
5.  **Bug Fixing & Retests (Bieżąco):** Weryfikacja poprawek.

## 8. Kryteria Akceptacji

*   Wszystkie testy jednostkowe i integracyjne przechodzą (100% pass rate).
*   Pokrycie kodu (Code Coverage) dla `src/lib/services` wynosi minimum 80%.
*   Krytyczne ścieżki E2E (Login, CRUD Goal, Progress) działają bezbłędnie.
*   Brak otwartych błędów o priorytecie Critical lub High.
*   Rate Limiter poprawnie blokuje nadmiarowe żądania do AI.
*   Aplikacja poprawnie obsługuje błędy 4xx i 5xx (nie wyświetla "białego ekranu").

## 9. Role i Odpowiedzialności

*   **Developers:** Pisanie testów jednostkowych dla nowej logiki, utrzymanie zgodności typów TypeScript, naprawa zgłoszonych błędów.
*   **QA Engineer:** Tworzenie i utrzymanie testów E2E, testy manualne/eksploracyjne, weryfikacja bezpieczeństwa (IDOR), raportowanie błędów, zarządzanie planem testów.

## 10. Procedura Raportowania Błędów

Każdy błąd powinien być zgłoszony w systemie śledzenia zadań (np. Jira/GitHub Issues) wg szablonu:
1.  **Tytuł:** Krótki opis problemu.
2.  **Środowisko:** (np. Local, Staging, Przeglądarka).
3.  **Kroki do reprodukcji:** Dokładna instrukcja "krok po kroku".
4.  **Oczekiwany rezultat:** Jak system powinien się zachować.
5.  **Rzeczywisty rezultat:** Jak system się zachował (wraz ze zrzutem ekranu/logami).
6.  **Priorytet:** (Critical, High, Medium, Low).
7.  **Komponent:** (np. API, UI, AI Service).

</plan_testów>