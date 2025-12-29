# API Endpoint Implementation Plan: GET `/api/auth/me`

## 1. Przegląd punktu końcowego

Endpoint GET `/api/auth/me` służy do zwracania informacji o aktualnie zalogowanym użytkowniku. Jest to prosty endpoint typu "whoami", który pozwala klientom zweryfikować tożsamość użytkownika na podstawie dostarczonego tokenu JWT. Endpoint nie wymaga żadnych parametrów wejściowych poza tokenem autoryzacyjnym w nagłówku.

**Główne zadania:**
- Weryfikacja tokenu JWT z nagłówka Authorization
- Pobranie danych użytkownika z Supabase Auth
- Zwrócenie informacji o użytkowniku (id i email) w standardowej kopercie API

## 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/auth/me`
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <access_token>`
  - Content-Type: nie dotyczy (brak body)
- **Parametry**:
  - **Wymagane**: Brak
  - **Opcjonalne**: Brak
- **Request Body**: Brak (metoda GET)

### Uwierzytelnianie
Token JWT przekazywany jest w nagłówku `Authorization` w formacie:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 3. Wykorzystywane typy

### Response DTOs (zdefiniowane w `src/types.ts`)

```typescript
// Linia 90-92
export type MeResponseDto = ApiSuccessDto<{
  user: AuthUserDto;
}>;

// Linia 56-59
export interface AuthUserDto {
  id: string;
  email: string | null;
}

// Linia 16-18
export interface ApiSuccessDto<Data> {
  data: Data;
}

// Linia 12-14
export interface ApiErrorDto<Code extends string = string, Details = unknown> {
  error: ApiErrorBodyDto<Code, Details>;
}
```

### Command Models
**Brak** - endpoint nie przyjmuje danych wejściowych.

### Validation Schemas
**Brak** - endpoint nie wymaga walidacji Zod dla danych wejściowych (brak body/query params).

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)
```json
{
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com"
    }
  }
}
```

**Content-Type**: `application/json`

### Error Responses

#### 401 Unauthorized - Brak autoryzacji
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Authentication required"
  }
}
```

**Scenariusze:**
- Brak nagłówka Authorization
- Token w nieprawidłowym formacie (nie "Bearer <token>")
- Brak tokenu po słowie "Bearer"

#### 401 Unauthorized - Nieprawidłowy token
```json
{
  "error": {
    "code": "invalid_token",
    "message": "Invalid or expired authentication token"
  }
}
```

**Scenariusze:**
- Token JWT wygasł
- Token JWT jest nieprawidłowy (zmodyfikowany, uszkodzony)
- Walidacja tokenu przez Supabase zakończyła się niepowodzeniem

#### 500 Internal Server Error
```json
{
  "error": {
    "code": "internal_server_error",
    "message": "An unexpected error occurred"
  }
}
```

**Scenariusze:**
- Nieoczekiwane błędy podczas komunikacji z Supabase
- Awarie systemowe

## 5. Przepływ danych

```
┌─────────┐                  ┌──────────────┐                 ┌──────────────┐
│ Client  │                  │ GET /api/    │                 │  Supabase    │
│         │                  │  auth/me     │                 │  Auth        │
└────┬────┘                  └──────┬───────┘                 └──────┬───────┘
     │                              │                                │
     │  GET /api/auth/me            │                                │
     │  Authorization: Bearer token │                                │
     ├─────────────────────────────>│                                │
     │                              │                                │
     │                              │  1. Extract Authorization      │
     │                              │     header                     │
     │                              │                                │
     │                              │  2. Validate Bearer format     │
     │                              │                                │
     │                              │  auth.getUser(token)           │
     │                              ├───────────────────────────────>│
     │                              │                                │
     │                              │     3. Validate JWT            │
     │                              │     4. Return user data        │
     │                              │<───────────────────────────────┤
     │                              │  { user: { id, email } }       │
     │                              │                                │
     │                              │  5. Build success response     │
     │                              │                                │
     │  200 OK                      │                                │
     │  { data: { user: {...} } }   │                                │
     │<─────────────────────────────┤                                │
     │                              │                                │
```

### Interakcje z zewnętrznymi usługami:

1. **Supabase Auth** (via `context.locals.supabase`):
   - Metoda: `auth.getUser(jwt)`
   - Cel: Weryfikacja tokenu JWT i pobranie danych użytkownika
   - Zwracane dane: `{ data: { user }, error }`

2. **Baza danych**:
   - Brak bezpośrednich zapytań do bazy danych
   - Supabase Auth zarządza sesjami wewnętrznie

## 6. Względy bezpieczeństwa

