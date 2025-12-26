# Dokument wymagań produktu (PRD) - GoalTracker

## 1. Przegląd produktu
GoalTracker to aplikacja webowa w wersji MVP (Minimum Viable Product), zaprojektowana, aby pomagać użytkownikom w konsekwentnym realizowaniu celów i efektywnym uczeniu się z doświadczeń. W odróżnieniu od tradycyjnych narzędzi, aplikacja kładzie nacisk na proces refleksji, analizę postępów i wyciąganie wniosków, wspierając ten proces poprzez automatyczne podsumowania generowane przez AI. Użytkownik może śledzić swoje postępy, analizować przyczyny sukcesów i niepowodzeń, a następnie podejmować kolejne, lepiej skalibrowane próby osiągnięcia swoich celów.

## 2. Problem użytkownika
Głównym problemem, który rozwiązuje GoalTracker, jest trudność użytkowników z utrzymaniem konsekwencji w dążeniu do celów oraz brak mechanizmów do nauki na podstawie wcześniejszych niepowodzeń. Istniejące na rynku aplikacje często ograniczają się do prostego oznaczania celu jako "zrealizowany" lub "niezrealizowany", nie oferując narzędzi do głębszej analizy samego procesu. Skutkuje to powtarzaniem tych samych błędów i spadkiem motywacji. GoalTracker wypełnia tę lukę, dostarczając ustrukturyzowane środowisko do refleksji i iteracyjnego doskonalenia.

## 3. Wymagania funkcjonalne
- F-01: System kont użytkowników: Aplikacja zapewni możliwość rejestracji nowego konta, logowania i wylogowywania.
- F-02: Tworzenie celów: Użytkownik może zdefiniować nowy cel, podając jego unikalną nazwę, liczbową wartość docelową oraz datę końcową (deadline).
- F-03: Niezmienność kluczowych atrybutów celu: Po utworzeniu celu i dodaniu pierwszego wpisu progresu, jego nazwa, wartość docelowa oraz termin stają się nieedytowalne w ramach danej iteracji.
- F-04: Śledzenie progresu: Użytkownik może dodawać do celu wpisy progresu w formie liczbowej. Edycja istniejących wpisów progresu (wartości liczbowej oraz notatki) jest możliwa wyłącznie w ramach celu o statusie "Aktywny". Do każdego wpisu można opcjonalnie dodać krótką notatkę tekstową.
- F-05: Notatki refleksyjne: Każdy cel posiada jedno, dedykowane i stale edytowalne pole tekstowe na ogólne notatki i przemyślenia użytkownika.
- F-06: Statusy celu: Cel może mieć jeden z następujących statusów: "Aktywny", "Zakończony sukcesem", "Zakończony niepowodzeniem", "Porzucony". Cel ze statusem "Porzucony" nie podlega automatycznej zmianie statusu po upływie terminu.
- F-07: Ręczne zakończenie celu sukcesem i automatyczne niepowodzeniem: Użytkownik może ręcznie zakończyć cel sukcesem po osiągnięciu wartości docelowej. Cel zmienia status na "Zakończony niepowodzeniem", gdy po upływie terminu (tj. po godzinie 23:59 wskazanego dnia) wartość docelowa nie została osiągnięta. Zmiana statusu następuje automatycznie przy pierwszej wizycie użytkownika w aplikacji po wystąpieniu danego warunku. Wpisy progresu dodane przed 23:59 w dniu terminu są uwzględniane.
- F-08: Ręczne zakończenie celu: Użytkownik może w dowolnym momencie "Porzucić" cel. Wymagane będzie wówczas podanie powodu z predefiniowanej listy lub wpisanie własnego powodu.
- F-09: Podsumowanie AI: Po zakończeniu celu ze statusem "Zakończony sukcesem" lub "Zakończony niepowodzeniem", przy minimum 3 wpisach progresu, system synchronicznie generuje podsumowanie. W przypadku błędu generowania, użytkownik może ponowić próbę do 3 razy. Po 3 nieudanych próbach, użytkownik będzie miał możliwość ręcznego wpisania podsumowania. Podsumowanie analizuje tempo, regularność wpisów i notatki, a użytkownik zawsze ma możliwość pełnej edycji wygenerowanej lub wpisanej ręcznie treści.
- F-10: Sugestie AI po sukcesie: W przypadku sukcesu, podsumowanie AI zasugeruje kolejny, ambitniejszy cel (np. zwiększając wartość docelową o 20%).
- F-11: Sugestie AI po niepowodzeniu: W przypadku niepowodzenia, podsumowanie AI może zasugerować korektę celu, proponując konkretne zmiany (np. zmniejszenie wartości docelowej lub wydłużenie terminu).
- F-12: Ponawianie celu: Użytkownik może podjąć ponownie cel zakończony niepowodzeniem lub porzucony, ale tylko jeśli jest to najmłodszy cel w łańcuchu iteracji (cel z najnowszą datą utworzenia w danej rodzinie celów). Przy ponowieniu, formularz tworzenia celu jest wstępnie wypełniony, a użytkownik może edytować wartość docelową i termin. W danym łańcuchu iteracji może istnieć tylko jeden aktywny cel jednocześnie.
- F-13: Historia iteracji: Aplikacja przechowuje historię wszystkich podejść (iteracji) do danego celu. Użytkownik ma dostęp do poprzednich prób i ich podsumowań AI z widoku aktywnego celu. Łańcuch iteracji to zbiór celów połączonych relacją parent_goal_id, gdzie każdy cel może mieć tylko jednego rodzica i dowolną liczbę potomków.
- F-14: Wizualizacja postępu: Interfejs celu będzie wyraźnie prezentował pasek postępu (wizualizujący stosunek aktualnej wartości do docelowej) oraz czas pozostały do deadline'u.
- F-15: Onboarding: Na widoku startowym dla niezalogowanych użytkowników znajdą się trzy proste, statyczne infografiki wyjaśniające kluczowe kroki korzystania z aplikacji.
- F-16: Edycja wpisów progresu: Użytkownik może edytować istniejące wpisy progresu (wartość liczbową i treść notatki) wyłącznie w ramach aktywnego celu. Edycja jest niemożliwa po zakończeniu celu (niezależnie od statusu).
- F-17: Potwierdzenie zapisu progresu: Przed ostatecznym zapisaniem nowego lub edytowanego wpisu progresu, system wyświetli użytkownikowi prośbę o potwierdzenie poprawności wprowadzonych danych.

