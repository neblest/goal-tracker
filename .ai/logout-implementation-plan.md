# API Endpoint Implementation Plan: POST /api/auth/logout

## 1. Przegląd punktu końcowego

Endpoint `POST /api/auth/logout` służy do wylogowania użytkownika poprzez invalidację bieżącej sesji Supabase. Po pomyślnym wywołaniu klient powinien usunąć przechowywane tokeny (access_token i refresh_token). Jest to część fasady API dla Supabase Auth, umożliwiającej centralizację całego ruchu autentykacyjnego przez Astro API.

## 2. Szczegóły żądania

- **Metoda HTTP**: POST
- **Struktura URL**: `/api/auth/logout`
- **Parametry**:
  - Wymagane: Brak
  - Opcjonalne: Brak
- **Request Body**: Brak (endpoint nie przyjmuje żadnych danych)
- **Wymagane nagłówki**:
  - `Authorization: Bearer <access_token>` - token JWT z Supabase Auth

## 3. Wykorzystywane typy

### DTO (Data Transfer Objects)
```typescript
// Już zdefiniowane w src/types.ts
export type NoContentResponseDto = undefined;
export type LogoutResponseDto = NoContentResponseDto;

// Dla obsługi błędów
export interface ApiErrorDto<Code extends string = string, Details = unknown> {
  error: {
    code: Code;
    message: string;
    details?: Details;
  };
}
```

### Command Modele
Brak - endpoint nie przyjmuje danych wejściowych.

## 4. Szczegóły odpowiedzi

### Sukces (204 No Content)
- Kod statusu: `204`
- Ciało odpowiedzi: Brak

### Błędy

| Kod | Kod błędu | Opis |
|-----|-----------|------|
| 401 | `not_authenticated` | Użytkownik nie jest uwierzytelniony |
| 500 | `internal_server_error` | Nieoczekiwany błąd serwera |

Przykład odpowiedzi błędu (401):
```json
{
  "error": {
    "code": "not_authenticated",
    "message": "Authentication required"
  }
}
```

## 5. Przepływ danych

```
┌─────────────────────────────────────────────────────────────────┐
│                         Klient                                   │
│  1. Wysyła POST /api/auth/logout                                 │
│     Header: Authorization: Bearer <access_token>                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Astro API Endpoint                            │
│  2. Pobiera klienta Supabase z context.locals                    │
│  3. Sprawdza aktualną sesję użytkownika                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Supabase Auth                              │
│  4. supabase.auth.getUser() - weryfikacja tokenu                 │
│  5. supabase.auth.signOut() - invalidacja sesji                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Klient                                   │
│  6. Otrzymuje odpowiedź 204 No Content                           │
│  7. Usuwa przechowywane tokeny                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Szczegółowy przepływ:

1. **Odbiór żądania**: Endpoint odbiera żądanie POST bez body
2. **Weryfikacja sesji**: Sprawdzenie czy użytkownik jest zalogowany poprzez `supabase.auth.getUser()`
3. **Walidacja uwierzytelnienia**: Jeśli brak ważnej sesji, zwróć 401
4. **Wylogowanie**: Wywołanie `supabase.auth.signOut()` w celu invalidacji sesji
5. **Odpowiedź**: Zwróć 204 No Content (sukces) lub odpowiedni kod błędu

## 6. Względy bezpieczeństwa

### Uwierzytelnienie
- Token JWT musi być przekazany w nagłówku `Authorization: Bearer <token>`
- Weryfikacja tokenu przez Supabase Auth przed wykonaniem operacji wylogowania
- Endpoint musi sprawdzić istnienie aktywnej sesji przed próbą wylogowania

### Autoryzacja
- Użytkownik może wylogować tylko swoją własną sesję
- Brak możliwości wylogowania innych użytkowników

### Ochrona przed atakami
- **CSRF**: Metoda POST z wymaganym tokenem Authorization zapobiega atakom CSRF
- **Token replay**: Supabase Auth zarządza invalidacją tokenów
- **Rate limiting**: Rozważyć implementację rate limitingu dla endpointów auth (zgodnie z api-plan.md)

### Obsługa wygasłych tokenów
- Wygasłe tokeny powinny skutkować odpowiedzią 401
- Klient powinien obsłużyć tę sytuację i oczyścić lokalne dane sesji

## 7. Obsługa błędów

| Scenariusz | Kod HTTP | Kod błędu | Wiadomość |
|------------|----------|-----------|-----------|
| Brak tokenu Authorization | 401 | `not_authenticated` | Authentication required |
| Nieprawidłowy token JWT | 401 | `not_authenticated` | Authentication required |
| Wygasły token | 401 | `not_authenticated` | Authentication required |
| Błąd Supabase Auth | 500 | `internal_server_error` | An unexpected error occurred |
| Nieoczekiwany błąd | 500 | `internal_server_error` | An unexpected error occurred |

### Logowanie błędów
- Błędy 500 powinny być logowane do konsoli z pełnym stack trace
- Błędy 401 nie wymagają logowania (normalne zachowanie dla nieuwierzytelnionych żądań)

## 8. Rozważania dotyczące wydajności

### Optymalizacje
- Endpoint jest lekki - wykonuje tylko jedno wywołanie do Supabase Auth
- Brak operacji na bazie danych poza Supabase Auth
- Brak walidacji danych wejściowych (body jest puste)

### Potencjalne wąskie gardła
- Opóźnienia sieciowe do Supabase Auth
- Rate limiting Supabase Auth może ograniczać liczbę żądań

### Rekomendacje
- Rozważyć implementację rate limitingu po stronie API dla ochrony przed nadużyciami
- Monitorować czasy odpowiedzi Supabase Auth

## 9. Etapy wdrożenia

### Krok 1: Utworzenie pliku endpointa
Utwórz plik `src/pages/api/auth/logout.ts` z podstawową strukturą:

```typescript
import type { APIContext } from "astro";
import type { ApiErrorDto } from "../../../types";

