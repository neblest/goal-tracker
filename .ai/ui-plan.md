# Architektura UI dla GoalTracker (MVP)

## 1. Przegląd struktury UI

GoalTracker w MVP opiera się na jednym głównym ekranie aplikacji: **lista celów**. Większość interakcji (utworzenie celu, podgląd szczegółów, edycje, dodanie progresu, porzucenie celu, AI summary, historia iteracji) odbywa się w **modalach nakładanych na listę** (routing modalny, deep-link + back/forward + refresh).

**Założenia kluczowe:**
- **Public**: onboarding (tylko niezalogowani), logowanie i rejestracja.
- **App**: start po zalogowaniu → `/app/goals`.
- **Modale jako overlay routes**:
  - szczegóły celu: `/app/goals/:id` (modal pełnostronicowy do wysokości headera),
  - dodanie celu: rekomendowane `/app/goals/new` (modal).
- **Synchronizacja statusów** uruchamiana w tle po wejściu na listę celów (bez komunikatu).
- **Polityka czasu**: UI “operuje na dniach”, dni pozostałe liczone wg lokalnego czasu użytkownika; deadline traktowany jako koniec dnia (23:59) na potrzeby prezentacji i spójności z logiką statusów.
- **Dostępność (A11y)**: modal jako `role="dialog"` z focus trap, zamykanie `Esc`, przycisk zamknięcia z `aria-label`, wewnętrzny scroll; elementy klikalne z focus ring; alternatywne opisy dla wizualizacji progresu.
- **Bezpieczeństwo / auth**: 401 → redirect do `/login` (lub public root); dane użytkownika wyłącznie po stronie sesji (bez przyjmowania `user_id` z UI).

---

## 2. Lista widoków

### 2.1 Onboarding (Public Landing)
- **Ścieżka widoku**: `/`
- **Główny cel**: wyjaśnić wartość aplikacji i poprowadzić do logowania/rejestracji.
- **Kluczowe informacje do wyświetlenia**:
  - 3 statyczne infografiki (kroki: cel → progres → refleksja + AI).
  - CTA: „Zaloguj się”, „Załóż konto”.
- **Kluczowe komponenty widoku**:
  - sekcja hero (krótki opis),
  - 3 kafelki/ilustracje onboardingowe,
  - przyciski nawigacyjne do auth.
- **UX, dostępność i względy bezpieczeństwa**:
  - treści statyczne (brak danych wrażliwych),
  - semantyka: `main`, nagłówki,
  - linki jako prawdziwe `<a>` (czytelne focus states).

---

### 2.2 Logowanie
- **Ścieżka widoku**: `/login`
- **Główny cel**: zalogować użytkownika.
- **Kluczowe informacje do wyświetlenia**:
  - formularz: email, hasło,
  - komunikaty błędów (np. 401 – błędne dane).
- **Kluczowe komponenty widoku**:
  - formularz logowania,
  - link do rejestracji.
- **UX, dostępność i względy bezpieczeństwa**:
  - walidacja po stronie UI (format email, wymagane pola),
  - czytelne błędy w `aria-live`,
  - brak ujawniania szczegółów (np. czy email istnieje),
  - po 401: informacja „Niepoprawny email lub hasło”.

---

### 2.3 Rejestracja
- **Ścieżka widoku**: `/register`
- **Główny cel**: utworzyć konto i zalogować użytkownika.
- **Kluczowe informacje do wyświetlenia**:
  - formularz: email, hasło, potwierdzenie hasła,
  - wymagania hasła (min. 8 znaków),
  - komunikaty błędów (np. email zajęty).
- **Kluczowe komponenty widoku**:
  - formularz rejestracji,
  - link do logowania.
- **UX, dostępność i względy bezpieczeństwa**:
  - walidacja (min length, zgodność haseł),
  - błędy w `aria-live`,
  - po sukcesie: redirect do `/app/goals`.

---

### 2.4 Lista celów (Home po zalogowaniu)
- **Ścieżka widoku**: `/app/goals`
- **Główny cel**: dać przegląd celów, umożliwić filtrowanie/szukanie/sortowanie oraz wejście w szczegóły i dodanie nowego celu.
- **Kluczowe informacje do wyświetlenia**:
  - lista celów jako karty,
  - na karcie: nazwa, kołowy progres + tekst (np. „45/100, 45%”), status, oraz „Pozostało X dni” tylko dla aktywnych.
