# API Endpoint Implementation Plan: AI Summary Endpoints

## 1. Przegląd punktów końcowych

Ten plan obejmuje dwa powiązane endpointy do obsługi podsumowań AI dla celów:

### POST `/api/goals/:goalId/ai-summary/generate`
Synchroniczne generowanie podsumowania AI dla zakończonego celu (sukces lub porażka). Wymaga minimum 3 wpisów progress. Zwraca wygenerowane podsumowanie oraz sugestię następnego celu.

### PATCH `/api/goals/:goalId/ai-summary`
Edycja istniejącego podsumowania AI lub ręczne wprowadzenie własnego podsumowania (np. po błędach generacji AI).

---

## 2. Szczegóły żądań

### 2.1 POST `/api/goals/:goalId/ai-summary/generate`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/api/goals/:goalId/ai-summary/generate`
- **Uwierzytelnianie**: wymagane (`Authorization: Bearer <access_token>`)

**Parametry:**
- Wymagane:
  - `goalId` (path) - UUID celu
- Opcjonalne:
  - `force` (body) - boolean, domyślnie `false`. Jeśli `true`, wymusza regenerację nawet gdy podsumowanie już istnieje

**Request Body (opcjonalny):**
```json
{ "force": false }
```

**Walidacja (Zod):**
- `goalId`: `z.string().uuid()` - błędy formatu jako `400`
- Body (opcjonalny):
  - `force`: `z.boolean().optional().default(false)`
- Błędy walidacji body - `422`

### 2.2 PATCH `/api/goals/:goalId/ai-summary`

- **Metoda HTTP**: `PATCH`
- **Struktura URL**: `/api/goals/:goalId/ai-summary`
- **Uwierzytelnianie**: wymagane (`Authorization: Bearer <access_token>`)

**Parametry:**
- Wymagane:
  - `goalId` (path) - UUID celu
  - `ai_summary` (body) - string, niepusty

**Request Body:**
```json
{ "ai_summary": "My own summary..." }
```

**Walidacja (Zod):**
- `goalId`: `z.string().uuid()` - błędy formatu jako `400`
- Body:
  - `ai_summary`: `z.string().trim().min(1).max(5000)` - wymagany, niepusty, max 5000 znaków
- Błędy walidacji body - `422`

---

## 3. Wykorzystywane typy

### DTO i Command Models (z `src/types.ts`):

```typescript
// Command dla generacji AI
interface GenerateAiSummaryCommand {
  force?: boolean;
}

// Sugestia następnego celu
interface AiSummaryNextGoalSuggestionDto {
  name: DbGoalRow["name"];
  target_value: DecimalString;
  deadline_hint_days: number;
}

// Odpowiedź generacji AI
type GenerateAiSummaryResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id"> & {
    ai_summary: NonNullable<DbGoalRow["ai_summary"]>;
  };
  suggestions: {
    next_goal: AiSummaryNextGoalSuggestionDto;
  };
}>;

// Command dla aktualizacji
interface UpdateAiSummaryCommand {
  ai_summary: NonNullable<DbGoalRow["ai_summary"]>;
}

// Odpowiedź aktualizacji
type UpdateAiSummaryResponseDto = ApiSuccessDto<{
  goal: Pick<GoalPublicFieldsDto, "id" | "ai_summary">;
}>;
```

### Wykorzystywane typy błędów:
- `ApiErrorDto<"invalid_path_params">` - nieprawidłowy format goalId
- `ApiErrorDto<"not_authenticated">` - brak uwierzytelnienia
- `ApiErrorDto<"goal_not_found">` - cel nie istnieje
- `ApiErrorDto<"invalid_goal_state">` - nieprawidłowy stan celu (409)
- `ApiErrorDto<"not_enough_data">` - za mało wpisów progress (412)
- `ApiErrorDto<"rate_limited">` - przekroczono limit żądań (429)
- `ApiErrorDto<"ai_provider_error">` - błąd dostawcy AI (502)
- `ApiErrorDto<"validation_error">` - błąd walidacji (422)
- `ApiErrorDto<"internal_error">` - błąd wewnętrzny (500)

---

## 4. Szczegóły odpowiedzi

### 4.1 POST `/api/goals/:goalId/ai-summary/generate`

**Sukces (200):**
```json
{
  "data": {
    "goal": {
      "id": "uuid",
      "ai_summary": "Generated summary about your goal progress..."
    },
    "suggestions": {
      "next_goal": {
        "name": "Run 120 km",
        "target_value": "120",
        "deadline_hint_days": 30
      }
    }
  }
}
```

