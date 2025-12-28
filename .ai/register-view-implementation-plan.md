# Plan implementacji widoku Rejestracja

## 1. Przegląd

Widok rejestracji umożliwia nowym użytkownikom utworzenie konta w aplikacji GoalTracker. Formularz zawiera pola na adres e-mail, hasło oraz potwierdzenie hasła. Po pomyślnej rejestracji użytkownik jest automatycznie zalogowany i przekierowany do głównego widoku aplikacji (`/app/goals`). Widok zapewnia walidację formatu e-maila, minimalnej długości hasła (8 znaków) oraz zgodności haseł, a także wyświetla odpowiednie komunikaty błędów w przypadku niepowodzenia (np. gdy e-mail jest już zajęty).

## 2. Routing widoku

- **Ścieżka**: `/register`
- **Plik strony Astro**: `src/pages/register.astro`
- **Komponent React**: `src/components/auth/RegisterForm.tsx`
- **Typ widoku**: publiczny (dostępny dla niezalogowanych użytkowników)

## 3. Struktura komponentów

```
register.astro
└── Layout
    └── RegisterPage (React, client:load)
        ├── RegisterForm
        │   ├── Label + Input (email)
        │   ├── Label + Input (password) + PasswordRequirements
        │   ├── Label + Input (confirmPassword)
        │   ├── FormError (aria-live)
        │   └── Button (submit)
        └── Link do /login
```

## 4. Szczegóły komponentów

### 4.1 RegisterPage

- **Opis**: Główny komponent strony rejestracji. Opakowuje formularz rejestracji i zawiera link do strony logowania. Odpowiada za wyświetlenie tytułu i ogólnego layoutu strony rejestracji.
- **Główne elementy**:
  - `<main>` z klasami centrującymi zawartość
  - Nagłówek z tytułem "Załóż konto"
  - Komponent `RegisterForm`
  - Link do strony logowania ("Masz już konto? Zaloguj się")
- **Obsługiwane interakcje**: brak bezpośrednich (deleguje do `RegisterForm`)
- **Obsługiwana walidacja**: brak (deleguje do `RegisterForm`)
- **Typy**: brak
- **Propsy**: brak

### 4.2 RegisterForm

- **Opis**: Formularz rejestracji zawierający pola email, hasło i potwierdzenie hasła. Obsługuje walidację po stronie klienta, wysyłanie żądania do API oraz obsługę błędów. Po pomyślnej rejestracji przekierowuje użytkownika do `/app/goals`.
- **Główne elementy**:
  - `<form>` z atrybutem `noValidate`
  - Pole email: `Label` + `Input` (type="email")
  - Pole hasła: `Label` + `Input` (type="password") + komunikat o wymaganiach
  - Pole potwierdzenia hasła: `Label` + `Input` (type="password")
  - Sekcja błędów formularza z `aria-live="polite"`
  - `Button` typu submit
- **Obsługiwane interakcje**:
  - `onChange` na polach input - aktualizacja stanu formularza i czyszczenie błędów pola
  - `onSubmit` formularza - walidacja, wywołanie API, obsługa sukcesu/błędu
- **Obsługiwana walidacja**:
  - Email: wymagany, poprawny format (regex)
  - Hasło: wymagane, minimum 8 znaków
  - Potwierdzenie hasła: wymagane, musi być zgodne z hasłem
- **Typy**:
  - `RegisterFormVm` - stan formularza
  - `RegisterFormErrors` - błędy walidacji
  - `RegisterCommand` - komenda wysyłana do API
  - `RegisterResponseDto` - odpowiedź z API
- **Propsy**: brak (komponent samodzielny)

## 5. Typy

### 5.1 Istniejące typy (z `src/types.ts`)

```typescript
// Komenda rejestracji - wysyłana do API
export interface RegisterCommand {
  email: string;
  password: string;
}

// Odpowiedź z API po rejestracji
export type RegisterResponseDto = ApiSuccessDto<{
  user: AuthUserDto;
}>;

// Dane użytkownika
export interface AuthUserDto {
  id: string;
  email: string | null;
}

// Struktura sukcesu API
export interface ApiSuccessDto<Data> {
  data: Data;
}

// Struktura błędu API
export interface ApiErrorBodyDto<Code extends string = string, Details = unknown> {
  code: Code;
  message: string;
  details?: Details;
}
```

### 5.2 Nowe typy (w komponencie `RegisterForm.tsx`)

```typescript
// ViewModel stanu formularza
export interface RegisterFormVm {
  email: string;
  password: string;
  confirmPassword: string;
}

// Błędy walidacji formularza
export interface RegisterFormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string; // błąd ogólny (np. z API)
}
```

