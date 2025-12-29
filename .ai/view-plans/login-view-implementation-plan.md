# Plan implementacji widoku Logowanie

## 1. Przegląd
Widok logowania (`/login`) umożliwia zarejestrowanym użytkownikom zalogowanie się do aplikacji GoalTracker przy użyciu adresu e-mail i hasła. Po pomyślnym zalogowaniu użytkownik zostaje przekierowany do widoku listy celów (`/app/goals`). Widok zawiera formularz z polami na email i hasło, walidację po stronie klienta, obsługę błędów uwierzytelnienia oraz link do rejestracji dla nowych użytkowników.

## 2. Routing widoku
- **Ścieżka**: `/login`
- **Plik strony**: `src/pages/login.astro`
- **Przekierowanie po sukcesie**: `/app/goals`
- **Link do rejestracji**: `/register`

## 3. Struktura komponentów

```
src/pages/login.astro
└── Layout (src/layouts/Layout.astro)
    └── <main>
        └── LoginPage (React island, client:load)
            ├── LoginHeader
            └── LoginForm
                ├── EmailField (Input + Label)
                ├── PasswordField (Input + Label)
                ├── FormErrorBanner
                ├── SubmitButton (Button)
                └── RegisterLink
```

## 4. Szczegóły komponentów

### `src/pages/login.astro`
- **Opis**: Strona Astro odpowiedzialna za routing `/login`. Osadza layout i montuje komponent React jako island.
- **Główne elementy**:
  - `Layout` z tytułem "Logowanie"
  - `<main aria-label="Logowanie">` jako semantyczny landmark
  - `LoginPage` jako React island z dyrektywą `client:load`
- **Obsługiwane interakcje**: brak (statyczny host)
- **Obsługiwana walidacja**: brak
- **Typy**: brak
- **Propsy**: brak

### `LoginPage`
- **Opis**: Główny kontener React dla widoku logowania. Odpowiada za layout strony, zawiera nagłówek i formularz logowania.
- **Główne elementy**:
  - `<div>` kontener z centrowaniem (flexbox/grid)
  - `LoginHeader` - nagłówek z tytułem i opcjonalnym logo
  - `LoginForm` - formularz logowania
- **Obsługiwane interakcje**: brak (delegowane do LoginForm)
- **Obsługiwana walidacja**: brak
- **Typy**: brak
- **Propsy**: brak

### `LoginHeader`
- **Opis**: Nagłówek sekcji logowania z tytułem i krótkim opisem.
- **Główne elementy**:
  - `<header>` semantyczny element
  - `<h1>` z tekstem "Zaloguj się"
  - `<p>` z krótkim opisem np. "Wprowadź swoje dane, aby uzyskać dostęp do celów"
- **Obsługiwane interakcje**: brak
- **Obsługiwana walidacja**: brak
- **Typy**: brak
- **Propsy**: brak

### `LoginForm`
- **Opis**: Formularz logowania z polami email i hasło, walidacją, obsługą błędów i przyciskiem submit. Zawiera również link do rejestracji.
- **Główne elementy**:
  - `<form noValidate>` z atrybutem noValidate dla własnej walidacji
  - Pole email: `Label` + `Input` (type="email")
  - Pole hasło: `Label` + `Input` (type="password")
  - `FormErrorBanner` - banner błędów formularza (aria-live)
  - `Button` (type="submit") - przycisk logowania
  - Link do rejestracji (`<a href="/register">`)
- **Obsługiwane interakcje**:
  - `onChange` dla pól email i hasło - aktualizacja stanu formularza
  - `onSubmit` - walidacja i wysłanie żądania logowania
  - `onBlur` (opcjonalnie) - walidacja pojedynczego pola
- **Obsługiwana walidacja**:
  - Email: wymagane pole, format email (regex)
  - Hasło: wymagane pole
  - Walidacja wykonywana przy submit, błędy czyszczone przy zmianie pola
- **Typy**:
  - `LoginFormVm` - model formularza
  - `LoginFormErrors` - błędy walidacji
  - `LoginCommand` (z types.ts) - komenda API
  - `LoginResponseDto` (z types.ts) - odpowiedź API
- **Propsy**: brak (komponent samodzielny)

## 5. Typy

### Istniejące typy (z `src/types.ts`)

```typescript
interface LoginCommand {
  email: string;
  password: string;
}

type LoginResponseDto = ApiSuccessDto<{
  access_token: string;
  refresh_token: string;
  user: AuthUserDto;
}>;

interface AuthUserDto {
  id: string;
  email: string | null;
}
```

### Nowe typy ViewModel (do utworzenia w komponencie lub osobnym pliku)

