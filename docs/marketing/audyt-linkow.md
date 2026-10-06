# Audyt linków do InkMagnet w sieci domen (2026-10-06)

Zakres: 30 domen, crawl tylko do odczytu (robots.txt → sitemapy → strony; UA przeglądarki, timeout 20 s, ≥0,5 s między żądaniami w obrębie domeny). Łącznie pobrano ok. 3 900 stron (limit 300 URL na domenę, priorytet: strona główna, blog, strony o ebookach, copywritingu, składzie). Surowy HTML przeszukano pod kątem „inkmagnet” (bez rozróżniania wielkości liter).

## Podsumowanie

Do InkMagnet linkuje już **5 domen**. Trzy z nich to linki kontekstowe w treści stron usługowych o ebookach i składzie: agencja-copywriterska.pl, ecopywriting.pl, sklad-tekstu.pl. Dwie to portfolio: torweb.pl (realizacje) i karol-leszczynski.pl (studium przypadku plus **link w stopce na każdej z 54 stron**). Wszystkie te linki są dofollow. Jedyne ryzyko wymagające działania to sitewide link w stopce karol-leszczynski.pl. Drugie co do wagi to anchor „automatyczny generator ebooków” na ecopywriting.pl, który jest bliski exact-match. Tematycznie naprawdę pasuje tylko kilka domen copywritingowo-wydawniczych, a połowa z nich już linkuje. Bezpiecznych nowych miejsc jest więc niewiele: proponuję 5 wzmianek, w tym 2 z nofollow. Domeny copywriting-blog.pl i copywritingseo.pl nie istnieją w DNS (NXDOMAIN).

## Istniejące linki do InkMagnet

| Strona źródłowa | Cel | Anchor | rel | Umiejscowienie | Ocena |
|---|---|---|---|---|---|
| https://www.agencja-copywriterska.pl/uslugi/tworzenie-ebookow/ | https://inkmagnet.com/pl/ | „InkMagnet” | brak (follow) | w treści (article): „Do tego używamy własnego narzędzia: InkMagnet generuje z tematu kompletną książkę…” | OK. Anchor brandowy, kontekst naturalny. W HTML są 2 trafienia; sprawdzić, czy to nie podwójny link (np. wersja mobilna/desktop) |
| https://www.ecopywriting.pl/uslugi/ebooki/ | https://inkmagnet.com/pl/generator-ebookow/ | „automatyczny generator ebooków” | brak (follow) | w treści: „…sensowniejszym startem bywa automatyczny generator ebooków…” | **Do poprawy.** Opisowy anchor prowadzi na stronę zoptymalizowaną pod „generator ebooków”, więc to prawie exact-match. Zmienić na „InkMagnet” albo „generator InkMagnet” |
| https://www.sklad-tekstu.pl/uslugi/ksiazki/ | https://inkmagnet.com/pl/przyklady/ | „nasz generator książek InkMagnet” | brak (follow) | w treści: „…służy do tego nasz generator książek InkMagnet, który buduje strukturę…” | OK. Anchor mieszany z marką, ujawnia powiązanie („nasz”) |
| https://www.torweb.pl/ | https://inkmagnet.com | „inkmagnet.com” | noopener noreferrer (follow) | sekcja realizacji na stronie głównej (main) | OK. Portfolio twórcy, anchor = domena |
| https://www.torweb.pl/realizacje/ | https://inkmagnet.com | „inkmagnet.com” | noopener noreferrer (follow) | lista realizacji | OK |
| **Wszystkie 54 strony** karol-leszczynski.pl (PL i EN) | https://inkmagnet.com | „InkMagnet” | noopener (follow) | **stopka (`<footer>` → `<nav>`), sitewide**, po 2 wystąpienia na stronę | **Ryzyko: link sitewide.** Patrz „Ryzyka” |
| https://www.karol-leszczynski.pl/ oraz /en/ | https://inkmagnet.com | karta aplikacji („InkMagnet Aplikacja wydawnicza w Google Play…”) | noopener | treść strony głównej | OK, portfolio |
| /projekty/inkmagnet/, /en/projects/inkmagnet/ | https://inkmagnet.com, https://inkmagnet.com/pl | „Zobacz na żywo”, „Otwórz InkMagnet”, „Otwórz inkmagnet.com” | noopener | treść studium przypadku | OK, naturalne |
| /projekty/, /en/projects/, /uslugi/aplikacje-mobilne/, /en/services/mobile-apps/ | /projekty/inkmagnet (link wewnętrzny) | „InkMagnet.com”, „Dowiedz się więcej” | – | treść | Linki wewnętrzne, bez znaczenia dla profilu linków |

