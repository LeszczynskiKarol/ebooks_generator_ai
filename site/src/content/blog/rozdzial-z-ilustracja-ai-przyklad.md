---
title: "Jak wygląda rozdział z ilustracją AI - przykład krok po kroku"
seoTitle: "Rozdział z ilustracją AI - przykład"
description: "Krok po kroku: jak powstaje ilustracja do rozdziału w InkMagnet. Od briefu AI, przez FLUX 1.1 Pro Ultra, do wstawienia w skład LaTeX."
lang: pl
pubDate: 2026-10-04
heroImage: ../../assets/blog/rozdzial-z-ilustracja-ai-przyklad-hero.jpg
heroAlt: "Pojedyncza czysta, niezapisana fotografia oprawiona na drewnianej sztaludze pod kierunkowym światłem lampy, z lupą i kościanym grzbietowcem leżącymi obok, stosem czystych kartonów ilustratorskich i butelką atramentu w kolorze głębokiego indygo z piórem opartym o jej szyjkę"
coverPrompt: "A single blank, unmarked photographic print propped on a small wooden easel under a raking desk lamp, a loupe resting beside it, a stack of blank illustration board leaning against the easel, a bone folder lying on a clean cloth, a bottle of deep indigo ink with a dip pen resting across its neck, no text or readable marks anywhere in the frame"
eyebrow: "WARSZTAT"
---

Pytanie, które dostajemy najczęściej po "ile to kosztuje", brzmi: skąd się bierze ta ilustracja w rozdziale i czy to naprawdę pasuje do treści, czy to przypadkowe zdjęcie z banku. Najłatwiej odpowiedzieć na konkretnym przykładzie, więc przejdźmy cały proces krok po kroku, od gotowego tekstu rozdziału do obrazka wstawionego w skład książki - na przykładzie rozdziału z deserami w wygenerowanej książce kucharskiej o frytkownicy beztłuszczowej.

## Krok 1: model czyta rozdział i pisze brief, nie Ty

Ilustracje nie są dobierane z banku zdjęć po słowach kluczowych z tytułu rozdziału. Gdy rozdział przejdzie już recenzję i poprawki, Claude Sonnet dostaje do przeczytania jego pełny, finalny tekst i w jednym kroku zwraca cztery rzeczy:

- miejsce w rozdziale, gdzie obraz ma stanąć (konkretny akapit, nie "gdzieś na początku"),
- podpis pod ilustracją, napisany w języku książki,
- angielski prompt opisujący scenę, gotowy do przekazania modelowi generującemu obraz,
- rodzaj obrazu: zdjęcie dokumentalne, zdjęcie studyjne albo płaska ilustracja edytorska.

Dla rozdziału z deserami w książce o frytkownicy beztłuszczowej brief każe wygenerować surowe, reportażowe zdjęcie chrupiącego churros prosto z koszyka, z podpisem po polsku o karmelizowanej skórce. Rozdział poradnika o budżetowaniu firmowym w innej książce dostałby zupełnie inny brief: płaską ilustrację z prostymi kształtami, bo planowanie wydatków nie ma żadnego fizycznego przedmiotu do sfotografowania. Ten wybór rodzaju obrazu dzieje się automatycznie, rozdział po rozdziale, bez Twojego udziału - model czyta treść, nie szablon.

## Krok 2: FLUX 1.1 Pro Ultra renderuje obraz w mniej niż 10 sekund

Brief trafia do FLUX 1.1 Pro Ultra, modelu renderującego w rozdzielczości 4MP (do 2048×2048 px, czterokrotnie więcej niż standardowe modele tekst-na-obraz), który generuje obraz w czasie poniżej 10 sekund (specyfikacja producenta, stan na październik 2026). Model ma dwa tryby: Raw, nastawiony na surowy, mniej syntetyczny realizm zdjęcia reporterskiego, i tryb standardowy, lepszy do skomponowanych, studyjnych kadrów. To, który tryb włączyć, decyduje brief z kroku 1, obraz po obrazie - zdjęcie jedzenia czy reportażowa scena z ludźmi dostaje Raw, ilustracja koncepcyjna go nie potrzebuje.

Jeśli w kadrze mają się znaleźć ludzie, ich wygląd jest dopasowany do języka i regionu książki: polska książka dostaje ludzi o środkowoeuropejskim wyglądzie w realistycznie polskim otoczeniu, niemiecka - odpowiednio niemiecki kontekst, i tak dla każdego z obsługiwanych języków. Bez tego dopasowania okładka i ilustracje "reportażowe" w książce pisanej dla polskiego czytelnika wyglądałyby jak przypadkowe zdjęcie stockowe z amerykańskiego biura.