```typescript
/**
 * Model stanu formularza logowania
 */
interface LoginFormVm {
  email: string;
  password: string;
}

/**
 * Błędy walidacji formularza logowania
 */
interface LoginFormErrors {
  email?: string;
  password?: string;
  form?: string;  // błąd ogólny formularza (np. błędne dane uwierzytelniające)
}

/**
 * Stan formularza logowania dla hooka useLoginForm
 */
interface LoginFormState {
  values: LoginFormVm;
  errors: LoginFormErrors;
  isSubmitting: boolean;
}
```

## 6. Zarządzanie stanem

### Stan formularza
Stan formularza zarządzany lokalnie w komponencie `LoginForm` za pomocą `useState`:

- `values: LoginFormVm` - wartości pól formularza (email, password)
- `errors: LoginFormErrors` - błędy walidacji (email, password, form)
- `isSubmitting: boolean` - flaga wskazująca trwające wysyłanie

### Opcjonalny custom hook: `useLoginForm`
Lokalizacja: `src/components/hooks/useLoginForm.ts`

Hook może enkapsulować logikę formularza dla lepszej separacji, ale dla prostego formularza logowania logika może pozostać w komponencie.

```typescript
interface UseLoginFormReturn {
  values: LoginFormVm;
  errors: LoginFormErrors;
  isSubmitting: boolean;
  handleChange: (field: keyof LoginFormVm, value: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}
```

### Przepływ stanu
1. Użytkownik wypełnia pola formularza → aktualizacja `values`
2. Przy zmianie pola → czyszczenie błędu dla tego pola
3. Przy submit → walidacja wszystkich pól
4. Jeśli są błędy → ustawienie `errors`, zatrzymanie submit
5. Jeśli brak błędów → ustawienie `isSubmitting=true`, wywołanie API
6. Po odpowiedzi API:
   - Sukces → przekierowanie do `/app/goals`
   - Błąd 401 → ustawienie `errors.form` z komunikatem "Niepoprawny email lub hasło"
   - Inne błędy → odpowiedni komunikat w `errors.form`

## 7. Integracja API

### Endpoint logowania

**POST `/api/auth/login`**

- **Request**:
  ```typescript
  // Body (JSON)
  {
    "email": "user@example.com",
    "password": "..."
  }
  ```

- **Response (200 OK)**:
  ```typescript
  {
    "data": {
      "access_token": "...",
      "refresh_token": "...",
      "user": {
        "id": "uuid",
        "email": "user@example.com"
      }
    }
  }
  ```

- **Kody błędów**:
  - `400` - niepoprawny payload (brakujące pola)
  - `401` - niepoprawne dane uwierzytelniające
  - `429` - rate limiting

### Implementacja wywołania API

```typescript
import { apiFetchJson, ApiError } from "@/lib/api/apiFetchJson";
import type { LoginCommand, LoginResponseDto } from "@/types";

async function loginUser(command: LoginCommand): Promise<LoginResponseDto> {
  return apiFetchJson<LoginResponseDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(command),
  });
}
```

### Obsługa tokenów po zalogowaniu
Po pomyślnym zalogowaniu:
1. Tokeny (`access_token`, `refresh_token`) powinny być przechowywane (localStorage/cookies)
2. Supabase Auth może automatycznie zarządzać sesją
3. Przekierowanie do `/app/goals` za pomocą `window.location.href`

## 8. Interakcje użytkownika

| Interakcja | Element | Oczekiwane zachowanie |
|------------|---------|----------------------|
| Wpisanie email | Input email | Aktualizacja `values.email`, wyczyszczenie `errors.email` |
| Wpisanie hasła | Input password | Aktualizacja `values.password`, wyczyszczenie `errors.password` |
| Kliknięcie "Zaloguj" | Button submit | Walidacja formularza, jeśli poprawne → wywołanie API |
| Submit formularza (Enter) | Form | Jak wyżej |
| Kliknięcie "Zarejestruj się" | Link | Nawigacja do `/register` |
| Fokus na polu z błędem | Input | Screen reader odczyta błąd przez `aria-describedby` |

## 9. Warunki i walidacja

### Walidacja po stronie klienta

| Pole | Warunek | Komunikat błędu |
|------|---------|-----------------|
| Email | Pole wymagane | "Email jest wymagany" |
| Email | Format email (regex) | "Niepoprawny format adresu email" |
| Hasło | Pole wymagane | "Hasło jest wymagane" |

### Regex dla walidacji email
```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Funkcja walidacji

```typescript
function validateLoginForm(values: LoginFormVm): LoginFormErrors {
  const errors: LoginFormErrors = {};

  const trimmedEmail = values.email.trim();
  if (!trimmedEmail) {
    errors.email = "Email jest wymagany";
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = "Niepoprawny format adresu email";
  }

  if (!values.password) {
    errors.password = "Hasło jest wymagane";
  }

  return errors;
}
```

### Wpływ walidacji na UI
- Błędy wyświetlane pod polami w kolorze `#C17A6F`
- Pola z błędami mają `aria-invalid="true"`
- Przycisk submit disabled gdy `isSubmitting=true`
- Przycisk submit może być disabled przy błędach (opcjonalnie)

