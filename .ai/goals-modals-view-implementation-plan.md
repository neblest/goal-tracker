# Plan implementacji widoku Goals Modals (Dodanie celu + Szczegóły celu)

## 1. Przegląd
Wdrożenie obejmuje dwa widoki w modelu „routing modalny”:
- Modal dodania celu pod `/app/goals/new`.
- Modal szczegółów celu pod `/app/goals/:id`.

Założenie architektoniczne spójne z obecną aplikacją: na route’ach modalnych renderujemy tło listy (`GoalsListPage`) i nakładamy na nie modal (React). Zamknięcie modala zawsze wraca do `/app/goals`.

## 2. Routing widoku

### 2.1 Modal: Dodanie celu
- Ścieżka: `/app/goals/new`
- Strona Astro: `src/pages/app/goals/new.astro`

### 2.2 Modal: Szczegóły celu
- Ścieżka: `/app/goals/:id`
- Strona Astro (parametr): `src/pages/app/goals/[goalId].astro`
- `goalId` przekazać do React jako props.

### 2.3 Zachowanie „modal routing”
- Wejście na `/app/goals/new` lub `/app/goals/:id` pokazuje modal nałożony na listę.
- Zamknięcie modala (X / Esc / klik w overlay) nawigacją do `/app/goals`.
- Jeśli ktoś trafi bezpośrednio na URL (bez historii), zamknięcie nadal kieruje do `/app/goals`.

## 3. Struktura komponentów

### 3.1 Widok `/app/goals/new`
- `Layout`
  - `main`
    - `GoalsListPage` (tło)
    - `GoalCreateModalPage` (modal)

### 3.2 Widok `/app/goals/:id`
- `Layout`
  - `main`
    - `GoalsListPage` (tło)
    - `GoalDetailsModalPage` (modal)

### 3.3 Diagram drzewa komponentów (wysokopoziomowo)

```
GoalCreateModalPage
└─ AppDialog
   ├─ GoalCreateForm
   └─ ErrorBanner (aria-live)

GoalDetailsModalPage
└─ AppDialog (full-height, wewnętrzny scroll)
   ├─ GoalDetailsHeader
   ├─ GoalMetricsSection
   ├─ GoalEditableFieldsSection
   ├─ GoalProgressSection
   │  ├─ ProgressList
   │  ├─ ProgressEntryRow (xN)
   │  ├─ ProgressInlineCreateForm
   │  └─ ConfirmProgressSaveDialog
   ├─ GoalReflectionNotesSection
   ├─ GoalAiSummarySection
   ├─ GoalHistorySection
   └─ GoalActionsSection
      ├─ AbandonGoalDialog
      └─ RetryContinueDialog (reuse GoalCreateForm)
```

## 4. Szczegóły komponentów

> Uwaga techniczna: w `package.json` nie ma `@radix-ui/react-dialog` ani `@radix-ui/react-alert-dialog`. Dla wymagań: focus trap, Esc zamyka, `role="dialog"` — rekomendowane jest dodanie shadcn/ui komponentów `dialog` oraz `alert-dialog` (lub bezpośrednio Radix).

### 4.1 GoalCreateModalPage
- Opis: Kontener dla modala tworzenia celu, spina walidację, submit, błędy oraz zamknięcie.
- Główne elementy HTML/dzieci:
  - `Dialog`/`DialogContent` + nagłówek i przycisk X.
  - `GoalCreateForm`.
  - Banner błędu globalnego z `aria-live="polite"`.
- Obsługiwane zdarzenia:
  - `onOpenChange(false)` / Esc / overlay → `onClose()`.
  - `onSubmit` → POST `/api/goals`.
- Warunki walidacji:
  - `name`: `trim()`, 1..500.
  - `target_value`: DecimalString, regex `^\d+(\.\d+)?$`, `parseFloat(value) > 0`.
  - `deadline`: `YYYY-MM-DD`, musi być w przyszłości (porównanie do lokalnego „dzisiaj” ustawionego na 00:00).
- Typy (DTO + VM):
  - `CreateGoalCommand`, `CreateGoalResponseDto`
  - `GoalCreateFormVm`, `GoalCreateFormErrors`
- Propsy: brak.