## 6. Zarządzanie stanem

Stan formularza zarządzany jest lokalnie w komponencie `RegisterForm` przy użyciu hooka `useState`. Nie jest wymagany customowy hook ani globalny stan.

### Zmienne stanu:

```typescript
const [values, setValues] = useState<RegisterFormVm>({
  email: "",
  password: "",
  confirmPassword: "",
});
const [errors, setErrors] = useState<RegisterFormErrors>({});
const [isSubmitting, setIsSubmitting] = useState(false);
```

### Logika stanu:

1. **Aktualizacja pól**: każde pole aktualizuje odpowiednią wartość w `values` i czyści powiązany błąd w `errors`
2. **Walidacja**: wykonywana przy submit, przed wysłaniem żądania do API
3. **Submitting**: flaga `isSubmitting` blokuje wielokrotne wysłanie formularza
4. **Błędy**: przechowywane w `errors`, wyświetlane przy polach i/lub jako ogólny komunikat

## 7. Integracja API

### Endpoint

- **URL**: `POST /api/auth/register`
- **Content-Type**: `application/json`

### Żądanie

```typescript
interface RegisterCommand {
  email: string;
  password: string;
}
```

### Odpowiedź sukcesu (201)

```typescript
type RegisterResponseDto = ApiSuccessDto<{
  user: AuthUserDto;
}>;

// Przykład:
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

### Błędy

| Status | Kod błędu | Opis | Obsługa w UI |
|--------|-----------|------|--------------|
| 400 | `INVALID_PAYLOAD` | Nieprawidłowe dane wejściowe | Wyświetl komunikat ogólny |
| 409 | `EMAIL_IN_USE` | Email jest już zajęty | Wyświetl błąd przy polu email |
| 429 | `RATE_LIMITED` | Zbyt wiele prób | Wyświetl komunikat ogólny |

### Implementacja wywołania

```typescript
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { RegisterCommand, RegisterResponseDto } from "@/types";

