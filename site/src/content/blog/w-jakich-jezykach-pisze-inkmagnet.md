---
title: "W jakich językach naprawdę pisze InkMagnet?"
seoTitle: "Jakie języki obsługuje InkMagnet?"
description: "InkMagnet w pełni obsługuje angielski i polski, nie listę pięćdziesięciu języków z marketingu. Co taka lista musi realnie spełniać, na konkretach."
lang: pl
pubDate: 2026-09-30
translationOf: what-languages-does-inkmagnet-support
heroImage: ../../assets/blog/w-jakich-jezykach-pisze-inkmagnet-hero.jpg
heroAlt: "Trzy zamknięte książki w twardej oprawie, różnej wielkości, z pustymi grzbietami i kolorowymi wstążkami zakładek, a na wierzchu mała książka oprawiona w płótno w kolorze głębokiego indygo obok kościaka introligatorskiego i mosiężnej lupy"
coverPrompt: "A stack of three closed hardcover books of different sizes on a dark wooden desk, each spine and cover completely blank without any lettering, marked with different colored ribbon bookmarks, one small deep indigo clothbound book resting on top of the stack, a bone folder and a brass magnifying glass beside them, warm side light from a desk lamp, soft dark background, shallow depth of field"
eyebrow: "PORADNIK"
---

Otwórz formularz nowego projektu w InkMagnet, a lista języków ma dwie pozycje: angielski i polski. To cała lista. Żadnej ukrytej opcji beta, żadnego "wkrótce" przy portugalskim czy niemieckim. Wygląda to skromnie obok strony konkurenta, która wymienia dziesięć języków albo obiecuje pisanie "w dowolnym języku" — dopóki nie sprawdzisz, co te dłuższe listy naprawdę dają.

## Dwa języki, celowo

Każda książka w InkMagnet, w obu językach, przechodzi ten sam proces: research, pisanie rozdziałów, redakcję, a potem skład w LaTeX-u z dzieleniem wyrazów dostosowanym do języka. Ten ostatni element pomija większość "wielojęzycznych" narzędzi do książek AI. Angielski i polski to dwa języki, w których produkt jest faktycznie redagowany i korygowany, oraz dwa, pod które dostrojono skład, a nie dwa, na które akurat ktoś przetłumaczył interfejs.

Zestawmy to z warstwą AI do generowania treści w Designrr, czyli Wordgenie, która pisze ebooka w dziesięciu językach: angielskim, holenderskim, francuskim, niemieckim, węgierskim, włoskim, polskim, portugalskim, rumuńskim i hiszpańskim, według własnej dokumentacji narzędzia. Kreator ebooków Sqribble oficjalnie obsługuje wyłącznie angielski; interfejs nie blokuje wklejenia treści w innym języku, a część użytkowników robi dokładnie to, z efektem zależnym wyłącznie od tego, ile redakcji są gotowi wykonać potem, bo narzędzie nigdy nie było budowane ani sprawdzane pod kątem żadnego języka poza angielskim.

## Co deklarowany język musi realnie pokryć

"Obsługuje francuski" może znaczyć trzy różne rzeczy: model AI potrafi napisać poprawne gramatycznie zdania po francusku, gotowy PDF poprawnie dzieli francuskie wyrazy przy łamaniu wersów, oraz ktoś, kto czyta po francusku zawodowo, sprawdził efekt pod kątem drobiazgów, które płynny, ale niebędący native speakerem tekst gubi: szyk zdania, rejestr, różnicę między formalnym a nieformalnym zwracaniem się do czytelnika. Nic z tego nie wyłapie sprawdzanie pisowni. Narzędzie, które przechodzi tylko pierwszy próg, i tak odda maszynopis pełen błędów typograficznych, które native speaker zauważy w pierwszym akapicie.

Warstwa składu pokazuje tę różnicę najszybciej. [System dzielenia wyrazów w LaTeX-u](/pl/blog/co-latex-daje-twojej-ksiazce/) opiera się na zestawach wzorców trenowanych osobno dla każdego języka; sam silnik babel zawiera wzorce dzielenia dla około 170 języków w blisko 40 systemach pisma, więc surowa zdolność techniczna do poprawnego dzielenia wyrazów w dziesiątkach języków już istnieje w tym samym zestawie narzędzi, na którym działa InkMagnet. Posiadanie pliku wzorców to nie jest trudna część. Trudna część to sprawdzenie, czy książka naprawdę czyta się tak, jakby napisał ją ktoś biegły w tym języku, rozdział po rozdziale.