### 4.2 GoalCreateForm
- Opis: Reużywalny formularz (create + retry + continue).
- Główne elementy HTML/dzieci:
  - `<form>`
  - `Input` nazwa
  - `Input` target (string/DecimalString; preferowane `inputMode="decimal"`)
  - `Input type="date"` deadline
  - `Button` submit (loading/disabled)
  - komunikaty błędów per pole + globalny banner `aria-live`
- Obsługiwane zdarzenia:
  - `onChange` pól
  - `onSubmit` formularza
  - `onCancel` (opcjonalnie)
- Warunki walidacji:
  - jak w 4.1
  - budować `CreateGoalCommand` z wartościami po `trim()`
- Typy:
  - VM: `GoalCreateFormVm`
  - DTO: `CreateGoalCommand`
- Propsy:
  - `initialValues?: Partial<GoalCreateFormVm>`
  - `submitLabel: string`
  - `isSubmitting: boolean`
  - `apiError?: string | null`
  - `onSubmit: (command: CreateGoalCommand) => Promise<void> | void`
  - `onCancel?: () => void`

### 4.3 GoalDetailsModalPage
- Opis: Kontener szczegółów celu: pobiera dane celu, progres i historię, renderuje sekcje, obsługuje mutacje.
- Główne elementy HTML/dzieci:
  - `Dialog` pełnostronicowy do headera (wewnętrzny scroll)
  - sekcje 4.4–4.11
  - stany: loading / 404 / error
- Obsługiwane zdarzenia:
  - mount → `GET /api/goals/:goalId`
  - close → `/app/goals`
- Warunki walidacji:
  - `computed.is_locked === true` → blok edycji `name/target/deadline`
  - `status !== "active"` → ukryć/disable create/edit/delete progresu
- Typy:
  - DTO: `GetGoalResponseDto`, `UpdateGoalCommand`, `UpdateGoalResponseDto`
  - VM: `GoalDetailsVm`
- Propsy:
  - `goalId: string`

### 4.4 GoalDetailsHeader
- Opis: Nagłówek modala (nazwa + status + zamknięcie).
- Główne elementy:
  - `h2`, `Badge`, przycisk X
- Obsługiwane zdarzenia:
  - `onClose()`
- Walidacja: brak.
- Typy: `GoalStatus`.
- Propsy:
  - `name: string`
  - `status: GoalStatus`
  - `onClose: () => void`

### 4.5 GoalMetricsSection
- Opis: Metryki: kołowy progres + `X/Y` + `%` + `days_remaining` (tylko active).
- Główne elementy:
  - SVG kołowy + tekst
  - a11y: opis progresu (aria-label/aria-describedby)
- Obsługiwane zdarzenia: brak.
- Walidacja:
  - clamp percent do 0..100 dla wizualizacji.
- Typy:
  - pola z `GoalDetailsDto["computed"]`
- Propsy:
  - `currentValueText: string`
  - `targetValueText: string`
  - `progressPercent: number`
  - `daysRemaining: number`
  - `showDaysRemaining: boolean`

### 4.6 GoalEditableFieldsSection
- Opis: Edycja `name/target_value/deadline` do momentu pierwszego progresu.
- Główne elementy:
  - 3 pola + przycisk „Zapisz zmiany”
  - tryb readonly/disabled, gdy `is_locked === true` (bez dodatkowego komunikatu)
- Obsługiwane zdarzenia:
  - submit → PATCH `/api/goals/:goalId`
- Warunki walidacji:
  - jak w create, ale wysyłać tylko pola zmienione
  - UI blokuje submit, gdy `is_locked === true`
- Typy:
  - DTO: `UpdateGoalCommand`, `UpdateGoalResponseDto`
  - VM: `GoalEditFormVm` (lokalny w komponencie)
- Propsy:
  - `isLocked: boolean`
  - `initial: { name: string; target_value: string; deadline: string }`
  - `isSubmitting: boolean`
  - `apiError?: string | null`
  - `onSubmit: (command: UpdateGoalCommand) => Promise<void>`

### 4.7 GoalProgressSection
- Opis: Lista progresu + paginacja + create/edit/delete (tylko active) + potwierdzenie zapisu (F-17).
- Główne elementy:
  - `ProgressList`
  - `Load more`
  - `ProgressInlineCreateForm` (tylko active)
  - akcje przy wpisie (tylko active): „Edytuj”, opcjonalnie „Usuń”
  - `ConfirmProgressSaveDialog` przed create i edit