async function register(command: RegisterCommand): Promise<RegisterResponseDto> {
  return apiFetchJson<RegisterResponseDto>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(command),
  });
}
```

## 8. Interakcje użytkownika

| Interakcja | Element | Akcja | Rezultat |
|------------|---------|-------|----------|
| Wpisanie tekstu | Input email | `onChange` | Aktualizacja `values.email`, usunięcie błędu email |
| Wpisanie tekstu | Input password | `onChange` | Aktualizacja `values.password`, usunięcie błędu password |
| Wpisanie tekstu | Input confirmPassword | `onChange` | Aktualizacja `values.confirmPassword`, usunięcie błędu confirmPassword |
| Kliknięcie | Button "Załóż konto" | `onSubmit` | Walidacja → API call → redirect lub błąd |
| Kliknięcie | Link "Zaloguj się" | Nawigacja | Przekierowanie do `/login` |

### Przepływ submit:

1. Użytkownik klika przycisk "Załóż konto"
2. Walidacja wszystkich pól
3. Jeśli błędy walidacji → wyświetl błędy, zatrzymaj
4. Ustaw `isSubmitting = true`
5. Wyślij `POST /api/auth/register`
6. Sukces → przekieruj do `/app/goals` (Supabase automatycznie ustawi sesję)
7. Błąd → wyświetl odpowiedni komunikat, ustaw `isSubmitting = false`

## 9. Warunki i walidacja

### Walidacja po stronie klienta

| Pole | Warunek | Komunikat błędu |
|------|---------|-----------------|
| email | Wymagane | "Adres e-mail jest wymagany." |
| email | Format email (regex) | "Podaj prawidłowy adres e-mail." |
| password | Wymagane | "Hasło jest wymagane." |
| password | Min. 8 znaków | "Hasło musi mieć co najmniej 8 znaków." |
| confirmPassword | Wymagane | "Potwierdzenie hasła jest wymagane." |
| confirmPassword | Zgodność z hasłem | "Hasła muszą być identyczne." |

### Funkcje walidacji (do utworzenia w `src/lib/auth/validation.ts`)

```typescript
export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Adres e-mail jest wymagany.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return "Podaj prawidłowy adres e-mail.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Hasło jest wymagane.";
  if (value.length < 8) return "Hasło musi mieć co najmniej 8 znaków.";
  return null;
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return "Potwierdzenie hasła jest wymagane.";
  if (password !== confirmPassword) return "Hasła muszą być identyczne.";
  return null;
}
```

### Wpływ walidacji na UI

- Błędy wyświetlane pod odpowiednimi polami z klasą `text-[#C17A6F]`
- Pola z błędami mają `aria-invalid="true"` i `aria-describedby` wskazujące na komunikat błędu
- Przycisk submit jest wyłączony podczas `isSubmitting`
- Błąd ogólny (z API) wyświetlany w sekcji z `aria-live="polite"`

## 10. Obsługa błędów

### Błędy walidacji (klient)

- Wyświetlane bezpośrednio pod polami formularza
- Tekst w kolorze `#C17A6F` (destructive)
- Pole ma `aria-invalid="true"`

### Błędy API

| Status | Obsługa |
|--------|---------|
| 400 | Wyświetl komunikat: "Nieprawidłowe dane. Sprawdź formularz i spróbuj ponownie." |
| 409 | Wyświetl błąd przy polu email: "Ten adres e-mail jest już używany." |
| 429 | Wyświetl komunikat: "Zbyt wiele prób. Spróbuj ponownie za chwilę." |
| 5xx | Wyświetl komunikat: "Wystąpił błąd serwera. Spróbuj ponownie później." |
| Sieć | Wyświetl komunikat: "Nie udało się połączyć z serwerem. Sprawdź połączenie internetowe." |

### Implementacja obsługi błędów

```typescript
try {
  await register(command);
  window.location.href = "/app/goals";
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      setErrors((prev) => ({ ...prev, email: "Ten adres e-mail jest już używany." }));
    } else if (error.status === 429) {
      setErrors((prev) => ({ ...prev, form: "Zbyt wiele prób. Spróbuj ponownie za chwilę." }));
    } else if (error.status >= 500) {
      setErrors((prev) => ({ ...prev, form: "Wystąpił błąd serwera. Spróbuj ponownie później." }));
    } else {
      setErrors((prev) => ({ ...prev, form: error.message || "Nieprawidłowe dane." }));
    }
  } else {
    setErrors((prev) => ({ ...prev, form: "Nie udało się połączyć z serwerem." }));
  }
}
```

## 11. Kroki implementacji

### Krok 1: Utworzenie funkcji walidacji

Utwórz plik `src/lib/auth/validation.ts` z funkcjami:
- `validateEmail(value: string): string | null`
- `validatePassword(value: string): string | null`
- `validateConfirmPassword(password: string, confirmPassword: string): string | null`

### Krok 2: Utworzenie komponentu RegisterForm

Utwórz plik `src/components/auth/RegisterForm.tsx`:
1. Zdefiniuj interfejsy `RegisterFormVm` i `RegisterFormErrors`
2. Zaimplementuj komponent z useState dla values, errors, isSubmitting
3. Zaimplementuj handleChange dla aktualizacji pól
4. Zaimplementuj funkcję validate wywołującą funkcje walidacji
5. Zaimplementuj handleSubmit z walidacją, wywołaniem API i obsługą błędów
6. Zrenderuj formularz z polami email, password, confirmPassword
7. Dodaj wyświetlanie błędów walidacji pod polami
8. Dodaj sekcję błędu ogólnego z aria-live
9. Dodaj przycisk submit z obsługą stanu loading

### Krok 3: Utworzenie komponentu RegisterPage

Utwórz plik `src/components/auth/RegisterPage.tsx`:
1. Zaimportuj RegisterForm
2. Zrenderuj layout strony z tytułem
3. Osadź RegisterForm
4. Dodaj link do strony logowania

### Krok 4: Utworzenie strony Astro

Utwórz plik `src/pages/register.astro`:
1. Zaimportuj Layout i RegisterPage
2. Ustaw title strony na "Rejestracja | GoalTracker"
3. Osadź RegisterPage z dyrektywą `client:load`

### Krok 5: Implementacja endpointu API (jeśli nie istnieje)

Utwórz plik `src/pages/api/auth/register.ts`:
1. Obsłuż metodę POST
2. Waliduj dane wejściowe za pomocą Zod
3. Wywołaj Supabase Auth signUp
4. Zwróć odpowiedź zgodną z `RegisterResponseDto`
5. Obsłuż błędy (409 dla istniejącego email, 400 dla nieprawidłowych danych)

### Krok 6: Testowanie

1. Przetestuj walidację po stronie klienta dla wszystkich pól
2. Przetestuj pomyślną rejestrację i przekierowanie
3. Przetestuj błąd 409 (email zajęty)
4. Przetestuj dostępność (aria-invalid, aria-describedby, aria-live)
5. Przetestuj responsywność na różnych rozmiarach ekranu

### Krok 7: Styling i UX

1. Użyj istniejących komponentów UI (Button, Input, Label)
2. Zachowaj spójność z istniejącymi formularzami (GoalCreateForm)
3. Dodaj komunikat o wymaganiach hasła pod polem hasła
4. Upewnij się, że focus states są widoczne
5. Przetestuj na urządzeniach mobilnych