## 4. Granice produktu
Poniższe funkcjonalności celowo NIE wchodzą w zakres wersji MVP:
- Funkcje społecznościowe: Brak profili znajomych, feedu aktywności, komentarzy, udostępniania celów.
- Zaawansowana analityka: Brak rozbudowanych statystyk i dashboardów długoterminowych dla użytkownika.
- Integracje zewnętrzne: Brak integracji z usługami firm trzecich (np. Strava, kalendarze, smartwatche).
- Gamifikacja: Brak systemu odznak, poziomów, punktów czy rankingów.
- Powiadomienia: Brak jakichkolwiek powiadomień (e-mail, push).
- Zaawansowane AI: Brak personalizacji AI w czasie rzeczywistym (np. w formie coacha czy czatu).

## 5. Historyjki użytkowników

---
- ID: US-001
- Tytuł: Rejestracja konta użytkownika
- Opis: Jako nowy użytkownik, chcę móc założyć konto w aplikacji przy użyciu adresu e-mail i hasła, aby móc korzystać z jej funkcjonalności.
- Kryteria akceptacji:
  - Formularz rejestracji zawiera pola na adres e-mail i hasło (z potwierdzeniem).
  - System waliduje poprawność formatu adresu e-mail.
  - System wymaga, aby hasło miało co najmniej 8 znaków.
  - Po pomyślnej rejestracji jestem automatycznie zalogowany i przekierowany na główny widok aplikacji.
  - W przypadku, gdy e-mail jest już zajęty, wyświetlany jest stosowny komunikat błędu.