### 4.2 PATCH `/api/goals/:goalId/ai-summary`

**Sukces (200):**
```json
{
  "data": {
    "goal": {
      "id": "uuid",
      "ai_summary": "My own summary..."
    }
  }
}
```

---

## 5. Przepływ danych

### 5.1 POST `/api/goals/:goalId/ai-summary/generate`

```
┌─────────────┐     ┌──────────────┐     ┌────────────────────┐     ┌───────────────┐
│   Client    │────>│  API Route   │────>│  AI Summary        │────>│   Openrouter  │
│             │     │  (Astro)     │     │  Service           │     │   AI API      │
└─────────────┘     └──────────────┘     └────────────────────┘     └───────────────┘
                           │                      │
                           │                      │
                           v                      v
                    ┌──────────────┐       ┌──────────────┐
                    │  Auth        │       │  Supabase    │
                    │  Validation  │       │  Database    │
                    └──────────────┘       └──────────────┘
```

**Szczegółowy przepływ:**

1. **Route** (`src/pages/api/goals/[goalId]/ai-summary/generate.ts`):
   - Waliduje `goalId` (Zod - UUID)
   - Parsuje opcjonalne JSON body i waliduje `force` (Zod)
   - Uwierzytelnia użytkownika (`getUserFromRequest`)
   - Wywołuje serwis AI Summary

2. **Service** (`src/lib/services/ai-summary.service.ts`):
   - Pobiera cel z bazy: `SELECT id, name, target_value, deadline, status, ai_summary FROM goals WHERE id = goalId AND user_id = userId`
   - Sprawdza czy cel istnieje - jeśli nie: `goal_not_found`
   - Sprawdza status celu - musi być `completed_success` lub `completed_failure` (nie `active`, nie `abandoned`):
     - Jeśli `active`: błąd `invalid_goal_state` ("Goal is still active")
     - Jeśli `abandoned`: błąd `invalid_goal_state` ("Cannot generate summary for abandoned goal")
   - Jeśli `ai_summary` już istnieje i `force !== true`: zwraca istniejące podsumowanie bez regeneracji
   - Liczy wpisy progress: `SELECT COUNT(*) FROM goal_progress WHERE goal_id = goalId`
   - Jeśli < 3: błąd `not_enough_data`
   - Pobiera dane progress do kontekstu: `SELECT value, notes, created_at FROM goal_progress WHERE goal_id = goalId ORDER BY created_at`
   - Wywołuje Openrouter AI API z promptem zawierającym dane celu i progress
   - Parsuje odpowiedź AI (podsumowanie + sugestia następnego celu)
   - Zapisuje `ai_summary` do bazy: `UPDATE goals SET ai_summary = ? WHERE id = goalId`
   - Zwraca `{ goal: { id, ai_summary }, suggestions: { next_goal: {...} } }`

3. **Route**: Zwraca `GenerateAiSummaryResponseDto`

### 5.2 PATCH `/api/goals/:goalId/ai-summary`

1. **Route** (`src/pages/api/goals/[goalId]/ai-summary/index.ts`):
   - Waliduje `goalId` (Zod - UUID)
   - Parsuje JSON body i waliduje `ai_summary` (Zod)
   - Uwierzytelnia użytkownika (`getUserFromRequest`)
   - Wywołuje serwis AI Summary

2. **Service** (`src/lib/services/ai-summary.service.ts`):
   - Sprawdza czy cel istnieje i należy do użytkownika
   - Aktualizuje `ai_summary`: `UPDATE goals SET ai_summary = ? WHERE id = goalId AND user_id = userId`
   - Zwraca `{ id, ai_summary }`

3. **Route**: Zwraca `UpdateAiSummaryResponseDto`

---

## 6. Względy bezpieczeństwa

### 6.1 Uwierzytelnianie i autoryzacja
- **AuthN**: Wymagany Bearer token w nagłówku Authorization
- **AuthZ**: Wszystkie zapytania DB filtrowane po `user_id` (defense-in-depth)
- RLS w Supabase jako dodatkowa warstwa (RLS zapewnia że użytkownik widzi tylko swoje cele)

### 6.2 Walidacja danych wejściowych
- **goalId**: UUID - zapobiega injection attacks
- **ai_summary**:
  - Trim whitespace
  - Min 1 znak (niepusty)
  - Max 5000 znaków (zapobiega nadużyciom pamięci/storage)
