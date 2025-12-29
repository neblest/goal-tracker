# Plan implementacji widoku Landing Page (Onboarding)

## 1. Przegląd

Widok Landing Page (Onboarding) jest publiczną stroną startową aplikacji GoalTracker, dostępną dla niezalogowanych użytkowników. Głównym celem widoku jest przedstawienie wartości aplikacji poprzez wizualne wyjaśnienie procesu korzystania z niej oraz przekierowanie użytkowników do logowania lub rejestracji.

Widok składa się z trzech kluczowych sekcji:
- Sekcja Hero z krótkim opisem aplikacji
- Trzy statyczne infografiki prezentujące kroki: cel → progres → refleksja + AI
- Przyciski nawigacyjne (CTA) do logowania i rejestracji

Widok jest w pełni statyczny, nie wymaga pobierania danych z API ani zarządzania stanem aplikacji.

## 2. Routing widoku

- **Ścieżka**: `/`
- **Plik strony**: `src/pages/index.astro`
- **Dostępność**: Widok publiczny, dostępny dla wszystkich użytkowników (zalogowanych i niezalogowanych)
- **Uwaga**: Zalogowani użytkownicy mogą być opcjonalnie przekierowywani do `/app/goals` (rozważenie w przyszłości)

## 3. Struktura komponentów

```
src/pages/index.astro
└── Layout.astro
    └── LandingPage.astro
        ├── <header> (inline)
        │   └── Logo/nazwa aplikacji
        ├── <main>
        │   ├── HeroSection.astro
        │   │   ├── <h1> Tytuł
        │   │   ├── <p> Opis wartości aplikacji
        │   │   └── AuthButtons.astro (CTA)
        │   └── OnboardingSteps.astro
        │       ├── OnboardingCard.astro (Krok 1: Cel)
        │       ├── OnboardingCard.astro (Krok 2: Progres)
        │       └── OnboardingCard.astro (Krok 3: Refleksja + AI)
        └── <footer> (inline, opcjonalny)
```

## 4. Szczegóły komponentów

### LandingPage.astro

- **Opis**: Główny komponent strony onboardingowej, zawierający całą strukturę widoku. Komponent Astro (statyczny, bez JavaScript po stronie klienta).
- **Główne elementy**:
  - `<header>` - minimalistyczny nagłówek z logo/nazwą aplikacji
  - `<main role="main">` - główna zawartość strony
  - `<footer>` - opcjonalny stopka (np. prawa autorskie)
- **Obsługiwane interakcje**: Brak (statyczny komponent)
- **Obsługiwana walidacja**: Brak
- **Typy**: Brak
- **Propsy**: Brak

### HeroSection.astro

- **Opis**: Sekcja powitalna z głównym przekazem aplikacji. Zawiera tytuł, podtytuł opisujący wartość aplikacji oraz przyciski CTA.
- **Główne elementy**:
  - `<section>` z klasami dla centrowania i stylowania
  - `<h1>` - główny tytuł (np. "GoalTracker")
  - `<p>` - opis wartości aplikacji (np. "Osiągaj cele, ucz się z doświadczeń, rozwijaj się z pomocą AI")
  - `AuthButtons.astro` - komponent z przyciskami nawigacyjnymi
- **Obsługiwane interakcje**: Brak (delegowane do AuthButtons)
- **Obsługiwana walidacja**: Brak
- **Typy**: Brak
- **Propsy**:
  - `title: string` - tytuł sekcji hero
  - `description: string` - opis wartości aplikacji

### AuthButtons.astro

- **Opis**: Komponent zawierający przyciski CTA prowadzące do logowania i rejestracji. Używa komponentu Button z wariantami.
- **Główne elementy**:
  - `<div>` - kontener flexbox dla przycisków
  - `<a href="/login">` - link do logowania (stylizowany jako Button variant="outline")
  - `<a href="/register">` - link do rejestracji (stylizowany jako Button variant="default")
- **Obsługiwane interakcje**:
  - Kliknięcie "Zaloguj się" → nawigacja do `/login`
  - Kliknięcie "Załóż konto" → nawigacja do `/register`
- **Obsługiwana walidacja**: Brak
- **Typy**: Brak
- **Propsy**:
  - `loginText?: string` - tekst przycisku logowania (domyślnie "Zaloguj się")
  - `registerText?: string` - tekst przycisku rejestracji (domyślnie "Załóż konto")

### OnboardingSteps.astro

- **Opis**: Sekcja prezentująca trzy kroki korzystania z aplikacji w formie infografik/kafelków.
- **Główne elementy**:
  - `<section>` z nagłówkiem sekcji
  - `<h2>` - opcjonalny nagłówek (np. "Jak to działa?")
  - `<div>` - kontener grid/flex dla trzech kafelków
  - Trzy instancje `OnboardingCard.astro`