---
- ID: US-002
- Tytuł: Logowanie użytkownika
- Opis: Jako zarejestrowany użytkownik, chcę móc zalogować się na swoje konto przy użyciu adresu e-mail i hasła, aby uzyskać dostęp do moich celów.
- Kryteria akceptacji:
  - Formularz logowania zawiera pola na adres e-mail i hasło.
  - Po poprawnym wprowadzeniu danych jestem zalogowany i widzę listę moich celów.
  - W przypadku błędnych danych uwierzytelniających, wyświetlany jest stosowny komunikat błędu.

---
- ID: US-003
- Tytuł: Wylogowanie użytkownika
- Opis: Jako zalogowany użytkownik, chcę móc wylogować się z aplikacji, aby zabezpieczyć swoje konto.
- Kryteria akceptacji:
  - W interfejsie aplikacji znajduje się przycisk lub opcja "Wyloguj".
  - Po kliknięciu opcji wylogowania, sesja użytkownika zostaje zakończona.
  - Użytkownik jest przekierowywany na stronę logowania lub startową aplikacji.
  - Po wylogowaniu, próba dostępu do chronionych zasobów wymaga ponownego logowania.

---
- ID: US-004
- Tytuł: Wyświetlanie ekranu onboardingu
- Opis: Jako nowy, niezalogowany użytkownik, chcę zobaczyć proste wyjaśnienie działania aplikacji, aby zrozumieć jej wartość przed rejestracją.
- Kryteria akceptacji:
  - Na stronie startowej dla niezalogowanych użytkowników wyświetlają się trzy statyczne infografiki.
  - Każda infografika wyjaśnia jeden kluczowy krok korzystania z aplikacji (np. tworzenie celu, śledzenie postępów, analiza z AI).
  - Infografiki są czytelne i zrozumiałe bez dodatkowych wyjaśnień.
  - Dostępny jest przycisk prowadzący do rejestracji lub logowania.

---
- ID: US-005
- Tytuł: Tworzenie nowego celu
- Opis: Jako zalogowany użytkownik, chcę móc stworzyć nowy cel, podając jego nazwę, liczbową wartość docelową i datę zakończenia.
- Kryteria akceptacji:
  - Formularz tworzenia celu zawiera pole tekstowe na nazwę, pole liczbowe na wartość docelową i pole wyboru daty na termin.
  - Wszystkie pola są wymagane.
  - Wartość docelowa musi być większa od zera.
  - Data zakończenia musi być datą przyszłą.
  - Po pomyślnym utworzeniu, cel pojawia się na mojej liście celów ze statusem "Aktywny".

---
- ID: US-006
- Tytuł: Wyświetlanie listy celów
- Opis: Jako zalogowany użytkownik, chcę widzieć listę wszystkich moich celów, aby mieć ogólny przegląd moich postępów.
- Kryteria akceptacji:
  - Domyślny widok po zalogowaniu to lista celów.
  - Każdy element na liście wyświetla nazwę celu, pasek postępu i czas pozostały do końca.
  - Cele są domyślnie posortowane, np. od najnowszego do najstarszego.
  - Kliknięcie na cel przenosi mnie do jego szczegółowego widoku.

---
- ID: US-007
- Tytuł: Wizualizacja postępu celu
- Opis: Jako użytkownik, chcę wyraźnie widzieć wizualizację mojego postępu w realizacji celu, aby łatwo ocenić, jak daleko jestem od osiągnięcia wartości docelowej.
- Kryteria akceptacji:
  - W widoku szczegółowym celu wyświetlany jest pasek postępu pokazujący stosunek aktualnej wartości do wartości docelowej.
  - Pasek postępu jest wizualnie wyróżniony i łatwy do odczytania.
  - Obok paska widoczny jest czas pozostały do deadline'u (np. "Pozostało 5 dni").
  - Wartość aktualna i docelowa są wyraźnie wyświetlone (np. "45/100").

