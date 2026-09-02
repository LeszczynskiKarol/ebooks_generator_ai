---
title: "Co skład w LaTeX-u daje książce, czego nie dają Word i Canva"
seoTitle: "LaTeX kontra Word i Canva w składzie książki"
description: "Algorytm Knutha-Plassa, dzielenie wyrazów wg wzorców i mikrotypografia z microtype - i czemu Springer, Elsevier i IEEE wciąż prowadzą publikacje przez LaTeX."
lang: pl
pubDate: 2026-09-02
translationOf: what-latex-does-for-your-book
heroImage: ../../assets/blog/co-latex-daje-twojej-ksiazce-hero.jpg
heroAlt: "Drewniana kaszta zecerska pełna rzędów metalowych czcionek drukarskich, obok niej odbitka szczotkowa z naniesionymi korektami i lupa introligatorska, a przy nich mała, zamknięta książka oprawiona w płótno w kolorze głębokiego indygo"
coverPrompt: "A wooden compositor's type case filled with rows of small metal printing letterforms, a galley proof sheet marked with correction symbols and a printer's loupe resting on top of it, a steel ruler nearby, and one small finished deep indigo clothbound book standing closed and complete on the desk beside them"
eyebrow: "WARSZTAT"
---

Otwórz książkę złożoną w Wordzie obok tej samej treści złożonej w LaTeX-u, a różnica nie rzuci się w oczy od razu. Jest cichsza: akapity wyglądają po prostu spokojniej, podziały stron nigdy nie gryzą się z treścią, dzielenie wyrazów trafia dokładnie tam, gdzie postawiłby je redaktor. To nie kwestia gustu. To czterdzieści lat badań nad składem tekstu, których Word i Canva nigdy nie miały uruchamiać.

## Akapit, którego Word w ogóle nie widzi

Word łamie linie jedna po drugiej. Wypełnia wers najpełniej, jak się da, uznaje go za gotowy i przechodzi do następnego bez oglądania się wstecz. Ta zachłanna, liniowa metoda odpowiada za rzeki w wyjustowanym tekście: blade, pionowe kanały powstające tam, gdzie szerokie odstępy wstawione przez Worda, żeby rozciągnąć krótkie wersy, układają się jeden pod drugim na całej stronie.

Domyślny mechanizm łamania wersów w LaTeX-u to algorytm Knutha-Plassa, opublikowany przez Donalda Knutha i Michaela Plassa, który ocenia cały akapit naraz, a nie linię po linii. Szuka takiego zestawu złamań, który minimalizuje łączną "brzydotę" wszystkich wersów razem, dzięki czemu odrobinę ciaśniejszy wers na początku akapitu może zapobiec brzydkiej dziurze trzy linijki dalej. Efekt wygląda niepozornie, i o to właśnie chodzi: nic nie odrywa wzroku od treści zdania.

## Dzielenie wyrazów, które naprawdę zna język

Canva i większość szablonów Worda mają dzielenie wyrazów wyłączone albo ledwo dostrojone, i to właśnie dlatego tyle samodzielnie składanych PDF-ów wygląda luźno albo pełno w nich niezręcznych złamań wersu. Dzielenie wyrazów w LaTeX-u pochodzi z algorytmu, który Frank Liang zbudował do swojej pracy doktorskiej na Stanfordzie w 1983 roku: wzorce skompresowane do struktury zwanej packed trie, wytrenowane na prawdziwych słownikach, które przewidują dopuszczalne miejsca złamania wewnątrz wyrazu, zamiast zgadywać. Przetestowana na dziewięciu językach metoda Lianga osiąga średnią trafność na poziomie około 96%, a dla angielskiego zestaw wzorców potrzebuje listy wyjątków obejmującej zaledwie 14 słów, żeby pokryć przypadki, których wzorce nie łapią.

To różnica między funkcją dzielenia wyrazów, którą się włącza jednym przełącznikiem, a systemem dzielenia wyrazów, nad którym ktoś spędził całą pracę doktorską. Metoda Lianga jest też z założenia niezależna od języka: nie koduje wprost reguł ortografii angielskiej, tylko uczy się wzorców złamań z prawdziwych list podzielonych wyrazów, dlatego społeczność TeX-a zdążyła od tego czasu opracować równoważne zestawy wzorców dla dziesiątek innych języków, bez przepisywania samego algorytmu.

## Mikroskopijne poprawki, których nikt nie nazywa, ale każdy je widzi