### Uwierzytelnianie
- **Mechanizm**: Supabase JWT przekazywany w nagłówku `Authorization: Bearer <token>`
- **Walidacja tokenu**: Automatyczna przez `supabase.auth.getUser()`
- **Weryfikacja formatu**: Sprawdzenie, czy nagłówek zawiera "Bearer " prefix
- **Źródło tokenu**: Token generowany przez Supabase Auth podczas logowania (endpoint `/api/auth/login`)

### Autoryzacja
- **Brak RLS**: Endpoint nie wykonuje zapytań do tabel użytkowników w bazie danych
- **Tożsamość z tokenu**: Dane użytkownika wyciągane wyłącznie z zwalidowanego tokenu JWT
- **Brak user_id od klienta**: Całkowicie ignorowane - tożsamość pochodzi z tokenu

### Walidacja danych wejściowych
- **Brak walidacji Zod**: Endpoint nie przyjmuje parametrów wejściowych
- **Walidacja nagłówka**: Sprawdzenie obecności i formatu `Authorization` header
- **Format tokenu**: Weryfikacja, czy nagłówek ma format `Bearer <token>`

### Ochrona przed zagrożeniami

1. **Token Replay Attacks**:
   - Tokeny JWT mają ograniczony czas życia (zarządzane przez Supabase)
   - Klient powinien używać refresh token do odnowienia expired access token

2. **Token Leakage**:
   - Endpoint nie loguje ani nie zwraca tokenu w odpowiedzi
   - Tylko podstawowe dane użytkownika (id, email)

3. **XSS Protection**:
   - Brak możliwości injection - endpoint nie przyjmuje danych wejściowych
   - Zwracane dane to tylko UUID i email (bezpieczne typy)

4. **Rate Limiting**:
   - Rekomendowane: podstawowe rate limiting (np. 100 req/min per IP)
   - Zapobieganie token brute-force attacks

5. **CORS**:
   - Konfiguracja CORS na poziomie aplikacji Astro
   - Ograniczenie dozwolonych origins do znanych domen

### Compliance z regułami implementacji
- Używa `context.locals.supabase` zamiast bezpośredniego importu (zgodnie z `backend.instructions.md:9`)
- Używa typu `SupabaseClient` z `src/db/supabase.client.ts` (zgodnie z `backend.instructions.md:10`)
- Eksportuje `export const prerender = false` (zgodnie z `astro.instructions.md:10`)

## 7. Obsługa błędów

### Katalog błędów

| Kod błędu | Status HTTP | Kod odpowiedzi | Scenariusz |
|-----------|-------------|----------------|------------|
| Brak Authorization header | 401 | `unauthorized` | Nagłówek `Authorization` nie został przekazany |
| Nieprawidłowy format header | 401 | `unauthorized` | Header nie ma formatu `Bearer <token>` |
| Brak tokenu | 401 | `unauthorized` | Po słowie "Bearer" brak tokenu |
| Token wygasły | 401 | `invalid_token` | JWT token expired (zarządzane przez Supabase) |
| Token nieprawidłowy | 401 | `invalid_token` | JWT signature invalid lub token zmodyfikowany |
| User nie istnieje | 401 | `invalid_token` | User został usunięty, ale token nadal ważny |
| Błąd Supabase | 500 | `internal_server_error` | Komunikacja z Supabase Auth failed |
| Nieoczekiwany błąd | 500 | `internal_server_error` | Catch-all dla nieprzewidzianych błędów |

### Szczegółowa obsługa błędów

#### 1. Walidacja Authorization Header (401)

```typescript
const authHeader = context.request.headers.get("Authorization");

if (!authHeader) {
  return new Response(
    JSON.stringify({
      error: {
        code: "unauthorized",
        message: "Authentication required",
      },
    } satisfies ApiErrorDto<"unauthorized">),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

if (!authHeader.startsWith("Bearer ")) {
  return new Response(
    JSON.stringify({
      error: {
        code: "unauthorized",
        message: "Invalid authorization header format",
      },
    } satisfies ApiErrorDto<"unauthorized">),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

const token = authHeader.substring(7); // Remove "Bearer "

if (!token) {
  return new Response(
    JSON.stringify({
      error: {
        code: "unauthorized",
        message: "Authentication token is required",
      },
    } satisfies ApiErrorDto<"unauthorized">),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

#### 2. Walidacja tokenu przez Supabase (401)

```typescript
const { data, error } = await supabase.auth.getUser(token);