---
- ID: US-008
- Tytuł: Dodawanie wpisu progresu
- Opis: Jako użytkownik, chcę móc dodać wpis liczbowy do aktywnego celu, aby zarejestrować postęp w jego realizacji.
- Kryteria akceptacji:
  - W widoku szczegółowym celu znajduje się formularz do dodawania progresu.
  - Przed zapisaniem wpisu system wyświetla okno modalne z pytaniem "Czy na pewno chcesz zapisać ten progres? Upewnij się, że wprowadzone dane są poprawne." i przyciskami "Tak, zapisz" i "Anuluj".
  - Po dodaniu wpisu, ogólny postęp celu jest aktualizowany (pasek postępu, wartość sumaryczna).
  - Nowy wpis jest widoczny na liście wpisów w widoku celu.
  - Po dodaniu pierwszego wpisu, pola nazwy, wartości docelowej i terminu celu stają się nieedytowalne.

---
- ID: US-009
- Tytuł: Dodawanie i edycja notatki refleksyjnej
- Opis: Jako użytkownik, chcę mieć możliwość dodawania i swobodnego edytowania ogólnej notatki refleksyjnej dla każdego celu, aby zapisywać swoje przemyślenia w trakcie jego realizacji.
- Kryteria akceptacji:
  - W widoku szczegółowym celu znajduje się dedykowane, duże pole tekstowe na notatkę refleksyjną.
  - Mogę w dowolnym momencie edytować treść tej notatki.
  - Zmiany są zapisywane automatycznie lub za pomocą przycisku "Zapisz".
  - Treść notatki jest zachowywana między sesjami.

---
- ID: US-010
- Tytuł: Ręczne zakończenie celu sukcesem
- Opis: Jako użytkownik, po osiągnięciu wartości docelowej, chcę mieć możliwość ręcznego zakończenia celu sukcesem.
- Kryteria akceptacji:
  - Gdy suma wpisów progresu jest równa lub większa od wartości docelowej, użytkownik może zakończyć cel sukcesem za pomocą dedykowanego przycisku.
  - Po zakończeniu, wyświetlony zostaje komunikat z gratulacjami.
  - Blokowana jest możliwość dodawania kolejnych wpisów progresu.
  - Blokowana jest możliwość edycji istniejących wpisów progresu.

---
- ID: US-011
- Tytuł: Automatyczne zakończenie celu niepowodzeniem
- Opis: Jako użytkownik, jeśli nie osiągnę wartości docelowej przed upływem terminu, chcę, aby cel automatycznie zmienił status na "Zakończony niepowodzeniem", gdy wejdę do aplikacji.
- Kryteria akceptacji:
  - Gdy odwiedzam aplikację po godzinie 23:59 w dniu terminu, a cel nie został osiągnięty, jego status automatycznie zmienia się na "Zakończony niepowodzeniem".
  - Wpis progresu dodany o 23:58 w dniu terminu jest poprawnie uwzględniany w sumie.
  - Po zmianie statusu na "Zakończony niepowodzeniem", blokowana jest możliwość dodawania kolejnych wpisów progresu.
  - Blokowana jest możliwość edycji istniejących wpisów progresu.

---
- ID: US-012
- Tytuł: Ręczne porzucenie celu
- Opis: Jako użytkownik, chcę mieć możliwość ręcznego zakończenia celu przed terminem, jeśli zdecyduję, że nie chcę go kontynuować.
- Kryteria akceptacji:
  - W widoku celu znajduje się przycisk "Porzuć cel".
  - Po kliknięciu przycisku pojawia się okno modalne z prośbą o podanie powodu.
  - Okno modalne zawiera listę predefiniowanych powodów (np. "Brak czasu", "Cel nierealny", "Zmiana priorytetów") oraz opcję "Inny" z polem tekstowym.
  - Po wybraniu powodu i potwierdzeniu, status celu zmienia się na "Porzucony".
  - Blokowana jest możliwość dodawania kolejnych wpisów progresu.
  - Blokowana jest możliwość edycji istniejących wpisów progresu.