Na pozostałych 25 domenach nie znaleziono żadnego wystąpienia „inkmagnet”. Dla copywriting24.pl (SPA) sprawdzono też bundle JS i tam również go nie ma.

## Domeny: pasujące vs NIE LINKOWAĆ

| Domena | Status | Kategoria | Uzasadnienie |
|---|---|---|---|
| www.agencja-copywriterska.pl | 200, 51 stron | **(a) pasuje, już linkuje** | Usługa tworzenia ebooków; link już jest, więcej nie dodawać |
| www.ecopywriting.pl | 200, 78 stron | **(a) pasuje, już linkuje** | Ebooki i content marketing; poprawić anchor istniejącego linku |
| www.sklad-tekstu.pl | 200, 47 stron | **(a) pasuje, już linkuje** | Skład książek i ebooków, self-publishing; tematycznie najlepsza domena w sieci |
| www.icopywriter.pl | 200, 36 stron (brak robots.txt, 404) | **(a) pasuje** | Rozbudowana strona usługi „Ebooki: copywriting + skład” |
| www.1copywriting.pl | 200, 81 stron | (a) pasuje słabo | Blog o copywritingu; ebooki pojawiają się tylko jako jeden z formatów |
| www.ebookcopywriting.pl | 200, 4 strony | (a) pasuje słabo | Landing sprzedażowy ebooka „Copywriting 360°”; bardzo mała strona |
| www.karol-leszczynski.pl | 200, 54 strony | (a) portfolio, już linkuje | Strona autora, studium przypadku jest w porządku; do zmiany tylko stopka |
| www.zostancopywriterem.pl | 200, 28 stron | (a) temat pokrewny, **nie teraz** | Kariera copywritera; jedyne miejsce o ebooku to rada „opublikuj własny e-book, żeby pokazać warsztat”, a polecanie tam generatora AI podważałoby treść |
| www.interpunkcja.com.pl | 200, 105 stron | (a) pokrewna, **nie teraz** | Interpunkcja i korektor AI; brak stron o pisaniu książek |
| www.copywriting24.pl | 200, SPA (ok. 10 słów w HTML, brak sitemapy) | (a) pokrewna, **nie teraz** | Generator tekstów AI renderowany w JS; link miałby znikomą wartość i nakłada się produktowo |
| matury-online.pl | 200, 1092 URL w sitemapie (sprawdzono 300) | **NIE LINKOWAĆ** | Edukacja maturalna, odbiorca to uczeń; brak związku z tworzeniem ebooków |
| www.maturapolski.pl | 200, 591 URL (sprawdzono 300) | **NIE LINKOWAĆ** | Jak wyżej: matura z polskiego |
| www.licencjackie.pl | 200, 166 stron | **NIE LINKOWAĆ** | Prace dyplomowe; generator książek AI obok poradników o pracach naraża na skojarzenie z ghostwritingiem akademickim |
| www.praca-magisterska.pl | 200, 225 stron | **NIE LINKOWAĆ** | Jak wyżej (nawet strona o LaTeX-u jest skierowana do studentów) |
| www.magisterkaonline.com.pl | 200, 28 stron | **NIE LINKOWAĆ** | Jak wyżej |
| www.prace-magisterskie.pl | 200, 19 stron | **NIE LINKOWAĆ** | „Pisanie prac magisterskich z AI na zamówienie”, czyli wysokie ryzyko reputacyjne |
| www.smart-edu.ai | 200, 267 stron | **NIE LINKOWAĆ** | AI do prac dyplomowych; to samo ryzyko reputacyjne, inna grupa docelowa |
| www.smart-copy.ai | 200, 102 strony | **NIE LINKOWAĆ** | Własny SaaS z funkcją zamawiania ebooków 50+ stron, czyli kanibalizacja; wzajemne linkowanie własnych SaaS-ów wygląda na sieć |
| www.torweb.pl | 200, 47 stron | **NIE LINKOWAĆ (poza istniejącym)** | Agencja web (Toruń); link w portfolio realizacji wystarczy, w blogu nie ma pasujących treści |
| meble-bydgoszcz.pl | 200, 36 stron | **NIE LINKOWAĆ** | Meble, biznes lokalny |
| meblesystem.pl | 200, 111 stron | **NIE LINKOWAĆ** | Meble |
| mekra.pl | 200, 24 strony | **NIE LINKOWAĆ** | Meble/zabudowy, klient |
| www.artkuchnie.pl | 200, 11 stron | **NIE LINKOWAĆ** | Kuchnie na wymiar |
| www.by-interior.pl | 200, 8 stron | **NIE LINKOWAĆ** | Projektowanie wnętrz |
| www.project-design.pl | 200, 7 stron | **NIE LINKOWAĆ** | Projektowanie wnętrz |
| www.silnik-elektryczny.pl | 200, 142 strony | **NIE LINKOWAĆ** | Silniki elektryczne |
| www.silniki-elektryczne.com.pl | 200, 1045 URL (sprawdzono 300) | **NIE LINKOWAĆ** | Sklep Stojan, silniki |
| www.silniki-trojfazowe.pl | 200, 245 stron | **NIE LINKOWAĆ** | Silniki trójfazowe |
| www.copywriting-blog.pl | **NXDOMAIN** (Google DNS i Cloudflare DNS) | nieosiągalna | Domena nie rozwiązuje się; wygasła albo nie ma rekordów DNS |
| www.copywritingseo.pl | **NXDOMAIN** | nieosiągalna | Jak wyżej |