Każda wygenerowana ilustracja - dokładnie jak każda okładka - ma w promptcie twardy zakaz: żadnego tekstu, żadnych słów, liter, etykiet ani znaku wodnego w kadrze. To ta sama reguła, która broni okładek przed pseudo-tekstem na kaszcie zecerskiej czy odbitce korektorskiej; dotyczy każdego obrazu w książce, nie tylko hero na blogu.

## Krok 3: obraz trafia prosto do składu LaTeX

Gotowy plik jest zapisywany (S3 z lokalnym zapasowym katalogiem), a serwer sam wstawia blok `\begin{figure}` z tym obrazem i podpisem w kodzie LaTeX danego rozdziału - bez eksportu, bez kopiowania pliku, bez ręcznego pozycjonowania. Obraz dostaje format 3:2, ten sam, który InkMagnet trzyma dla każdej ilustracji w treści książki, więc kolumna tekstu i obraz mają spójne proporcje na każdej stronie, nie przypadkowy kadr, jaki wyszedł z generatora. Dzieje się to w tym samym przebiegu składu, który generuje klikalny spis treści, inicjały na początku rozdziałów i stylowane tabele; [więcej o tym, co daje skład LaTeX, piszemy tutaj](/pl/blog/co-latex-daje-twojej-ksiazce/). Jeśli któryś krok się nie uda - brief, rendering albo zapis pliku - rozdział po prostu zostaje bez ilustracji, a cała książka i tak się składa i trafia do Ciebie, bo ten etap jest opcjonalny, a jego awaria nieblokująca.

## Ile ilustracji dostaje jedna książka

Liczba obrazów nie jest ustalona na "jeden na rozdział" z definicji - zależy od gęstości, którą wybierzesz przy tworzeniu książki. Ustawienie standardowe celuje w jedną ilustrację na około pięć stron treści, gęstsze ustawienie - na jedną na trzy strony, z twardym limitem 6 obrazów w jednym rozdziale i 15 w całej książce. Krótki rozdział na dwie strony może więc zostać bez obrazu, a długi, bogaty w treść rozdział - z dwoma lub trzema. Dla przykładowej książki na 56 stron i 6 rozdziałów to realnie kilkanaście ilustracji dopasowanych do konkretnych przepisów, nie jedna okładka i resztki tekstu bez żadnej grafiki.

Ta sama logika obejmuje darmowe, opcjonalne ilustracje przy każdym z pięciu progów cenowych InkMagnet, od Compact za 9,99 dolara (30-45 stron) po Complete za 34,99 dolara (161-200 stron) - gęstsze ustawienie w droższym, dłuższym projekcie po prostu generuje więcej obrazów, bo jest więcej treści do zilustrowania, nie bo dopłaciłeś za sam dostęp do tej funkcji.

## Co, jeśli obraz nie trafia w sedno

Ilustracja żyje w tej samej edytowalnej książce co reszta treści: jeśli obraz w rozdziale czwartym nie pasuje, wygenerujesz go ponownie albo podmienisz w edytorze, bez nowego zlecenia i bez dodatkowej opłaty. To inna sytuacja niż u freelancera czy w abonamencie na zdjęcia stockowe, gdzie każda poprawka to nowa faktura albo zużyty kredyt - [ile faktycznie kosztują ilustracje poza InkMagnet, liczymy tutaj](/pl/blog/ile-kosztuja-ilustracje-do-ksiazki/).

Chcesz zobaczyć efekt na żywych stronach, nie na opisie procesu? [Surowe, nieretuszowane strony z dwóch wygenerowanych książek kucharskich - z fotografiami AI przy konkretnych przepisach - są tutaj](/pl/przyklady/): książka o frytkownicy beztłuszczowej z fotografią udek z kurczaka prosto z koszyka i osobnym rozdziałem deserowym oraz druga, dla Thermomixa, ze zdjęciem gulaszu z wolnego gotowania obok tablicy porównania czasów. Obie pokazują ten sam skład LaTeX, te same automatycznie wstawione ilustracje i tę samą ciągłą numerację przepisów przez całą książkę, nie tylko w jednym rozdziale na pokaz.

A jeśli wolisz od razu zobaczyć to we własnej książce, [zacznij od swojego tematu](https://app.inkmagnet.com/auth/register) - ilustracje pojawią się już wstawione na swoje miejsce, bez osobnego kroku po stronie.