---
- ID: US-013
- Tytuł: Generowanie podsumowania AI po zakończeniu celu
- Opis: Jako użytkownik, po zakończeniu celu ze statusem "Zakończony sukcesem" lub "Zakończony niepowodzeniem", chcę otrzymać automatycznie wygenerowane podsumowanie AI, które pomoże mi zrozumieć moje postępy i wyciągnąć wnioski.
- Kryteria akceptacji:
  - System automatycznie inicjuje generowanie podsumowania AI natychmiast po zmianie statusu celu na "Zakończony sukcesem" lub "Zakończony niepowodzeniem".
  - Generowanie podsumowania następuje tylko wtedy, gdy cel ma co najmniej 3 wpisy progresu.
  - Jeśli cel ma mniej niż 3 wpisy progresu, podsumowanie AI nie jest generowane, a użytkownik widzi informację o niewystarczającej liczbie danych.
  - Proces generowania działa synchronicznie - użytkownik widzi komunikat "Generuję podsumowanie..." podczas przetwarzania.
  - Po pomyślnym wygenerowaniu, podsumowanie jest wyświetlane w dedykowanej sekcji widoku celu.
  - Dla celów ze statusem "Porzucony" podsumowanie AI nie jest generowane.

---
- ID: US-014
- Tytuł: Przeglądanie i edycja podsumowania AI
- Opis: Jako użytkownik, po wygenerowaniu podsumowania AI, chcę móc je przeczytać i w razie potrzeby edytować, aby dostosować je do moich przemyśleń.
- Kryteria akceptacji:
  - Wygenerowane podsumowanie AI jest wyświetlane w edytowalnym polu tekstowym.
  - Mogę dowolnie modyfikować treść podsumowania.
  - Zmiany w podsumowaniu są trwale zapisywane.
  - Edytowane podsumowanie zachowuje swoją treść między sesjami.

---
- ID: US-015
- Tytuł: Ponawianie generowania podsumowania AI w przypadku błędu
- Opis: Jako użytkownik, jeśli generowanie podsumowania AI nie powiedzie się, chcę mieć możliwość ponowienia próby, aby ostatecznie uzyskać automatyczne podsumowanie.
- Kryteria akceptacji:
  - W przypadku błędu generowania, wyświetlany jest komunikat o błędzie i przycisk "Spróbuj ponownie".
  - Przycisk "Spróbuj ponownie" jest dostępny maksymalnie 3 razy.
  - Każde kliknięcie przycisku inicjuje nową próbę synchronicznego generowania podsumowania.
  - Po trzeciej nieudanej próbie generowania, przycisk "Spróbuj ponownie" znika.
  - Po wyczerpaniu prób, użytkownik widzi puste pole tekstowe z komunikatem zachęcającym do ręcznego stworzenia podsumowania.
  - Ręcznie wpisane podsumowanie jest zapisywane i traktowane jak standardowe podsumowanie.

---
- ID: US-016
- Tytuł: Ponawianie celu po niepowodzeniu
- Opis: Jako użytkownik, po nieudanym zakończeniu celu, chcę mieć możliwość jego ponowienia, z opcją dostosowania parametrów na podstawie sugestii AI.
- Kryteria akceptacji:
  - W widoku celu zakończonego niepowodzeniem lub porzuconego znajduje się przycisk "Spróbuj ponownie" tylko wtedy, gdy cel jest najmłodszy w łańcuchu iteracji (ma najnowszą datę utworzenia).
  - Jeśli w łańcuchu iteracji istnieje już aktywny cel, ponowienie celu jest niemożliwe (walidacja na poziomie backendu).
  - Podsumowanie AI może zawierać konkretne sugestie, np. "Spróbuj osiągnąć 70 zamiast 100 w 30 dni lub oryginalne 100, ale w 45 dni".
  - Po kliknięciu przycisku "Spróbuj ponownie" jestem przenoszony do formularza tworzenia celu.
  - Formularz jest wstępnie wypełniony danymi z poprzedniej iteracji (nazwa, wartość docelowa, termin).
  - Mogę edytować wartość docelową i termin przed utworzeniem nowej iteracji celu.
  - Nowo utworzony cel jest nową iteracją, a poprzednia jest zapisana w historii.