Pakiet microtype w LaTeX-u dokłada dwa udoskonalenia, których żadne popularne narzędzie nawet nie dotyka. Character protrusion, czasem nazywane margin kerning, pozwala interpunkcji i kilku kształtom liter lekko wystawać poza margines tekstu, dzięki czemu blok tekstu wygląda na optycznie prosty, a nie mechanicznie wyjustowany. Font expansion rozciąga albo ściska poszczególne glify o ułamek procenta, wers po wersie, żeby algorytm łamania wersów miał miejsce na uniknięcie brzydkiej dziury bez widocznego zniekształcenia jakiegokolwiek wyrazu. Oba działają automatycznie na każdym akapicie w pdfTeX-u, XeTeX-u albo LuaTeX-u. Pola tekstowe w Canvie i justowanie w Wordzie nie mają żadnej z tych opcji, przy żadnym powiększeniu.

## Co idzie w komplecie poza samym akapitem

Ten sam ekosystem, który rozwiązuje łamanie wersów, standaryzuje też elementy dookoła: klikalny, automatycznie generowany spis treści oparty na pakiecie hyperref zamiast ręcznie sklejonej listy numerów stron, inicjały na otwarciach rozdziałów rozmieszczone i dobrane przez pakiet lettrine zamiast rozciągniętej litery z WordArt, tabele liniowane według konwencji z pakietu booktabs zamiast domyślnej siatki Worda, i ramki na kluczowe wnioski budowane jako powtarzalne środowiska tcolorbox zamiast pola tekstowego przesuwanego ręcznie na każdej stronie z osobna. W 150-stronicowym maszynopisie ta spójność nie jest dodatkiem. To jedyny sposób, żeby każde otwarcie rozdziału, każda tabela i każda ramka z cytatem wyglądały, jakby pochodziły z tej samej książki.

## System stojący za publikacjami naukowymi

To nie jest hobbystyczny zestaw narzędzi. Springer, Elsevier i IEEE prowadzą LaTeX-a wewnętrznie, a maszynopis złożony w zgodnej klasie LaTeX-owej może trafić niemal prosto do druku, podczas gdy zgłoszenie w Wordzie ktoś po stronie wydawcy najpierw ręcznie przeformatowuje. Artykuły z fizyki, matematyki i informatyki są składane w LaTeX-u niemal bez wyjątku, w dużej mierze dlatego, że dokumenty pełne wzorów ujawniają dokładnie te same problemy z łamaniem wersów i odstępami, opisane wyżej, w ich najostrzejszej formie. Żadna z tych mechanizmów nie powstała z myślą o samodzielnie wydawanych książkach niebeletrystycznych, ale wydrukowany, profesjonalnie złożony ebook i artykuł z fizyki potrzebują tego samego algorytmu, żeby justowany tekst i podziały stron w ogóle miały sens.

## Co to oznacza dla książki, którą właśnie piszesz

Nie musisz się tego wszystkiego uczyć, żeby z tego skorzystać. InkMagnet prowadzi każdy rozdział przez dokładnie ten sam potok LaTeX-owy (łamanie wersów Knutha-Plassa, dzielenie wyrazów oparte na wzorcach, kerning z microtype, prawdziwy spis treści z hyperref, inicjały z lettrine, tabele z booktabs i ramki z tcolorbox) automatycznie, ten sam system niezależnie od tego, czy gotowa książka trafia do wariantu Compact (30–45 stron za $9.99), czy do wariantu Complete (161–200 stron za $34.99) w [pełnym cenniku](/pl/#pricing). Nie ma szablonu do skonfigurowania ani ustawień eksportu, z którymi trzeba walczyć. Jeśli dotąd składałeś teksty ręcznie w Wordzie albo Canvie i zastanawiałeś się, czemu efekt nigdy nie wygląda jak prawdziwa książka, [zobacz, jak wygląda budowanie tej samej książki od tematu, a nie od gotowego maszynopisu](https://app.inkmagnet.com/auth/register), albo przeczytaj, [co narzędzie do samego składu, jak Atticus czy Vellum, wciąż zostawia do zrobienia samodzielnie](/pl/blog/inkmagnet-czy-atticus-vellum/), gdy tekst już istnieje.

Pełniejszy obraz tego, gdzie złożona i zaprojektowana książka mieści się w realnym budżecie produkcji, znajdziesz w [pełnym zestawieniu kosztów](/pl/blog/ile-kosztuje-stworzenie-ebooka/), które wycenia skład jako osobną pozycję, a [o tym, czemu książki pisane przez AI często wychodzą płytkie](/pl/blog/ksiazki-ai-czytaja-sie-jak-blog/) przeczytasz przy okazji researchu stojącego za tym samym procesem.
