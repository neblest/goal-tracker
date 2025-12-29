# Plan implementacji widoku Lista celów (Home po zalogowaniu)

## 1. Przegląd
Widok „Lista celów” pod ścieżką `/app/goals` jest domyślnym ekranem po zalogowaniu (US-006). Ma dawać szybki przegląd celów użytkownika w formie kart, umożliwiać filtrowanie po statusie, wyszukiwanie (z debounce), sortowanie oraz paginację typu „Load more”.

Dodatkowo, przy wejściu na widok ma się wykonać w tle (bez UI) synchronizacja statusów przez `POST /api/goals/sync-statuses`, a następnie (opcjonalnie) dyskretny refetch listy.

## 2. Routing widoku
- Ścieżka: `/app/goals`
- Proponowana implementacja routingu (Astro): `src/pages/app/goals/index.astro`
- Deep link do szczegółów celu (wymóg nawigacji z karty): `/app/goals/:id`
  - Proponowana ścieżka strony szczegółów: `src/pages/app/goals/[goalId]/index.astro` (poza zakresem tego planu, ale linki z kart muszą do niej prowadzić).

Uwagi dot. repo:
- Aktualnie w repo nie ma jeszcze katalogu `src/pages/app/*` ani `/login`. W tym planie przyjmujemy, że istnieje (lub powstanie) ścieżka `/login` do redirectu po 401.

## 3. Struktura komponentów
Widok ma być renderowany jako strona Astro, a cała interaktywność (filtry/szukaj/sort/paginacja) ma być realizowana w komponencie React.

Proponowana hierarchia:
- `src/pages/app/goals/index.astro`
  - `Layout` (istnieje: `src/layouts/Layout.astro`)
  - `<main>`
    - `GoalsListPage` (React island, np. `client:load`)

Wewnątrz React:
- `GoalsListPage`
  - `AppHeader`
  - `GoalsListControls`
  - `GoalsGrid`
    - `GoalCard` (w pętli)
  - `LoadMoreSection`
  - `EmptyState` (warunkowo)

## 4. Szczegóły komponentów

### `src/pages/app/goals/index.astro`
- Opis: Strona routingu dla `/app/goals`. Odpowiada za strukturę dokumentu, osadzenie layoutu i zamontowanie React island.
- Główne elementy:
  - `Layout` (wrapper)
  - `<main aria-label="Lista celów">` jako landmark
  - React island `GoalsListPage`
- Zdarzenia: brak (statyczny host)
- Walidacja: brak
- Typy: brak
- Propsy: brak

### `GoalsListPage` (React) — główny kontener
- Opis: Orkiestruje ładowanie danych, wywołania API, stan filtrów/szukania/sortowania/paginacji oraz renderuje UI.
- Główne elementy:
  - `<header>` sticky (z `AppHeader` + kontrolkami listy)
  - `<section>` z gridem kart
  - Sekcja „Load more”
- Obsługiwane zdarzenia:
  - `onMount`: silent `sync-statuses`, potem `fetchGoals(page=1)`
  - `onStatusChange`, `onSearchChange` (debounced), `onSortChange`, `onOrderChange`
  - `onLoadMore`
  - `onLogout`
- Warunki walidacji (frontend → zgodne z API):
  - `status`: tylko `active | completed_success | completed_failure | abandoned`
  - `q`: trim, długość 1–200 (gdy niepuste); pusty string oznacza brak parametru
  - `sort`: `created_at` (domyślnie) lub `deadline`
  - `order`: `asc` lub `desc` (domyślnie `desc`)
  - `page`: `>= 1`
  - `pageSize`: `1..100` (rekomendowane 20)
- Typy (DTO/ViewModel):
  - DTO: `GetGoalsResponseDto`, `GetGoalsQueryDto`, `GoalListItemDto` (z `src/types.ts`)
  - ViewModel: `GoalCardVm`, `GoalsListState`
- Propsy:
  - Jeśli w przyszłości SSR: opcjonalne `initialData?: GetGoalsResponseDto` (na teraz nie wymagane)