- **Kluczowe komponenty widoku**:
  - **Header aplikacji**: logo (lewo), powitanie użytkownika + akcja wylogowania (prawo).
  - **Panel kontroli listy**:
    - dropdown filter status (domyślnie: active),
    - wyszukiwarka z debounce,
    - sort (domyślnie created_at desc; opcjonalnie deadline).
  - **Grid kart**: 1 kolumna mobile, 2–3 desktop.
  - **Load more** (paginacja).
  - **Puste stany**:
    - brak celów: „Brak celów” + CTA „Utwórz cel”.
- **UX, dostępność i względy bezpieczeństwa**:
  - karty jako linki/nawigacja do `/app/goals/:id` (deep-link), pełny focus ring,
  - sticky header dla kontroli i szybkiego wylogowania,
  - po wejściu na widok: w tle `POST /api/goals/sync-statuses` (bez UI), a następnie (opcjonalnie) dyskretny refetch listy,
  - 401 z API → redirect do `/login`.

**Mapowanie na API (kontrakt):**
- GET `/api/goals` (status/q/sort/order/page/pageSize),
- POST `/api/goals/sync-statuses` (silent).

---

### 2.5 Modal: Dodanie celu
- **Ścieżka widoku (routing modalny)**: `/app/goals/new`
- **Główny cel**: stworzyć nowy cel (nową iterację).
- **Kluczowe informacje do wyświetlenia**:
  - pola: nazwa (unikalna w sensie UX; technicznie może wymagać walidacji po stronie API), target_value, deadline (data),
  - walidacje: wszystkie wymagane, target_value > 0, deadline w przyszłości.
- **Kluczowe komponenty widoku**:
  - modal z nagłówkiem i przyciskiem zamknięcia,
  - formularz tworzenia,
  - przycisk „Utwórz” + stany loading/błąd.
- **UX, dostępność i względy bezpieczeństwa**:
  - `role="dialog"`, focus trap, `Esc` zamyka,
  - czytelne błędy w `aria-live`,
  - po sukcesie: zamknąć modal i odświeżyć listę (lub wstawić optymistycznie nową kartę).

**Mapowanie na API:**
- POST `/api/goals`.

---

### 2.6 Modal: Szczegóły celu
- **Ścieżka widoku (routing modalny)**: `/app/goals/:id`
- **Główny cel**: umożliwić pełną pracę z celem: podgląd metryk, dodawanie/edycję progresu (tylko active), notatki refleksyjne, AI summary po zakończeniu, porzucenie, historia iteracji, retry/continue.
- **Kluczowe informacje do wyświetlenia**:
  - definicja celu: nazwa, target_value, deadline, status,
  - computed: current_value, progress_percent, days_remaining, entries_count,
  - lista wpisów progresu,
  - reflection_notes,
  - ai_summary (gdy istnieje),
  - historia iteracji (łańcuch).
- **Kluczowe komponenty widoku** (sekcje w modalu):
  1) **Nagłówek modala**: nazwa celu + status, „Zamknij” (X).
  2) **Podsumowanie/metyki**:
     - kołowy progres + tekst alternatywny,
     - „X/Y” i percent,
     - „Pozostało X dni” (gdy active).
  3) **Edycja pól celu** (tylko gdy nie zablokowane):
     - nazwa / target / deadline edytowalne do momentu pierwszego progresu,
     - po pierwszym progresie: pola stają się readonly (bez komunikatu zgodnie z decyzją).
  4) **Wpisy progresu**:
     - lista wpisów + load more,
     - akcje przy wpisie (tylko gdy goal active): „Edytuj”, opcjonalnie „Usuń”.
     - inline formularz dodania progresu (tylko goal active).
     - potwierdzenie zapisu (dialog).
  5) **Notatka refleksyjna**:
     - duże pole tekstowe, zawsze edytowalne,
     - zapis automatyczny lub przyciskiem (do decyzji implementacyjnej; architektonicznie dopuszczone obie).
  6) **AI Summary**:
     - jeśli goal `completed_*` i brak `ai_summary` i `entries_count >= 3`: lazy generate przy wejściu do modala,
     - retry do 3 w ramach sesji karty (tab),
     - po 3 porażkach: UI przełącza się na ręczne wprowadzenie i zapis.
     - jeśli `entries_count < 3`: komunikat „Za mało danych (min. 3 wpisy)”.
     - zawsze możliwość edycji treści summary (gdy istnieje).
  7) **Historia iteracji**:
     - lista poprzednich iteracji z datą, statusem, wynikiem,
     - kliknięcie iteracji otwiera jej szczegóły (ten sam modal route dla innego id).
  8) **Akcje celu** (kontekstowe):
     - dla active: „Porzuć cel” (dialog z powodami),
     - dla completed_failure/abandoned: „Spróbuj ponownie” (prefill create flow),
     - dla completed_success: „Kontynuuj” (prefill create flow na bazie sugestii lub manualnie).