- **Obsługiwane interakcje**: Brak
- **Obsługiwana walidacja**: Brak
- **Typy**: Brak
- **Propsy**: Brak (dane kroków zdefiniowane wewnątrz komponentu)

### OnboardingCard.astro

- **Opis**: Pojedynczy kafelek/infografika przedstawiająca jeden krok procesu korzystania z aplikacji.
- **Główne elementy**:
  - `<article>` lub `<div>` - kontener kafelka z stylami Card
  - Ikona (z lucide-react lub SVG inline)
  - `<h3>` - tytuł kroku
  - `<p>` - opis kroku
- **Obsługiwane interakcje**: Brak
- **Obsługiwana walidacja**: Brak
- **Typy**:
  ```typescript
  interface OnboardingCardProps {
    icon: string; // nazwa ikony lucide lub komponent SVG
    title: string;
    description: string;
    step: number; // numer kroku (1, 2, 3)
  }
  ```
- **Propsy**:
  - `icon: string` - ikona reprezentująca krok
  - `title: string` - tytuł kroku
  - `description: string` - opis kroku
  - `step: number` - numer kroku dla wizualnej numeracji

## 5. Typy

Widok nie wymaga definiowania nowych typów DTO ani ViewModeli, ponieważ operuje wyłącznie na danych statycznych. Poniżej znajdują się jedynie interfejsy propsów komponentów:

### OnboardingCardProps

```typescript
interface OnboardingCardProps {
  icon: string;
  title: string;
  description: string;
  step: number;
}
```

### HeroSectionProps

```typescript
interface HeroSectionProps {
  title: string;
  description: string;
}
```

### AuthButtonsProps

```typescript
interface AuthButtonsProps {
  loginText?: string;
  registerText?: string;
}
```

## 6. Zarządzanie stanem

Widok Landing Page jest w pełni statyczny i nie wymaga zarządzania stanem. Wszystkie dane są zdefiniowane bezpośrednio w komponentach jako stałe wartości.

- **Brak React hooks**: Komponenty są implementowane jako komponenty Astro (.astro), bez potrzeby używania React dla interaktywności
- **Brak custom hooks**: Nie ma potrzeby tworzenia niestandardowych hooków
- **Brak Context/Store**: Widok nie wymaga współdzielenia stanu między komponentami

Jedyną "dynamiczną" częścią są linki nawigacyjne, które są obsługiwane przez natywną nawigację przeglądarki.

## 7. Integracja API

Widok Landing Page **nie wymaga integracji z API**. Jest to w pełni statyczna strona bez pobierania ani wysyłania danych.

- **Brak wywołań API**: Wszystkie treści są statyczne
- **Brak autoryzacji**: Widok jest publiczny
- **Nawigacja**: Realizowana przez standardowe linki `<a href="...">` do `/login` i `/register`

## 8. Interakcje użytkownika

| Interakcja | Element | Oczekiwany rezultat |
|------------|---------|---------------------|
| Kliknięcie "Zaloguj się" | Przycisk w HeroSection | Nawigacja do `/login` |
| Kliknięcie "Załóż konto" | Przycisk w HeroSection | Nawigacja do `/register` |
| Nawigacja klawiaturą (Tab) | Wszystkie interaktywne elementy | Widoczny focus ring na przyciskach/linkach |
| Kliknięcie Enter na fokusowanym linku | Przyciski CTA | Nawigacja do odpowiedniej strony |
| Scrollowanie strony | Cała strona | Płynne przewijanie między sekcjami |

## 9. Warunki i walidacja

Widok Landing Page **nie wymaga walidacji danych wejściowych**:

- **Brak formularzy**: Widok nie zawiera żadnych pól wejściowych
- **Brak danych użytkownika**: Wszystkie treści są statyczne
- **Brak warunkowego renderowania**: Wszystkie elementy są zawsze widoczne

Jedyny warunek do rozważenia (opcjonalny, do implementacji w przyszłości):
- Sprawdzenie czy użytkownik jest zalogowany i ewentualne przekierowanie do `/app/goals`

## 10. Obsługa błędów

Widok statyczny ma minimalny zakres potencjalnych błędów:

| Scenariusz | Obsługa |
|------------|---------|
| Błąd ładowania strony | Standardowa obsługa błędów Astro (500.astro) |
| Brak połączenia z internetem | Strona powinna być w pełni dostępna (statyczny HTML/CSS) |
| Nieobsługiwana przeglądarka | Progresywne ulepszanie - podstawowa funkcjonalność działa wszędzie |
| Błędny link (404) | Strona `/login` lub `/register` nie istnieje - obsługa przez dedykowaną stronę 404 |

**Strategia resilience**:
- Używanie semantycznego HTML dla maksymalnej kompatybilności
- CSS z fallbackami dla starszych przeglądarek
- Linki jako prawdziwe `<a>` (działają nawet bez JavaScript)

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury plików