Strony bez sensownej treści: copywriting24.pl (SPA, w HTML brak treści i sitemapy). Bardzo małe: ebookcopywriting.pl (4 strony), by-interior.pl (8), project-design.pl (7), artkuchnie.pl (11).

## Propozycje bezpiecznych wzmianek

Zasada: z danej domeny **pierwszy** link może być follow, a kolejne z tej samej domeny są nofollow. Anchor ma być brandowy. Bez stopek, sidebarów i boksów. Wzmianki wprowadzać stopniowo (np. jedną na 2–3 tygodnie), każdą innym zdaniem, bez kopiowania formułki „rozpisany na rozdziały, zanim…”, która już powtarza się na 3 domenach.

| # | Strona (istnieje, 200) | Miejsce / kontekst | Sugerowany anchor i cel | rel |
|---|---|---|---|---|
| 1 | https://www.icopywriter.pl/uslugi/ebooki/ | FAQ / sekcja „Ile kosztuje stworzenie ebooka?” (lead magnet 3000–8000 zł). Jedno zdanie dla osób z małym budżetem: gdy wystarczy szybki szkic albo lead magnet bez pełnej obsługi, można zacząć od własnego narzędzia autora | „InkMagnet” → https://inkmagnet.com/pl/ | follow (pierwszy link z domeny) |
| 2 | https://www.sklad-tekstu.pl/blog/self-publishing-jak-samodzielnie-wydac-ksiazke-i-co-zlecic/ | Sekcja „Od czego zacząć” albo „Co zrobisz sam, a co lepiej zlecić”: wzmianka, że gdy autor ma dopiero temat, a nie maszynopis, roboczą strukturę i pierwszy szkic może przygotować w InkMagnet, a potem przekazać tekst do redakcji i składu | „InkMagnet” lub „generator książek InkMagnet” → https://inkmagnet.com/pl/ | nofollow (domena już ma link follow z /uslugi/ksiazki/) |
| 3 | https://www.ecopywriting.pl/blog/ebook-jako-narzedzie-content-marketingowe/ | Akapit „Pisanie ebooków to duże przedsięwzięcie, którego nie da się wykonać w ciągu kilku godzin…”: dopisek, że dziś pierwszą wersję poradnika można złożyć szybciej (np. w InkMagnet), ale nadal wymaga redakcji eksperckiej. Artykuł jest stary (przykłady z 2015/2016), więc dobry moment na jego odświeżenie | „InkMagnet” → https://inkmagnet.com/pl/ | nofollow (domena już ma follow z /uslugi/ebooki/) |
| 4 | https://www.1copywriting.pl/blog/copywriting-a-content-writing/ | Akapit „Content writing faworyzuje dłuższe formy… E-booki: kilkadziesiąt stron”: jedno zdanie, że przy ebookach pierwszą wersję struktury i treści można dziś wygenerować narzędziem (np. InkMagnet), a pracą copywritera pozostaje redakcja. **Niski priorytet**, bo kontekst jest dość ogólny | „InkMagnet” → https://inkmagnet.com/pl/ | follow (pierwszy z domeny) albo nofollow, jeśli chcesz ograniczyć liczbę linków follow z sieci |
| 5 | https://www.ebookcopywriting.pl/ | Sekcja „O autorze”: „…dostarczam gotowe produkty: ebooki ze składem typograficznym…”. Dopisać, że autor rozwija też InkMagnet (bio, nie reklama) | „InkMagnet” → https://inkmagnet.com/pl/ | nofollow (mała strona sprzedażowa, wartość SEO znikoma, liczy się ewentualny ruch) |