- **UX, dostępność i względy bezpieczeństwa**:
  - modal pełnostronicowy do headera, wewnętrzny scroll,
  - sekcje z czytelnymi nagłówkami, anchor-y opcjonalnie dla długich treści,
  - obsługa błędów:
    - 404: „Nie znaleziono celu” (w modalu) + CTA „Wróć do listy”,
    - 409: komunikat „Cel nieaktywny / pola zablokowane” + CTA do historii lub retry/continue (zależnie od statusu),
    - 401: redirect do `/login`,
  - ograniczenia edycji progresu: UI ukrywa/disable akcje edycji gdy cel nieaktywny.

**Mapowanie na API:**
- GET `/api/goals/:goalId`
- GET `/api/goals/:goalId/progress`
- PATCH `/api/goals/:goalId` (reflection_notes zawsze; name/target/deadline tylko gdy odblokowane; ai_summary może być też edytowane przez dedykowany endpoint)
- POST `/api/goals/:goalId/progress`
- PATCH `/api/progress/:progressId`
- DELETE `/api/progress/:progressId` (jeśli wspierane w MVP)
- GET `/api/goals/:goalId/history`
- POST `/api/goals/:goalId/abandon`
- POST `/api/goals/:goalId/retry`
- POST `/api/goals/:goalId/continue`
- POST `/api/goals/:goalId/ai-summary/generate`
- PATCH `/api/goals/:goalId/ai-summary`

---

### 2.7 Widoki błędów (Public)
- **Ścieżka widoku**: `/404` oraz fallback dla nieznanych tras
- **Główny cel**: poinformować użytkownika i dać drogę powrotu.
- **Kluczowe informacje do wyświetlenia**:
  - „Nie znaleziono strony”
  - CTA: „Wróć na stronę główną” (dla niezalogowanych) lub „Przejdź do listy celów” (dla zalogowanych).
- **Kluczowe komponenty widoku**:
  - komunikat błędu + linki nawigacyjne.
- **UX, dostępność i względy bezpieczeństwa**:
  - prosta struktura, brak danych wrażliwych.

---

## 3. Mapa podróży użytkownika

### 3.1 Pierwsze uruchomienie (nowy użytkownik)
1. Użytkownik wchodzi na `/` i widzi onboarding (3 infografiki) + CTA.
2. Klik „Załóż konto” → `/register`.
3. Wprowadza dane, zakłada konto → redirect do `/app/goals`.
4. Na `/app/goals` widzi pusty stan „Brak celów” + CTA „Utwórz cel”.
5. CTA otwiera `/app/goals/new` (modal).
6. Po utworzeniu celu → modal zamyka się → lista pokazuje nową kartę.

### 3.2 Codzienne użycie: dodanie progresu
1. Użytkownik otwiera `/app/goals`.
2. W tle uruchamia się sync statusów (bez komunikatu).
3. Użytkownik klika kartę celu → otwiera się `/app/goals/:id` (modal).
4. W sekcji progresu wpisuje wartość (+ opcjonalna notatka) i klika „Dodaj”.
5. Pojawia się dialog potwierdzenia (F‑17) → „Tak, zapisz”.
6. Po sukcesie: lista wpisów aktualizuje się, metryki/progres się przeliczają (local/optimistic).
7. Jeśli suma osiągnie target: UI pokazuje status „Zakończony sukcesem” i blokuje dodawanie/edycję progresu.