if (error || !data.user) {
  return new Response(
    JSON.stringify({
      error: {
        code: "invalid_token",
        message: "Invalid or expired authentication token",
      },
    } satisfies ApiErrorDto<"invalid_token">),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

#### 3. Nieoczekiwane błędy (500)

```typescript
try {
  // ... endpoint logic
} catch (error) {
  console.error("Unexpected error in GET /api/auth/me:", error);

  return new Response(
    JSON.stringify({
      error: {
        code: "internal_server_error",
        message: "An unexpected error occurred",
      },
    } satisfies ApiErrorDto<"internal_server_error">),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

### Logowanie błędów
- Użyj `console.error()` dla błędów 500 (zgodnie z wzorcem z login.ts:149)
- Błędy 401 nie są logowane (to oczekiwane błędy walidacji)
- Logowane informacje: timestamp, error message, stack trace (jeśli dostępny)

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

1. **Komunikacja z Supabase Auth**:
   - Każde żądanie wymaga wywołania `auth.getUser()` do Supabase
   - Latencja zależna od połączenia sieciowego z Supabase
   - **Mitygacja**: Supabase Auth jest szybki, ale można rozważyć caching session na krótki okres (np. 1-5 min)

2. **Walidacja JWT**:
   - Supabase musi zweryfikować podpis JWT
   - Operacja kryptograficzna (verify signature)
   - **Mitygacja**: JWT verification jest zazwyczaj bardzo szybka (~1-2ms)

3. **Rate limiting overhead**:
   - Jeśli zaimplementowane, rate limiting może dodać latencję
   - **Mitygacja**: Użyj in-memory store (np. Redis) dla liczników

### Strategie optymalizacji

1. **Brak niepotrzebnych zapytań do bazy danych**:
   - Endpoint nie wykonuje żadnych zapytań SQL
   - Dane pochodzą bezpośrednio z Supabase Auth (in-memory/cache)

2. **Minimalna logika biznesowa**:
   - Endpoint tylko weryfikuje token i zwraca dane
   - Brak skomplikowanych obliczeń lub transformacji

3. **Szybka odpowiedź**:
   - Zwracane dane są małe (tylko id i email)
   - JSON serialization jest szybka dla małych obiektów

4. **Potencjalne cachowanie** (opcjonalne dla przyszłości):
   - Można cache'ować wynik `getUser()` na 1-5 minut per token
   - Klucz cache: hash tokenu JWT
   - Invalidacja: po timeout lub logout

### Monitoring wydajności

Metryki do śledzenia:
- Średni czas odpowiedzi endpointa
- Liczba błędów 401 vs 200 (wskaźnik invalid tokens)
- Latencja wywołań do Supabase Auth
- Rate limit hits (jeśli zaimplementowane)

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie struktury pliku
**Plik**: `src/pages/api/auth/me.ts`

1.1. Utwórz plik `me.ts` w katalogu `src/pages/api/auth/`

1.2. Dodaj wymagane importy:
```typescript
import type { APIContext } from "astro";
import type { ApiErrorDto, MeResponseDto } from "../../../types";
```

1.3. Dodaj deklarację `export const prerender = false` (wymagane dla API routes w Astro)

### Krok 2: Implementacja funkcji GET handler

2.1. Stwórz funkcję `GET` eksportowaną jako named export:
```typescript
export async function GET(context: APIContext)
```

2.2. Dodaj try-catch wrapper dla obsługi nieoczekiwanych błędów

2.3. Dodaj komentarz dokumentacyjny z przykładami testów (zgodnie z wzorcem z login.ts)

### Krok 3: Walidacja Authorization header

3.1. Wyciągnij nagłówek `Authorization`:
```typescript
const authHeader = context.request.headers.get("Authorization");
```

3.2. Sprawdź obecność nagłówka:
- Jeśli brak → zwróć 401 z kodem `unauthorized`

3.3. Sprawdź format "Bearer <token>":
- Jeśli nieprawidłowy format → zwróć 401 z kodem `unauthorized`

3.4. Wyciągnij token:
```typescript
const token = authHeader.substring(7); // Usuń "Bearer "
```

3.5. Sprawdź, czy token nie jest pusty:
- Jeśli pusty → zwróć 401 z kodem `unauthorized`

### Krok 4: Weryfikacja tokenu przez Supabase Auth

4.1. Pobierz klienta Supabase z context:
```typescript
const supabase = context.locals.supabase;
```

4.2. Wywołaj `auth.getUser()` z tokenem:
```typescript
const { data, error } = await supabase.auth.getUser(token);
```

4.3. Obsłuż błędy walidacji:
- Jeśli `error` lub brak `data.user` → zwróć 401 z kodem `invalid_token`

### Krok 5: Zwrócenie sukcesu

5.1. Zbuduj obiekt odpowiedzi zgodny z `MeResponseDto`:
```typescript
const response: MeResponseDto = {
  data: {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  },
};
```

5.2. Zwróć Response z kodem 200:
```typescript
return new Response(JSON.stringify(response), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});
```

### Krok 6: Implementacja obsługi błędów w catch block

6.1. W catch block:
- Zaloguj błąd: `console.error("Unexpected error in GET /api/auth/me:", error)`
- Zwróć 500 z kodem `internal_server_error`

### Krok 7: Dodanie komentarzy i dokumentacji

7.1. Dodaj JSDoc komentarz na początku pliku opisujący endpoint

7.2. Dodaj komentarze do sekcji funkcji GET zgodnie z wzorcem:
```typescript
/**
 * GET /api/auth/me - Return current authenticated user identity
 *
 * Test scenarios:
 * 1. Success (200):
 *    GET /api/auth/me
 *    Headers: Authorization: Bearer <valid_token>
 *
 * 2. No authorization header (401):
 *    GET /api/auth/me
 *    (no Authorization header)
 *
 * 3. Invalid token format (401):
 *    Headers: Authorization: InvalidFormat
 *
 * 4. Expired/invalid token (401):
 *    Headers: Authorization: Bearer <expired_or_invalid_token>
 */
```

7.3. Dodaj inline komentarze do kluczowych kroków (Step 1, Step 2, etc.)

### Krok 8: Testowanie

8.1. **Test 1 - Success (200)**:
- Zaloguj się przez `/api/auth/login`
- Użyj otrzymanego `access_token`
- Wywołaj `GET /api/auth/me` z nagłówkiem `Authorization: Bearer <token>`
- Sprawdź odpowiedź 200 z poprawnymi danymi użytkownika

8.2. **Test 2 - Brak authorization header (401)**:
- Wywołaj `GET /api/auth/me` bez nagłówka `Authorization`
- Sprawdź odpowiedź 401 z kodem `unauthorized`

8.3. **Test 3 - Nieprawidłowy format header (401)**:
- Wywołaj z nagłówkiem `Authorization: InvalidFormat`
- Sprawdź odpowiedź 401 z kodem `unauthorized`

8.4. **Test 4 - Pusty token (401)**:
- Wywołaj z nagłówkiem `Authorization: Bearer `
- Sprawdź odpowiedź 401 z kodem `unauthorized`

8.5. **Test 5 - Nieprawidłowy/wygasły token (401)**:
- Wywołaj z nagłówkiem `Authorization: Bearer invalid_token_xyz`
- Sprawdź odpowiedź 401 z kodem `invalid_token`

8.6. **Test 6 - User email null**:
- Utwórz użytkownika bez emaila (jeśli możliwe w Supabase)
- Sprawdź, czy endpoint zwraca `email: null` poprawnie

### Krok 9: Code Review i finalizacja

9.1. Sprawdź zgodność z guidelines:
- ✓ Używa `context.locals.supabase`
- ✓ Ma `export const prerender = false`
- ✓ Używa typów z `src/types.ts`
- ✓ Zgodność z wzorcem z innych auth endpoints (login.ts, register.ts)

9.2. Sprawdź obsługę błędów:
- ✓ Wszystkie scenariusze błędów pokryte
- ✓ Poprawne kody statusu HTTP
- ✓ Użycie `satisfies ApiErrorDto<...>` dla type safety

9.3. Sprawdź bezpieczeństwo:
- ✓ Brak logowania tokenów
- ✓ Brak zwracania wrażliwych danych
- ✓ Walidacja wszystkich inputów (header)

9.4. Performance check:
- ✓ Minimalna liczba wywołań zewnętrznych (tylko 1x `getUser()`)
- ✓ Brak niepotrzebnych zapytań do bazy danych
- ✓ Szybka walidacja i szybka odpowiedź

### Krok 10: Dokumentacja i deployment

10.1. Zaktualizuj dokumentację API (jeśli istnieje osobny plik)

10.2. Dodaj endpoint do listy dostępnych endpoints w README (jeśli dotyczy)

10.3. Deployment:
- Commit zmian do repozytorium
- Push do branch `angry-kilby`
- Uruchom testy w środowisku dev/staging
- Weryfikuj działanie przed merge do master

---

## Podsumowanie

Endpoint GET `/api/auth/me` to prosty, ale krytyczny punkt końcowy służący do weryfikacji tożsamości użytkownika. Główne cechy implementacji:

✅ **Prostota**: Brak skomplikowanej logiki biznesowej
✅ **Bezpieczeństwo**: Walidacja tokenu przez Supabase Auth
✅ **Wydajność**: Minimalna latencja, brak zapytań do bazy danych
✅ **Zgodność**: Pełna zgodność z API plan i wzorcami projektu
✅ **Testowalność**: Jasne scenariusze testowe

**Oczekiwany czas implementacji**: 30-60 minut (w zależności od doświadczenia)

**Krytyczne punkty uwagi**:
1. Poprawna walidacja formatu Bearer token
2. Obsługa wszystkich scenariuszy błędów 401
3. Użycie `context.locals.supabase` zamiast importu
4. Type safety z użyciem `satisfies`