---
- ID: US-017
- Tytuł: Kontynuacja celu po sukcesie
- Opis: Jako użytkownik, po pomyślnym osiągnięciu celu, chcę otrzymać od AI sugestię kolejnego, ambitniejszego celu i łatwo go utworzyć.
- Kryteria akceptacji:
  - W widoku celu zakończonego sukcesem, podsumowanie AI zawiera sugestię następnego celu (np. "Świetna robota! Może teraz spróbujesz osiągnąć 120 km?").
  - Obok sugestii znajduje się przycisk "Akceptuj i kontynuuj" lub podobny, ale tylko wtedy gdy cel jest najmłodszy w łańcuchu iteracji.
  - Jeśli w łańcuchu iteracji istnieje już aktywny cel, kontynuacja celu jest niemożliwa (walidacja na poziomie backendu).
  - Po kliknięciu przycisku jestem przenoszony do formularza tworzenia celu z danymi wypełnionymi zgodnie z sugestią AI.
  - Mogę zmodyfikować sugerowane parametry przed utworzeniem nowej iteracji.

---
- ID: US-018
- Tytuł: Dostęp do historii iteracji celu
- Opis: Jako użytkownik realizujący kolejną iterację celu, chcę mieć łatwy dostęp do historii poprzednich prób, aby móc analizować wcześniejsze doświadczenia.
- Kryteria akceptacji:
  - W widoku szczegółowym celu znajduje się zakładka lub sekcja "Historia".
  - W tej sekcji widoczna jest lista poprzednich iteracji celu (łańcuch iteracji zdefiniowany przez relację parent_goal_id).
  - Każdy element na liście pokazuje datę zakończenia, finalny status (sukces/niepowodzenie/aktywny) i osiągnięty wynik.
  - Kliknięcie na historyczną iterację pozwala zobaczyć jej szczegóły, w tym pełne podsumowanie AI.
  - W danym łańcuchu iteracji może istnieć maksymalnie jeden cel aktywny jednocześnie.

---
- ID: US-019
- Tytuł: Edycja wpisu progresu
- Opis: Jako użytkownik, chcę mieć możliwość edycji istniejącego wpisu progresu (zarówno wartości liczbowej, jak i notatki), aby poprawić błędy lub zaktualizować informacje.
- Kryteria akceptacji:
  - Edycja jest możliwa tylko dla celów o statusie "Aktywny".
  - Edycja jest niemożliwa dla celów zakończonych (sukcesem, niepowodzeniem) i porzuconych.
  - W widoku szczegółowym celu, przy każdym wpisie progresu znajduje się opcja "Edytuj".
  - Po kliknięciu "Edytuj", pojawia się formularz lub okno modalne z aktualnymi danymi wpisu (wartość i notatka).
  - Przed zapisaniem zmian system wyświetla okno modalne z prośbą o potwierdzenie.
  - Po zatwierdzeniu zmian, ogólny postęp celu jest przeliczany i aktualizowany (pasek postępu, wartość sumaryczna).
  - Zaktualizowany wpis jest widoczny na liście wpisów.

## 6. Metryki sukcesu
Poniższe wskaźniki będą zbierane i analizowane wewnętrznie w celu oceny produktu i planowania dalszego rozwoju. Dane te nie będą prezentowane użytkownikowi końcowemu.
- Zaangażowanie w progres: ≥ 60% użytkowników z co najmniej jednym aktywnym celem doda do niego minimum jeden wpis progresu.
- Ukończenie celów: ≥ 50% wszystkich utworzonych celów zostanie zakończonych (statusem "sukces" lub "niepowodzenie"), a nie porzuconych.
- Współczynnik ponowień: ≥ 40% celów zakończonych niepowodzeniem lub porzuconych zostanie podjętych ponownie przez użytkowników.
- Skuteczność iteracji: ≥ 70% ponowionych celów zakończy się sukcesem najpóźniej w piątej iteracji.