export const prerender = false;
```

### Krok 2: Implementacja funkcji POST
Zaimplementuj handler POST z następującą logiką:

```typescript
export async function POST(context: APIContext) {
  try {
    const supabase = context.locals.supabase;

    // Krok 2a: Weryfikacja uwierzytelnienia
    // Krok 2b: Wylogowanie
    // Krok 2c: Zwrócenie odpowiedzi 204
  } catch (error) {
    // Obsługa nieoczekiwanych błędów
  }
}
```

### Krok 3: Weryfikacja uwierzytelnienia
Sprawdź czy użytkownik jest zalogowany przed próbą wylogowania:

```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser();

if (userError || !user) {
  return new Response(
    JSON.stringify({
      error: {
        code: "not_authenticated",
        message: "Authentication required",
      },
    } satisfies ApiErrorDto<"not_authenticated">),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

### Krok 4: Wywołanie signOut
Wykonaj wylogowanie przez Supabase Auth:

```typescript
const { error: signOutError } = await supabase.auth.signOut();

if (signOutError) {
  console.error("Error during sign out:", signOutError);
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

### Krok 5: Zwrócenie odpowiedzi 204
Po pomyślnym wylogowaniu zwróć odpowiedź bez body:

```typescript
return new Response(null, { status: 204 });
```

### Krok 6: Obsługa nieoczekiwanych błędów
Dodaj blok catch dla nieoczekiwanych wyjątków:

```typescript
catch (error) {
  console.error("Unexpected error in POST /api/auth/logout:", error);

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

### Krok 7: Testowanie
Przetestuj endpoint w następujących scenariuszach:

1. **Sukces (204)**: Wylogowanie zalogowanego użytkownika
2. **Brak tokenu (401)**: Żądanie bez nagłówka Authorization
3. **Nieprawidłowy token (401)**: Żądanie z nieprawidłowym tokenem JWT
4. **Wygasły token (401)**: Żądanie z wygasłym tokenem JWT

### Krok 8: Dokumentacja
Upewnij się, że endpoint jest udokumentowany zgodnie z istniejącymi wzorcami w komentarzach JSDoc:

```typescript
/**
 * POST /api/auth/logout - Logout the current user
 *
 * Test scenarios:
 * 1. Success (204):
 *    POST /api/auth/logout
 *    Header: Authorization: Bearer <valid_token>
 *
 * 2. Not authenticated (401):
 *    POST /api/auth/logout
 *    (no Authorization header)
 */
```