### 3.3 Zakończenie celu i AI summary (lazy)
1. Użytkownik otwiera modal zakończonego celu.
2. Jeśli spełnione warunki (completed_* + brak ai_summary + entries_count ≥ 3) → UI uruchamia generowanie i pokazuje stan „Generuję podsumowanie…”.
3. Sukces: wyświetla edytowalne pole podsumowania + (opcjonalnie) sugestię kolejnego celu.
4. Błąd 429/502: pokazuje komunikat + „Spróbuj ponownie” (do 3 razy).
5. Po 3 błędach: UI przełącza się na ręczny input + zapis przez PATCH.

### 3.4 Porzucenie celu
1. W modalu aktywnego celu użytkownik klika „Porzuć cel”.
2. Otwiera się dialog z listą powodów + „Inne…”.
3. Po potwierdzeniu: status zmienia się na „Porzucony”, progres i edycje zostają zablokowane.

### 3.5 Ponowienie / kontynuacja iteracji
- **Retry** (po failure/abandoned):
  1. Użytkownik klika „Spróbuj ponownie”.
  2. UI przechodzi do `/app/goals/new` z prefill (nazwa z poprzedniej iteracji, edytowalne target/deadline).
  3. Tworzy nowy cel jako nowa iteracja (parent linkage po stronie API).
- **Continue** (po success):
  1. Użytkownik klika „Kontynuuj”.
  2. UI prefill na bazie sugestii AI (jeśli istnieje) lub manualnie.
  3. Tworzy nową iterację.

---

## 4. Układ i struktura nawigacji

### 4.1 Nawigacja publiczna
- `/` → onboarding
- `/login` → logowanie
- `/register` → rejestracja
- Linki między login/register oraz CTA z onboarding.

### 4.2 Nawigacja w aplikacji (po zalogowaniu)
- Główna trasa: `/app/goals` (lista).
- Routing modalny (overlay na liście):
  - `/app/goals/new` → modal utworzenia celu
  - `/app/goals/:id` → modal szczegółów celu
- **Back/forward**:
  - `Back` zamyka modal do `/app/goals`,
  - `Forward` przywraca modal,
  - odświeżenie strony na `/app/goals/:id` utrzymuje stan modala (po ponownym fetchu danych).
- **Wylogowanie** dostępne w headerze na `/app/goals` (i dziedziczone wizualnie w modalach jako część tła/stałego headera).

---

## 5. Kluczowe komponenty

1. **AppHeader**
   - logo, greeting użytkownika, wylogowanie (ikona/przycisk).
   - dostępny na `/app/goals` i wizualnie stały przy otwartym modalu.

2. **GoalsToolbar**
   - filter status (dropdown), search (debounce), sort.
   - zarządza query state i refetch listy.

3. **GoalCard**
   - nazwa, status, days remaining (tylko active), circular progress + tekst alternatywny.
   - cała karta jako element nawigacyjny do `/app/goals/:id`.

4. **CircularProgress**
   - wizualizacja progresu + tekst „current/target” i procent,
   - `aria-label` np. „45 z 100, 45 procent”.

5. **ModalShell (Routing Modal)**
   - wspólny kontener dla `/app/goals/new` i `/app/goals/:id`,
   - `role="dialog"`, focus trap, `Esc`, przycisk zamknięcia `aria-label="Zamknij"`.

6. **GoalDetailsSections**
   - metryki, edycja celu (warunkowo), progres, notatki refleksyjne, AI summary, historia.

7. **ProgressEntryList + LoadMore**
   - lista wpisów progresu z paginacją „Load more”.
   - element wpisu z akcjami (tylko active).

8. **ProgressAddInlineForm**
   - dodanie wpisu (tylko active),
   - integracja z dialogiem potwierdzenia (F‑17).

9. **ConfirmDialog (shadcn/ui)**
   - potwierdzenie zapisu progresu,
   - potwierdzenie porzucenia, ewentualnie usunięcia wpisu.

10. **AbandonGoalDialog**
   - predefiniowane powody + „Inne…”, bez tekstowego inputu.

11. **AISummaryPanel**
   - stany: loading, success (editable), not enough data (412), error retry (429/502), manual fallback po 3 porażkach.

12. **ErrorState / EmptyState**
   - ujednolicone komponenty dla:
     - 404 (cel/progres),
     - 409 (nieaktywny/zablokowany),
     - puste listy (brak celów/wpisów),
     - 401 redirect (logika globalna, UI minimalne).

---

## Mapowanie historyjek użytkownika (PRD) do architektury UI