- Obsługiwane zdarzenia:
  - GET `/api/goals/:goalId/progress`
  - POST `/api/goals/:goalId/progress`
  - PATCH `/api/progress/:progressId`
  - DELETE `/api/progress/:progressId` (jeśli MVP wspiera)
- Warunki walidacji:
  - `value`: DecimalString, `> 0`
  - `notes`: max 2000
  - akcje tylko gdy `goal.status === "active"`
- Typy:
  - DTO: `GetGoalProgressResponseDto`, `CreateGoalProgressCommand`, `CreateGoalProgressResponseDto`, `UpdateProgressCommand`, `UpdateProgressResponseDto`, `DeleteProgressResponseDto`
  - VM: `ProgressEntryVm`, `ProgressDraftVm`, `ProgressListVm`
- Propsy:
  - `goalId: string`
  - `goalStatus: GoalStatus`
  - `onProgressChanged?: () => void`

### 4.8 GoalReflectionNotesSection
- Opis: Notatka refleksyjna, zawsze edytowalna.
- Implementacja (MVP): pole tekstowe + przycisk „Zapisz” → PATCH `/api/goals/:goalId` (`reflection_notes`).
- Obsługiwane zdarzenia:
  - `onSave(value)`
- Warunki walidacji:
  - brak twardych limitów w API (nie narzucać bez wymagania)
- Typy:
  - DTO: `UpdateGoalCommand`
- Propsy:
  - `value: string | null`
  - `isSubmitting: boolean`
  - `apiError?: string | null`
  - `onSave: (value: string | null) => Promise<void>`

### 4.9 GoalAiSummarySection
- Opis: AI summary po zakończeniu.
- Warianty UI:
  - Jeśli `completed_*` i `ai_summary` jest → edycja + zapis.
  - Jeśli `completed_*`, brak `ai_summary` i `entries_count >= 3` → lazy generate + retry do 3.
  - Jeśli `entries_count < 3` → „Za mało danych (min. 3 wpisy)”.
- Uwaga integracyjna:
  - W repo nie ma implementacji dedykowanych endpointów `ai-summary/generate` i `ai-summary`. Do czasu backendu:
    - zapis edycji `ai_summary` realizować przez `PATCH /api/goals/:goalId`.
    - generowanie ukryć/wyłączyć.
- Typy:
  - docelowo: `GenerateAiSummaryCommand`, `GenerateAiSummaryResponseDto`, `UpdateAiSummaryCommand`, `UpdateAiSummaryResponseDto`
  - tymczasowo: `UpdateGoalCommand` (pole `ai_summary`)
- Propsy:
  - `status: GoalStatus`
  - `entriesCount: number`
  - `aiSummary: string | null`
  - `onSave: (aiSummary: string) => Promise<void>`
  - `onGenerate?: (force?: boolean) => Promise<void>`

### 4.10 GoalHistorySection
- Opis: Historia iteracji w łańcuchu.
- Główne elementy:
  - lista iteracji z linkami do `/app/goals/{id}`
- Obsługiwane zdarzenia:
  - fetch → GET `/api/goals/:goalId/history`
  - klik iteracji → nawigacja do innego `goalId`
- Typy:
  - DTO: `GetGoalHistoryResponseDto`, `GoalHistoryItemDto`
  - VM: `GoalHistoryItemVm`
- Propsy:
  - `items: GoalHistoryItemVm[]`
  - `activeGoalId: string`

### 4.11 GoalActionsSection
- Opis: Akcje kontekstowe:
  - active: „Porzuć” (dialog) → POST `/api/goals/:goalId/abandon`
  - completed_failure/abandoned: „Spróbuj ponownie” → POST `/api/goals/:goalId/retry`
  - completed_success: „Kontynuuj” → POST `/api/goals/:goalId/continue`
- Warunki walidacji:
  - `reason`: 1..2000
  - `target_value` > 0, `deadline` w przyszłości (retry/continue)
- Typy:
  - `AbandonGoalCommand`, `AbandonGoalResponseDto`
  - `RetryGoalCommand`, `RetryGoalResponseDto`
  - `ContinueGoalCommand`, `ContinueGoalResponseDto`
- Propsy:
  - `goalId: string`
  - `status: GoalStatus`
  - `prefill: { name: string; target_value: string; deadline: string }`
  - `onGoalCreated: (newGoalId: string) => void`

## 5. Typy

### 5.1 Nowe typy ViewModel (proponowane)