## 10. Obsługa błędów

### Scenariusze błędów i komunikaty

| Scenariusz | Kod HTTP | Komunikat dla użytkownika | Zachowanie UI |
|------------|----------|---------------------------|---------------|
| Błędny email lub hasło | 401 | "Niepoprawny email lub hasło" | Banner błędu w `aria-live` |
| Niepoprawny payload | 400 | "Wystąpił błąd. Spróbuj ponownie." | Banner błędu |
| Rate limiting | 429 | "Zbyt wiele prób. Spróbuj ponownie później." | Banner błędu |
| Błąd sieci | - | "Nie udało się połączyć z serwerem. Sprawdź połączenie." | Banner błędu |
| Błąd serwera | 5xx | "Wystąpił błąd serwera. Spróbuj ponownie później." | Banner błędu |

### Bezpieczeństwo - nieujawnianie informacji
Zgodnie z wymaganiami, przy błędzie 401 komunikat brzmi "Niepoprawny email lub hasło" - nie informujemy, czy email istnieje w systemie.

### Implementacja obsługi błędów

```typescript
try {
  const response = await loginUser(command);
  // Sukces - przekierowanie
  window.location.href = "/app/goals";
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        setErrors({ form: "Niepoprawny email lub hasło" });
        break;
      case 429:
        setErrors({ form: "Zbyt wiele prób. Spróbuj ponownie później." });
        break;
      case 400:
        setErrors({ form: "Wystąpił błąd. Spróbuj ponownie." });
        break;
      default:
        setErrors({ form: "Wystąpił błąd serwera. Spróbuj ponownie później." });
    }
  } else {
    setErrors({ form: "Nie udało się połączyć z serwerem. Sprawdź połączenie." });
  }
}
```

### Dostępność błędów
- Banner błędu formularza w kontenerze z `role="status"` i `aria-live="polite"`
- Błędy pól powiązane przez `aria-describedby`
- Pola z błędami oznaczone `aria-invalid="true"`

## 11. Kroki implementacji

1. **Utworzenie strony Astro**
   - Utworzyć plik `src/pages/login.astro`
   - Osadzić `Layout` z tytułem "Logowanie"
   - Dodać `<main aria-label="Logowanie">` z React island `LoginPage`

2. **Utworzenie komponentu LoginPage**
   - Utworzyć plik `src/components/auth/LoginPage.tsx`
   - Zaimplementować layout strony (centrowanie, max-width)
   - Osadzić `LoginHeader` i `LoginForm`

3. **Utworzenie komponentu LoginHeader**
   - Utworzyć plik `src/components/auth/LoginHeader.tsx`
   - Zaimplementować nagłówek z tytułem i opisem

4. **Utworzenie komponentu LoginForm**
   - Utworzyć plik `src/components/auth/LoginForm.tsx`
   - Zaimplementować strukturę formularza z polami email i hasło
   - Wykorzystać istniejące komponenty Shadcn: `Input`, `Label`, `Button`
   - Dodać link do rejestracji

5. **Implementacja logiki formularza**
   - Dodać stan formularza (`values`, `errors`, `isSubmitting`)
   - Zaimplementować funkcję walidacji `validateLoginForm`
   - Zaimplementować handlery `handleChange` i `handleSubmit`

6. **Integracja z API**
   - Utworzyć funkcję `loginUser` wykorzystującą `apiFetchJson`
   - Zaimplementować wywołanie API w `handleSubmit`
   - Obsłużyć przekierowanie po sukcesie

7. **Obsługa błędów**
   - Zaimplementować banner błędów formularza z `aria-live`
   - Obsłużyć różne kody błędów HTTP
   - Dodać komunikaty błędów walidacji pod polami

8. **Stylowanie**
   - Zastosować istniejące style projektu (Tailwind)
   - Zachować spójność z innymi formularzami (np. `GoalCreateForm`)
   - Użyć kolorów: `#4A3F35` (tekst), `#C17A6F` (błędy), `#D4A574` (primary)

9. **Dostępność**
   - Dodać odpowiednie atrybuty `aria-*`
   - Zapewnić poprawną nawigację klawiaturą
   - Przetestować z czytnikiem ekranu

10. **Testowanie**
    - Sprawdzić walidację formularza (puste pola, niepoprawny email)
    - Sprawdzić obsługę błędu 401
    - Sprawdzić przekierowanie po sukcesie
    - Sprawdzić link do rejestracji
    - Sprawdzić responsywność