### `AppHeader` (React)
- Opis: Header aplikacji: logo po lewej oraz powitanie użytkownika + wylogowanie po prawej. Ma być sticky, żeby szybkie wylogowanie było zawsze dostępne.
- Główne elementy:
  - `<div role="banner">` lub semantycznie `<header>`
  - Logo jako link (np. do `/app/goals`)
  - Tekst „Cześć, {email|użytkowniku}”
  - Przycisk „Wyloguj” (Shadcn `Button`)
- Zdarzenia:
  - `onClickLogout`
- Walidacja:
  - Brak — to akcja
- Typy:
  - `AppHeaderVm`: `{ displayName: string }`
- Propsy:
  - `userDisplayName: string`
  - `onLogout: () => void`

### `GoalsListControls` (React)
- Opis: Panel kontroli listy: status dropdown, wyszukiwarka z debounce, sortowanie.
- Główne elementy:
  - Kontener sticky (wspólnie z headerem lub jako część sticky wrappera)
  - Dropdown statusu (Shadcn `Select` — do zainstalowania)
  - Input wyszukiwarki (Shadcn `Input` — do zainstalowania)
  - Dropdown sortowania (Shadcn `Select`)
  - Opcjonalnie kontrolka kolejności (np. toggle/Select) — jeśli UX tego wymaga; minimalnie można trzymać `order` jako stałe `desc` i udostępnić tylko wybór `sort`.
- Zdarzenia:
  - `onChangeStatus(status)`
  - `onChangeSearch(text)`
  - `onChangeSort(sort)`
  - `onChangeOrder(order)` (jeśli eksponowane)
- Walidacja:
  - `search`: trim; jeśli po trim jest `""` → usuń filtr
  - `search` max 200; powyżej utnij lub blokuj wpisywanie (zalecane: blokuj przez `maxLength=200`)
- Typy:
  - `GoalsListFiltersVm`
- Propsy:
  - `status: GoalStatus`
  - `search: string`
  - `sort: "created_at" | "deadline"`
  - `order: "asc" | "desc"`
  - `onStatusChange`, `onSearchChange`, `onSortChange`, `onOrderChange`