- **force**: Boolean - ścisły typ

### 6.3 Rate Limiting
- Endpoint `/generate` wymaga szczególnego rate limitingu ze względu na:
  - Koszty API AI (Openrouter)
  - Potencjalne nadużycia
- Zalecane: max 5-10 żądań/minutę/użytkownika dla generacji
- Implementacja: można użyć middleware lub zewnętrznego serwisu

### 6.4 Ochrona przed ujawnianiem informacji
- Cel nieistniejący lub należący do innego użytkownika: zawsze `404` (nie `403`)
- Błędy AI provider: nie ujawniać szczegółów technicznych, generyczny komunikat `502`

### 6.5 Bezpieczeństwo AI
- Prompt injection: dane użytkownika (nazwa celu, notatki) powinny być oddzielone od instrukcji systemowych
- Ograniczenie długości wejścia do AI

---

## 7. Obsługa błędów

### 7.1 POST `/api/goals/:goalId/ai-summary/generate`

| Status | Kod błędu | Warunek |
|--------|-----------|---------|
| `401` | `not_authenticated` | Brak/nieprawidłowy token |
| `400` | `invalid_path_params` | `goalId` nie jest UUID |
| `404` | `goal_not_found` | Cel nie istnieje lub nie należy do użytkownika |
| `409` | `invalid_goal_state` | Cel jest `active` lub `abandoned` |
| `412` | `not_enough_data` | Mniej niż 3 wpisy progress |
| `422` | `validation_error` | Nieprawidłowy format body (np. `force` nie jest boolean) |
| `429` | `rate_limited` | Przekroczono limit żądań |
| `500` | `internal_error` | Błąd bazy danych, nieoczekiwany wyjątek |
| `502` | `ai_provider_error` | Błąd Openrouter API (timeout, błąd API, nieprawidłowa odpowiedź) |

### 7.2 PATCH `/api/goals/:goalId/ai-summary`

| Status | Kod błędu | Warunek |
|--------|-----------|---------|
| `401` | `not_authenticated` | Brak/nieprawidłowy token |
| `400` | `invalid_path_params` | `goalId` nie jest UUID |
| `404` | `goal_not_found` | Cel nie istnieje lub nie należy do użytkownika |
| `422` | `validation_error` | Brak `ai_summary`, pusty string, przekroczono max długość |
| `500` | `internal_error` | Błąd bazy danych |

### 7.3 Rejestrowanie błędów
- `console.error` w route i service (zgodnie z wzorcem w projekcie)
- Logować: błędy DB, błędy AI provider (z context), nieoczekiwane wyjątki

---

## 8. Rozważania dotyczące wydajności

### 8.1 Baza danych
- Wykorzystywane indeksy:
  - `goals(id)` - PK dla pojedynczego pobierania
  - `goals(user_id)` - dla filtrowania po właścicielu
  - `goal_progress(goal_id)` - dla zliczania i pobierania wpisów
- Zapytania:
  - POST /generate: 1 SELECT goal + 1 COUNT progress + 1 SELECT progress (dla AI context) + 1 UPDATE
  - PATCH: 1 SELECT (check exists) + 1 UPDATE (lub merged into single query with RLS)

### 8.2 AI Provider
- **Latencja**: Generacja AI może trwać 2-10 sekund - endpoint jest synchroniczny
- **Timeout**: Ustawić rozsądny timeout dla wywołania AI (30s)
- **Retry**: Rozważyć 1 retry przy błędach przejściowych AI
- **Cache**: Jeśli `ai_summary` już istnieje i `force=false`, nie wywołujemy AI

### 8.3 Rate Limiting
- Implementacja per-user rate limiter dla endpointu generacji
- Przechowywanie: Redis lub in-memory (dla MVP)

### 8.4 Optymalizacje
- Lazy loading: nie pobierać wszystkich danych progress jeśli count < 3
- Streaming response: nie dotyczy (endpoint synchroniczny, krótka odpowiedź)

---

## 9. Etapy wdrożenia

### Faza 1: Przygotowanie serwisu AI

1. **Utworzenie klienta Openrouter**
   - Plik: `src/lib/services/openrouter.client.ts`
   - Konfiguracja:
     - API URL: `https://openrouter.ai/api/v1/chat/completions`
     - API Key: z `import.meta.env.OPENROUTER_API_KEY`
     - Model: wybór ekonomicznego modelu (np. `anthropic/claude-3-haiku`)
   - Funkcja: `generateChatCompletion(messages, options)` - wywołuje API