#### GoalCreateFormVm
- `name: string`
- `target_value: string` (DecimalString)
- `deadline: string` (YYYY-MM-DD)
- `parent_goal_id?: string | null`

#### GoalCreateFormErrors
- `name?: string`
- `target_value?: string`
- `deadline?: string`
- `form?: string`

#### GoalDetailsVm
- Mapowanie 1:1 z `GetGoalResponseDto.data.goal`.

#### ProgressEntryVm
- Mapowanie 1:1 z `GoalProgressEntryDto`.

#### ProgressDraftVm
- `value: string`
- `notes: string`

#### ProgressListVm
- `items: ProgressEntryVm[]`
- `page: number`
- `pageSize: number`
- `total: number`

#### GoalHistoryItemVm
- `id: string`
- `name: string`
- `deadline: string`
- `status: GoalStatus`
- `currentValueText: string`
- `aiSummaryPresent: boolean`
- `isActiveInUi: boolean`

## 6. Zarządzanie stanem

### 6.1 Zasady
- Stan lokalny w komponentach/hookach React.
- Do wywołań HTTP używać `apiFetchJson` i obsługi `ApiError`.
- 401: `apiFetchJson` zrobi redirect do `/login`.

### 6.2 Proponowane hooki
- `useGoalCreate()`
- `useGoalDetails(goalId)`
- `useGoalProgress(goalId, enabled)`
- `useGoalHistory(goalId)`
- `useGoalMutations(goalId)`

## 7. Integracja API

### 7.1 Dodanie celu
- POST `/api/goals`
  - Request: `CreateGoalCommand`
  - Response: `CreateGoalResponseDto`
- Po sukcesie: zamknąć modal i wrócić do `/app/goals` (lista odświeży się przez własny fetch).

### 7.2 Szczegóły celu
- GET `/api/goals/:goalId` → `GetGoalResponseDto`
- PATCH `/api/goals/:goalId` → `UpdateGoalResponseDto`

### 7.3 Progres
- GET `/api/goals/:goalId/progress` → `GetGoalProgressResponseDto`
- POST `/api/goals/:goalId/progress` → `CreateGoalProgressResponseDto`
- PATCH `/api/progress/:progressId` → `UpdateProgressResponseDto`
- DELETE `/api/progress/:progressId` → `204`

### 7.4 Historia
- GET `/api/goals/:goalId/history` → `GetGoalHistoryResponseDto`

### 7.5 Lifecycle
- POST `/api/goals/:goalId/abandon`
- POST `/api/goals/:goalId/retry`
- POST `/api/goals/:goalId/continue`

## 8. Interakcje użytkownika

### 8.1 Dodanie celu
- Submit:
  - walidacja UI
  - loading
  - sukces: zamknij i wróć do listy
  - błąd: pokaż banner + błędy pól
- Zamknięcie: Esc/overlay/X.

### 8.2 Szczegóły celu
- Progres:
  - create/edit: potwierdzenie zapisu (F-17)
  - akcje ukryte/disabled gdy status != active
- Historia:
  - klik iteracji przełącza modal na inny `goalId`.

## 9. Warunki i walidacja
- `computed.is_locked` steruje edycją pól celu.
- `status` steruje akcjami progresu.
- Wartości liczbowe przesyłać jako string (DecimalString) i walidować `> 0`.
- `deadline` zawsze w przyszłości.

## 10. Obsługa błędów
- 401: auto redirect do `/login`.
- 404: stan „Nie znaleziono celu” w modalu + CTA powrotu.
- 409: komunikat (pola zablokowane / cel nieaktywny) + aktualizacja UI (disable).
- 422: komunikaty walidacji.
- 5xx/network: komunikat ogólny + retry.

## 11. Kroki implementacji
1. Dodać strony Astro:
   - `src/pages/app/goals/new.astro`
   - `src/pages/app/goals/[goalId].astro`
2. Dodać komponenty React w `src/components/goals/modals/`:
   - `GoalCreateModalPage.tsx`
   - `GoalDetailsModalPage.tsx`
3. Dodać shadcn/ui `dialog` i `alert-dialog`.
4. Dodać hooki w `src/components/hooks/` i spiąć je z endpointami.
5. Zaimplementować sekcje modala szczegółów i mutacje.
6. Dodać potwierdzenie zapisu progresu (create + edit) jako `AlertDialog`.
7. Przejść po scenariuszach błędów i a11y (focus trap, Esc, aria-live).