1. Utwórz katalog `src/components/landing/` dla komponentów strony onboardingowej
2. Utwórz pliki komponentów:
   - `src/components/landing/LandingPage.astro`
   - `src/components/landing/HeroSection.astro`
   - `src/components/landing/AuthButtons.astro`
   - `src/components/landing/OnboardingSteps.astro`
   - `src/components/landing/OnboardingCard.astro`

### Krok 2: Implementacja komponentu OnboardingCard

1. Utwórz komponent `OnboardingCard.astro` z propsami (icon, title, description, step)
2. Zdefiniuj strukturę HTML z ikoną, numerem kroku, tytułem i opisem
3. Zastosuj style używając klas Tailwind zgodnych z designem aplikacji:
   - Użyj kolorystyki: `bg-white`, `border-[#E5DDD5]`, `text-[#4A3F35]`
   - Zaokrąglone rogi: `rounded-xl`
   - Cień: `shadow-sm`
4. Dodaj ikonę z lucide-react (Target, TrendingUp, Brain/Sparkles)

### Krok 3: Implementacja komponentu OnboardingSteps

1. Utwórz komponent `OnboardingSteps.astro`
2. Zdefiniuj dane trzech kroków:
   - Krok 1: "Wyznacz cel" - ikona Target, opis o definiowaniu celów
   - Krok 2: "Śledź postępy" - ikona TrendingUp, opis o rejestrowaniu progresu
   - Krok 3: "Ucz się z AI" - ikona Sparkles/Brain, opis o refleksji i analizie AI
3. Wyrenderuj trzy instancje OnboardingCard w siatce responsywnej
4. Zastosuj responsive grid: `grid-cols-1 md:grid-cols-3`

### Krok 4: Implementacja komponentu AuthButtons

1. Utwórz komponent `AuthButtons.astro`
2. Dodaj dwa linki jako prawdziwe elementy `<a>`:
   - "Zaloguj się" → `/login` (variant="outline")
   - "Załóż konto" → `/register` (variant="default")
3. Zastosuj style Button z istniejącego komponentu UI (inline lub przez klasy)
4. Upewnij się, że linki mają widoczne focus states

### Krok 5: Implementacja komponentu HeroSection

1. Utwórz komponent `HeroSection.astro`
2. Dodaj strukturę HTML:
   - `<section>` z odpowiednimi klasami dla centrowania
   - `<h1>` z tytułem "GoalTracker" (gradient text jak w Welcome.astro)
   - `<p>` z opisem wartości aplikacji
   - Osadzenie komponentu `AuthButtons`
3. Zastosuj style zgodne z istniejącym designem (gradient, typography)

### Krok 6: Implementacja głównego komponentu LandingPage

1. Utwórz komponent `LandingPage.astro`
2. Dodaj strukturę HTML:
   - `<header>` z logo/nazwą aplikacji (opcjonalnie)
   - `<main role="main">` z HeroSection i OnboardingSteps
   - `<footer>` opcjonalny
3. Zastosuj layout strony z odpowiednim paddingiem i max-width
4. Użyj tła `bg-[#FAF8F5]` zgodnego z resztą aplikacji

### Krok 7: Aktualizacja strony index.astro

1. Zaktualizuj `src/pages/index.astro`:
   - Usuń import i użycie komponentu `Welcome.astro`
   - Zaimportuj i użyj `LandingPage.astro`
2. Ustaw odpowiedni tytuł strony w Layout (np. "GoalTracker - Osiągaj cele z pomocą AI")

### Krok 8: Dostępność i semantyka

1. Sprawdź poprawność semantyki HTML:
   - `<main>` jako główna zawartość
   - Hierarchia nagłówków (h1 → h2 → h3)
   - `<nav>` dla nawigacji (jeśli dodany header)
2. Dodaj odpowiednie atrybuty ARIA gdzie potrzebne
3. Przetestuj nawigację klawiaturą (Tab, Enter)
4. Upewnij się, że fokus jest widoczny na wszystkich interaktywnych elementach

### Krok 9: Responsive design

1. Przetestuj widok na różnych rozmiarach ekranu:
   - Mobile: 320px - 768px
   - Tablet: 768px - 1024px
   - Desktop: 1024px+
2. Dostosuj siatki i marginesy dla każdego breakpointu
3. Upewnij się, że tekst jest czytelny na wszystkich urządzeniach

### Krok 10: Finalizacja i testy

1. Uruchom linter i popraw ewentualne błędy (`npm run lint`)
2. Sprawdź formatowanie kodu (`npm run format`)
3. Przetestuj widok w przeglądarce:
   - Nawigacja do `/login` i `/register`
   - Renderowanie wszystkich elementów
   - Responsywność
   - Dostępność (narzędzia deweloperskie, screen reader)
4. Opcjonalnie: dodaj testy E2E dla nawigacji