Świadomie **nie** proponuję więcej: agencja-copywriterska.pl i torweb.pl mają już swoje linki, a reszta domen jest albo niepowiązana, albo ryzykowna reputacyjnie (prace dyplomowe, matura).

## Ryzyka

1. **Link sitewide w stopce karol-leszczynski.pl.** 54/54 stron, follow, po 2 wystąpienia na stronę. To dokładnie ten wzorzec, który Google traktuje jako schemat linków. Anchor jest brandowy, a strona to portfolio właściciela, więc ryzyko jest umiarkowane, ale dla bezpieczeństwa: **usunąć InkMagnet ze stopki** (zostaje link ze studium przypadku /projekty/inkmagnet/ i ze strony głównej) **albo dodać `rel="nofollow"` w stopce**. Sprawdzić też, dlaczego link występuje w stopce dwa razy.
2. **Anchor bliski exact-match na ecopywriting.pl.** „automatyczny generator ebooków” → /pl/generator-ebookow/. Zmienić na „InkMagnet” lub „generator InkMagnet”.
3. **Ślad sieci (footprint).** Trzy linki kontekstowe (agencja-copywriterska, ecopywriting, sklad-tekstu) stoją na stronach usługowych o tym samym schemacie i mają podobną narrację („zanim zdecydujesz/zamówisz, zobacz, jak temat rozkłada się na rozdziały”). Wszystkie są follow, a domeny mają wspólnego właściciela. Nowe wzmianki pisać każdorazowo innymi słowami. Rozważyć nofollow dla części linków, jeśli domeny są powiązane widocznie (ten sam autor, te same dane kontaktowe, wzajemne linki).
4. **Zbyt wiele linków follow z własnej sieci.** Po wdrożeniu propozycji byłoby 6–7 domen z linkiem follow, wszystkie należące do jednej osoby. Wartość takiego profilu jest ograniczona; ważniejsze są linki zewnętrzne. Nie przekraczać tej liczby.
5. **Strony docelowe.** Działają (200): https://inkmagnet.com, /pl, /pl/, /pl/generator-ebookow/, /pl/przyklady/. Uwaga: zarówno `/pl`, jak i `/pl/` zwracają 200 bez przekierowania. Warto upewnić się, że canonical wskazuje jedną wersję, i linkować konsekwentnie do `https://inkmagnet.com/pl/`.
6. **Domeny nieosiągalne.** copywriting-blog.pl i copywritingseo.pl to NXDOMAIN. Jeśli są Twoje i mają historię, sprawdź, czy nie wygasły; nie kupować ich z powrotem tylko po to, żeby linkować.
7. **Ograniczenia audytu.** Dla matury-online.pl, maturapolski.pl i silniki-elektryczne.com.pl sprawdzono 300 z kilkuset do ponad tysiąca URL. Stopki i nawigacja są w tym pokryte (strona główna była w próbce), więc linki sitewide by się znalazły, pojedyncze wzmianki w głębi serwisu już niekoniecznie. Treść dociągana wyłącznie przez JS nie była renderowana (wyjątek: copywriting24.pl, gdzie sprawdzono bundle). Nie badano linków zewnętrznych spoza tej listy (np. Ahrefs/GSC „Linki”).