- **US-001 Rejestracja** → `/register` (formularz, walidacje, błędy, redirect do `/app/goals`)
- **US-002 Logowanie** → `/login` (formularz, błędy, redirect do `/app/goals`)
- **US-003 Wylogowanie** → AppHeader (akcja wylogowania)
- **US-004 Onboarding** → `/` (3 infografiki + CTA)
- **US-005 Tworzenie celu** → `/app/goals/new` (modal create)
- **US-006 Lista celów** → `/app/goals` (cards + sort/filter/search + load more)
- **US-007 Wizualizacja postępu** → GoalCard + GoalDetails (circular + metryki)
- **US-008 Dodawanie progresu** → GoalDetails: inline add + confirm dialog
- **US-009 Notatki refleksyjne** → GoalDetails: reflection_notes (zapis)
- **US-010 Auto sukces** → GoalDetails: status update + blokada progresu/edycji
- **US-011 Auto porażka** → silent sync na wejściu do listy + odzwierciedlenie w UI
- **US-012 Porzucenie** → Abandon dialog w GoalDetails
- **US-013 AI summary generowanie** → AISummaryPanel (lazy przy wejściu w modal)
- **US-014 Edycja summary** → AISummaryPanel (editable + zapis)
- **US-015 Retry AI + fallback** → AISummaryPanel (3 próby per tab, potem manual)
- **US-016 Ponowienie celu** → CTA „Spróbuj ponownie” w GoalDetails + prefill create modal
- **US-017 Kontynuacja po sukcesie** → CTA „Kontynuuj” w GoalDetails + prefill create modal
- **US-018 Historia iteracji** → sekcja Historia w GoalDetails + nawigacja do iteracji
- **US-019 Edycja wpisu progresu** → akcja „Edytuj” przy wpisie (tylko active) + confirm dialog

---

## Wymagania → elementy UI (jawne mapowanie)

- **F-01–F-03**: auth views + GoalDetails (blokada edycji pól po pierwszym wpisie).
- **F-04 / F-16**: Progress list + add/edit (tylko active) + blokady po zakończeniu.
- **F-05**: reflection_notes zawsze edytowalne w GoalDetails.
- **F-06**: status zawsze widoczny na karcie i w modalu.
- **F-07**: auto zakończenie odzwierciedlone po sync-statuses na wejściu do listy; „porzucony” wykluczony z auto.
- **F-08**: abandon dialog z powodami.
- **F-09–F-11**: AISummaryPanel z generowaniem lazy + sugestie w UI; edytowalność summary.
- **F-12–F-13**: historia iteracji + retry/continue flows, parent chain pokazany w Historii.
- **F-14**: progress visualization + days remaining.
- **F-15**: onboarding na `/`.
- **F-17**: confirm dialog przed zapisem progresu (add i edit).

---

## Edge cases i stany błędów (standard)

- **401**: globalny redirect do `/login` (dla tras `/app/*`).
- **404**: dedykowany stan w modalu celu (nie znaleziono) + CTA „Wróć do listy”.
- **409**:
  - przy próbie edycji zablokowanych pól: „Pola zablokowane / cel nieaktywny” (bez wchodzenia w przyczynę), CTA kontekstowe:
    - zakończone: retry/continue,
    - porzucone: retry,
    - w innych przypadkach: przejście do historii.
- **412** (AI): „Za mało danych (min. 3 wpisy)” w AISummaryPanel.
- **429/502** (AI): błąd + przycisk „Spróbuj ponownie” (do 3).
- **Puste stany**:
  - brak celów (lista) → CTA create,
  - brak wpisów progresu (w modalu) → CTA „Dodaj pierwszy wpis” (jeśli active).

---

## Potencjalne punkty bólu i mitigacje w UI

- **„Ciche” zablokowanie pól celu po pierwszym progresie** może być niezrozumiałe:
  - minimalna mitigacja bez łamania założenia: zachować spójne readonly + brak CTA „Edytuj” w tym obszarze; opcjonalnie subtelny hint wizualny (bez tekstowego wyjaśnienia).
- **AI summary i błędy providerów**:
  - jasne stany, retry limit, szybki fallback manualny.
- **Routing modalny**:
  - zapewnić intuicyjne zamykanie (X + Esc + Back) i stabilność po refresh.