2. **Utworzenie serwisu AI Summary**
   - Plik: `src/lib/services/ai-summary.service.ts`
   - Funkcje:
     - `generateAiSummary(supabase, userId, goalId, command)` - główna logika
     - `updateAiSummary(supabase, userId, goalId, aiSummary)` - aktualizacja
   - Helper: `buildAiPrompt(goal, progressEntries)` - buduje prompt dla AI
   - Helper: `parseAiResponse(response)` - parsuje odpowiedź AI do DTO

### Faza 2: Implementacja endpointów

3. **Endpoint POST generate**
   - Plik: `src/pages/api/goals/[goalId]/ai-summary/generate.ts`
   - `export const prerender = false`
   - Zod schemas dla path i body
   - Obsługa wszystkich kodów błędów
   - Wywołanie serwisu i formatowanie odpowiedzi

4. **Endpoint PATCH ai-summary**
   - Plik: `src/pages/api/goals/[goalId]/ai-summary/index.ts`
   - `export const prerender = false`
   - Handler `PATCH` - walidacja i aktualizacja
   - Zod schemas dla path i body

### Faza 3: Walidacja i schemat Zod

5. **Schematy walidacji**
   - `goalIdSchema` - reużywalny z innych endpointów
   - `generateAiSummaryBodySchema` - `{ force?: boolean }`
   - `updateAiSummaryBodySchema` - `{ ai_summary: string }`

### Faza 4: Rate Limiting (opcjonalne dla MVP)

6. **Middleware rate limiting**
   - Prosty in-memory rate limiter dla `/ai-summary/generate`
   - Konfiguracja: max requests per minute per user

### Faza 5: Testowanie

7. **Scenariusze testowe dla POST /generate:**
   - Generacja dla celu `completed_success` z >= 3 wpisami - sukces
   - Generacja dla celu `completed_failure` z >= 3 wpisami - sukces
   - Generacja dla celu `active` - `409`
   - Generacja dla celu `abandoned` - `409`
   - Generacja z < 3 wpisami - `412`
   - Regeneracja z `force=false` gdy ai_summary istnieje - zwraca istniejące
   - Regeneracja z `force=true` - wywołuje AI ponownie
   - Nieprawidłowy goalId UUID - `400`
   - Nieistniejący goalId - `404`
   - Cudzy goalId - `404`
   - Brak tokenu - `401`
   - Błąd AI provider - `502`

8. **Scenariusze testowe dla PATCH:**
   - Aktualizacja ai_summary - sukces
   - Nieprawidłowy goalId UUID - `400`
   - Nieistniejący goalId - `404`
   - Pusty ai_summary - `422`
   - ai_summary > 5000 znaków - `422`
   - Brak tokenu - `401`

---

## 10. Struktura plików

```
src/
├── lib/
│   └── services/
│       ├── ai-summary.service.ts      # Logika biznesowa AI summary
│       └── openrouter.client.ts       # Klient API Openrouter
├── pages/
│   └── api/
│       └── goals/
│           └── [goalId]/
│               └── ai-summary/
│                   ├── index.ts       # PATCH handler
│                   └── generate.ts    # POST handler
```

---

## 11. Przykładowy prompt AI

```
You are an AI assistant that analyzes goal progress and provides constructive feedback.

## Goal Information
- Name: ${goal.name}
- Target: ${goal.target_value}
- Deadline: ${goal.deadline}
- Final Status: ${goal.status === 'completed_success' ? 'Successfully completed' : 'Not completed (deadline passed)'}
- Total Progress: ${totalProgress} / ${goal.target_value}

## Progress Entries
${progressEntries.map(e => `- ${e.created_at}: ${e.value}${e.notes ? ` (${e.notes})` : ''}`).join('\n')}

## Your Task
1. Provide a brief summary (2-3 paragraphs) of the user's journey toward this goal
2. Highlight what went well and areas for improvement
3. Suggest a next goal that builds on this experience

Respond in JSON format:
{
  "summary": "Your summary here...",
  "next_goal": {
    "name": "Suggested goal name",
    "target_value": "number as string",
    "deadline_hint_days": number
  }
}
```

---

## 12. Zmienne środowiskowe

Dodać do `.env`:
```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307
```

Dodać do `src/env.d.ts`:
```typescript
interface ImportMetaEnv {
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_MODEL?: string;
}
```