### `GoalsGrid` (React)
- Opis: Siatka kart: 1 kolumna mobile, 2–3 desktop.
- Główne elementy:
  - `<section aria-label="Cele">`
  - `div` z klasami Tailwind grid, np. `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
  - Render listy `GoalCard`
- Zdarzenia: brak (delegowane do linków w kartach)
- Walidacja:
  - Jeśli `items.length === 0` → nie renderować gridu, tylko `EmptyState`
- Typy:
  - `GoalCardVm[]`
- Propsy:
  - `items: GoalCardVm[]`

### `GoalCard` (React)
- Opis: Pojedyncza karta celu jako link do `/app/goals/:id`. Wyświetla nazwę, kołowy progres + tekst, status oraz „Pozostało X dni” tylko dla aktywnych.
- Główne elementy:
  - Semantycznie link: `<a href={...}>` obejmujący całą kartę
  - Nazwa celu jako nagłówek (`<h3>`)
  - Kołowy progres (SVG):
    - `aria-label` np. „Postęp 45% (45/100)”
  - Tekst: `"{current}/{target}, {percent}%"`
  - Badge statusu (Shadcn `Badge` — do zainstalowania) lub prosty tekst, jeśli minimalnie
  - Dla `active`: tekst `"Pozostało {days_remaining} dni"`
- Zdarzenia:
  - Na klik/enter: nawigacja linkiem
- Walidacja:
  - `progress_percent`: render w zakresie 0..100+; SVG powinien clampować do 0..100 dla obwodu (ale tekst może pokazać 120%)
  - `days_remaining` render tylko gdy `status === "active"`
- Typy:
  - `GoalCardVm`
- Propsy:
  - `item: GoalCardVm`

### `LoadMoreSection` (React)
- Opis: Sekcja przycisku „Load more” i stanu ładowania.
- Główne elementy:
  - Przycisk (Shadcn `Button`)
  - Tekst pomocniczy (np. „Ładowanie…”)
- Zdarzenia:
  - `onClickLoadMore`
- Walidacja:
  - Ukryj/wyłącz przycisk gdy `items.length >= total` lub gdy trwa request
- Typy:
  - `LoadMoreVm`
- Propsy:
  - `canLoadMore: boolean`
  - `isLoadingMore: boolean`
  - `onLoadMore: () => void`

### `EmptyState` (React)
- Opis: Pusty stan: brak celów → komunikat „Brak celów” + CTA „Utwórz cel”.
- Główne elementy:
  - `<section aria-live="polite">`
  - Tekst „Brak celów”
  - CTA jako link lub przycisk-link
- Zdarzenia:
  - `onClickCreateGoal` (nawigacja)
- Walidacja: brak
- Typy:
  - `EmptyStateVm`
- Propsy:
  - `onCreateGoal: () => void`

Uwaga dot. CTA „Utwórz cel”:
- Spec nie podaje docelowej ścieżki widoku tworzenia. Najprostsze założenie: `/app/goals/new`.
- Jeśli w projekcie zostanie przyjęty inny routing, CTA powinno kierować do właściwej ścieżki.

## 5. Typy

### DTO (istniejące w `src/types.ts`)
- `GetGoalsQueryDto`
  - `status?: GoalStatus`
  - `q?: string`
  - `sort?: "created_at" | "deadline"`
  - `order?: "asc" | "desc"`
  - `page?: number`
  - `pageSize?: number`
- `GetGoalsResponseDto = ApiSuccessDto<OffsetPaginatedDto<GoalListItemDto>>`
- `GoalListItemDto`
  - pola publiczne celu + `computed`
- `GoalComputedListDto`
  - `current_value: DecimalString`
  - `progress_ratio: number`
  - `progress_percent: number`
  - `is_locked: boolean`
  - `days_remaining: number`

### ViewModel (do dodania na froncie — rekomendowana warstwa)
Celem jest uproszczenie renderowania i odizolowanie UI od szczegółów DTO.

- `type GoalsStatusFilter = "active" | "completed_success" | "completed_failure" | "abandoned";`
  - Można użyć istniejącego `GoalStatus`.

- `interface GoalsListQueryState`:
  - `status: GoalsStatusFilter` (domyślnie `"active"`)
  - `search: string` (domyślnie `""`)
  - `sort: "created_at" | "deadline"` (domyślnie `"created_at"`)
  - `order: "asc" | "desc"` (domyślnie `"desc"`)
  - `pageSize: number` (domyślnie `20`)

- `interface GoalsListPaginationState`:
  - `page: number` (start `1`)
  - `total: number`

- `interface GoalCardVm`:
  - `id: string`
  - `href: string` (np. `/app/goals/${id}`)
  - `name: string`
  - `status: GoalsStatusFilter`
  - `currentValueText: string` (np. `"45"`)
  - `targetValueText: string` (np. `"100"`)
  - `progressPercent: number` (np. `45`)
  - `daysRemaining: number`
  - `showDaysRemaining: boolean` (`status === "active"`)

- `interface GoalsListVm`:
  - `items: GoalCardVm[]`
  - `page: number`
  - `pageSize: number`
  - `total: number`
  - `canLoadMore: boolean` (`items.length < total`)

- `type GoalsListErrorKind = "unauthenticated" | "invalid_query" | "network" | "server" | "unknown";`

## 6. Zarządzanie stanem

Rekomendacja: wydzielić logikę do custom hooka, aby komponenty prezentacyjne były proste.

### Custom hook: `useGoalsList()`
Lokalizacja: `src/components/hooks/useGoalsList.ts`

Odpowiedzialności:
- Trzymanie stanu filtrów/sortowania/paginacji
- Debounce wyszukiwania
- Ładowanie listy celów z akumulacją wyników dla „Load more”
- Obsługa silent `sync-statuses` przy mount
- Obsługa błędów i 401 redirect

Proponowany stan wewnętrzny:
- `queryState: GoalsListQueryState`
- `rawSearch: string` (wartość inputa)
- `debouncedSearch: string` (np. 300ms)
- `items: GoalListItemDto[]` (lub od razu `GoalCardVm[]`)
- `page: number`
- `total: number`
- `isInitialLoading: boolean`
- `isLoadingMore: boolean`
- `error: { kind: GoalsListErrorKind; message: string } | null`

Debounce:
- Hook `useDebouncedValue(value, delayMs)` w `src/components/hooks/useDebouncedValue.ts`
- `rawSearch` → `debouncedSearch` → trigger refetch.

Zasada refetch:
- Zmiana `status/sort/order/debouncedSearch`:
  - reset `page=1`, wyczyść `items`, pobierz pierwszą stronę
- Klik „Load more”:
  - `page + 1`, pobierz kolejną stronę i dopisz do listy

## 7. Integracja API

### 7.1 GET `/api/goals`
- Request:
  - Metoda: GET
  - Query params:
    - `status` (domyślnie `active`)
    - `q` (opcjonalne, tylko gdy po trim ma długość 1–200)
    - `sort` (domyślnie `created_at`)
    - `order` (domyślnie `desc`)
    - `page` (1..n)
    - `pageSize` (np. 20)
- Response (200): `GetGoalsResponseDto`
- Błędy:
  - `401` → redirect do `/login`
  - `400` → potraktować jako błąd konfiguracji query (pokaż komunikat, nie zapętlaj refetch)

Mapowanie danych do VM:
- `GoalListItemDto.target_value` i `computed.current_value` są `DecimalString` → w UI wyświetlać jako string (bez konwersji do float, poza ewentualnym clampem do SVG).

### 7.2 POST `/api/goals/sync-statuses` (silent)
- Request:
  - Metoda: POST
  - Body: brak lub `{}`
- Response: `SyncStatusesResponseDto` (niepotrzebne do UI)
- Zachowanie:
  - Uruchomić w `useEffect` na mount
  - Nie pokazywać spinnera
  - Jeśli 401 → redirect do `/login`
  - Jeśli 4xx/5xx → zignorować (log w konsoli) i kontynuować ładowanie listy
  - Opcjonalnie: jeśli response ma `updated.length > 0` → wykonać refetch listy

### Warstwa fetch (rekomendowana)
Dla spójnej obsługi 401 i JSON:
- Helper `apiFetchJson<T>(input, init)` w `src/lib/api/apiFetchJson.ts` (lub w komponencie, jeśli projekt jest mały)
- Funkcje:
  - Dodanie nagłówka `Authorization` jeśli aplikacja przechowuje token (na dziś backend ma DEV user id, ale kontrakt docelowo wymaga JWT)
  - Jeśli `res.status === 401` → `window.location.href = "/login"`
  - Parsowanie `{ data }` i zwrot typowany

## 8. Interakcje użytkownika

- Zmiana filtra statusu:
  - Reset listy do strony 1
  - Pobranie danych z nowym `status`

- Wpisywanie w wyszukiwarkę:
  - Aktualizuje `rawSearch`
  - Po debounce (np. 300ms) wykonuje refetch

- Zmiana sortowania:
  - Domyślnie `created_at desc`
  - Użytkownik może wybrać `deadline` (a order pozostaje `desc` lub jest kontrolowany osobno — zależnie od UI)

- Kliknięcie karty celu:
  - Nawigacja do `/app/goals/:id`
  - Karta ma pełny focus ring (wymóg dostępności)

- Kliknięcie „Load more”:
  - Pobiera kolejną stronę i dopisuje wyniki
  - Przycisk disabled podczas ładowania

- Kliknięcie „Wyloguj”:
  - Wylogowanie (docelowo Supabase Auth) i redirect do `/login`

- Pusty stan:
  - Klik „Utwórz cel” → nawigacja do widoku tworzenia celu

## 9. Warunki i walidacja

Walidacje po stronie UI (zgodne z kontraktem API):
- `status`:
  - UI powinno generować wyłącznie wartości dozwolone przez API.
- `q`:
  - `trim()`
  - jeśli pusty → nie wysyłać parametru `q`
  - `maxLength=200` na input
- `page/pageSize`:
  - `page` zawsze >= 1
  - `pageSize` w zakresie 1–100 (rekomendowane 20)
- `sort/order`:
  - tylko dozwolone enumy

Warunki renderowania w UI:
- „Pozostało X dni”:
  - render tylko gdy `status === "active"`
- Progres kołowy:
  - strokeDashoffset liczyć na podstawie `clamp(progress_percent, 0, 100)`
  - tekst procentu może pokazywać wartości >100 (jeśli API zwraca)
- „Load more”:
  - dostępne tylko gdy `items.length < total`

## 10. Obsługa błędów

Scenariusze i zachowanie:
- `401 unauthenticated` (GET lub POST sync):
  - natychmiastowy redirect do `/login`
- `400 invalid query params`:
  - pokaż komunikat błędu w UI (np. alert na górze listy)
  - zatrzymaj automatyczne ponawianie
- Błędy sieciowe (offline, timeout):
  - pokaż komunikat „Nie udało się pobrać celów. Spróbuj ponownie.” + przycisk retry
- `5xx`:
  - analogicznie jak network
- `sync-statuses` błąd:
  - silent: nie blokuj listy

Dostępność błędów:
- Komunikat błędu w kontenerze `aria-live="polite"`.

## 11. Kroki implementacji

1. Dodać routing strony
   - Utworzyć `src/pages/app/goals/index.astro`.
   - Osadzić `Layout` i `GoalsListPage` jako React island (`client:load`).

2. Dodać komponenty React (struktura)
   - Utworzyć `src/components/goals/GoalsListPage.tsx`.
   - Utworzyć komponenty prezentacyjne: `AppHeader`, `GoalsListControls`, `GoalsGrid`, `GoalCard`, `LoadMoreSection`, `EmptyState`.

3. Zainstalować wymagane komponenty Shadcn
   - `npx shadcn@latest add input select card badge` (lub minimalny zestaw: `input select`).
   - Używać `cn` z `src/lib/utils.ts`.

4. Dodać hooki
   - `src/components/hooks/useDebouncedValue.ts`
   - `src/components/hooks/useGoalsList.ts`

5. Dodać warstwę API fetch
   - Helper do GET/POST z obsługą 401 redirect.
   - Funkcja `buildGoalsQueryParams(queryState, page)`.

6. Zaimplementować logikę silent sync-statuses
   - W `useGoalsList` na mount wywołać `POST /api/goals/sync-statuses`.
   - Po zakończeniu wykonać `fetchGoals(1)`.
   - Opcjonalnie refetch, jeśli `updated.length > 0`.

7. Zaimplementować pobieranie listy i paginację „Load more”
   - `fetchGoals(page)`:
     - page=1: replace list
     - page>1: append
   - `canLoadMore = items.length < total`.

8. Zaimplementować kontrolki filtrów i debounce
   - Domyślne: `status=active`, `sort=created_at`, `order=desc`.
   - Wyszukiwarka: debounce ~300ms.

9. Zaimplementować UI kart i dostępność
   - Karta jako `<a>` z pełnym focus ring.
   - Kołowy progres w SVG + tekst `current/target, percent%`.
   - `Pozostało X dni` tylko dla aktywnych.

10. Dodać obsługę pustych stanów i błędów
   - Empty: „Brak celów” + CTA „Utwórz cel”.
   - Error: komunikat + retry.

11. Weryfikacja
   - Ręcznie: sprawdzić filtry, wyszukiwanie, sort, load more.
   - Sprawdzić 401: zasymulować (np. tymczasowo wymusić 401 w API) i potwierdzić redirect.