Weźmy francuski jako konkretny przykład tego, co wyłapuje taka weryfikacja. Model AI poproszony o francuską prozę zwykle napisze coś poprawnego gramatycznie, ale formalny francuski w tekstach niebeletrystycznych opiera się na innym rejestrze niż dosłowne tłumaczenie z angielskiego zwykle podpowiada: dłuższe zdania podrzędne, bardziej zdystansowane "vous" w tekstach poradnikowych i idiomy, które nie przetrwają dosłownego przełożenia z angielskiego wyczucia frazy. Nic z tego nie zgłosi sprawdzanie pisowni. Efekt to książka, która czyta się jak napisana przez kogoś biegłego we francuskim jako drugim języku, a nie pierwszym, i tylko biegła redakcja wyłapuje tę różnicę, zanim zrobi to czytelnik.

## Dwa języki, dwa realne rynki

Jest też prostszy powód, dla którego lista to akurat angielski i polski, a nie angielski i cokolwiek innego: to dwa rynki, pod które InkMagnet jest dziś faktycznie budowany i sprzedawany: samodzielni wydawcy, agencje i twórcy kursów piszący po angielsku, oraz ta sama grupa w Polsce. Dodanie języka, którego nikt w zespole nie umie zredagować i o który nikt z obecnych klientów nie pyta, byłoby optymalizowaniem strony marketingowej, a nie produktu.

## Dlaczego lista zostaje krótka, a nie długa

Każdy język na liście "obsługujemy X języków" to język, który trzeba stale weryfikować, gdy zmieniają się modele AI, gdy dopracowuje się styl firmowy i gdy dochodzą nowe szablony rozdziałów. Dodanie języka, którego nie da się zredagować, oznacza, że każda przyszła funkcja musi być sprawdzana też pod niego — albo po cichu zaczyna odstawać od angielskiego, mimo że wciąż widnieje na stronie marketingowej. To rachunek za utrzymanie, który konkurenci odkładają na później, a nie taki, który już opłacili.

Trzymanie się angielskiego i polskiego oznacza, że oba dostają tę samą uwagę: tę samą kontrolę idiomów i rejestru, tę samą staranność przy wyjątkach w dzieleniu wyrazów, te same szablony otwarć rozdziałów i ramek sprawdzane na prawdziwych książkach w danym języku, a nie zakładane jako "przetłumaczy się samo". Lista dziesięciu języków, z których dziewięć przeszło tylko etap generowania, to nie większy produkt. To ten sam produkt z dziewięcioma dodatkowymi sposobami na rozczarowanie czytelnika.

## Jeśli potrzebujesz książki w trzecim języku

Dziś InkMagnet nie pisze w trzecim języku i nie ma tu obietnicy planu, że ta luka zniknie w konkretnym terminie. Jeśli Twój projekt naprawdę wymaga francuskiego, niemieckiego czy hiszpańskiego, uczciwe opcje to: napisać książkę po angielsku w InkMagnet i zlecić profesjonalne tłumaczenie później, albo poczekać, bo dodanie języka porządnie oznacza dodanie stojącej za nim pracy redakcyjnej i typograficznej, a nie samo przełączenie opcji w rozwijanej liście. Przetłumaczony maszynopis zachowuje też cały research i strukturę, które InkMagnet już wykonał, a to zwykle droższa połowa dobrego napisania książki, więc przetłumaczenie gotowego angielskiego szkicu wychodzi taniej niż zamawianie oryginalnej książki od zera w tym trzecim języku.

Jeśli ważysz to rozwiązanie przeciwko narzędziu, które wymienia Twój docelowy język na stronie głównej, warto realnie otworzyć przykładowy rozdział w tym języku, zanim zapłacisz za subskrypcję. Lista dziesięciu języków mówi, co potrafi spróbować warstwa AI do generowania treści. Nie mówi, czy ktokolwiek sprawdził, co ona faktycznie produkuje.

Dla projektu po angielsku albo po polsku [zacznij książkę od jednego tematu](https://app.inkmagnet.com/auth/register), a cały proces (research, pisanie, redakcja, skład, okładka) działa w języku, którego faktycznie potrzebujesz. Jeśli wciąż porównujesz to z narzędziami, które na papierze wymieniają więcej języków, [pełne porównanie z Designrr](/pl/blog/inkmagnet-czy-designrr/) i [zestawienie ze Sqribble](/pl/blog/inkmagnet-czy-sqribble/) pokazują, jak wygląda ich obsługa języków, gdy zejdzie się głębiej niż strona główna.
