---
title: "Jak wydać na Amazon KDP książkę napisaną i złożoną przez AI"
seoTitle: "Wydanie książki AI na Amazon KDP"
description: "Amazon poszerzył strefę 70% tantiem na KDP do 12,99 dolara. Matematyka ceny i techniczna poprzeczka EPUB, okładki i spisu treści dla książki napisanej przez AI."
lang: pl
pubDate: 2026-09-08
translationOf: self-publish-ai-book-on-amazon-kdp
heroImage: ../../assets/blog/jak-wydac-ksiazke-ai-na-amazon-kdp-hero.jpg
heroAlt: "Zamknięta książka o zupełnie pustej, nieopisanej okładce, leżąca na płaskiej kopercie z papieru pakowego bez znaczków i napisów, związanej sznurkiem, obok lupa jubilerska i drewniana linijka, jedna niewielka książka oprawiona w płótno indygo stojąca pionowo przy kopercie"
coverPrompt: "A single closed hardcover book with a completely blank, unmarked cover and spine, resting on a plain kraft paper mailing envelope with no stamps, labels or lettering, tied with string, a magnifying loupe and a wooden ruler beside it, one small deep indigo clothbound book standing upright next to the envelope, warm directional window light, shallow depth of field"
eyebrow: "PORADNIK"
---

Amazon poszerzył strefę 70% tantiem za ebooki na Kindle z 2,99-9,99 dolara do 2,99-12,99 dolara, obowiązuje to od 7 lipca 2026. Poza tym przedziałem stawka spada do 35%, a spadek jest dotkliwy: książka za 12,99 dolara zarabia około 9,09 dolara od sprzedaży przed opłatą transferową, ta sama książka za 14,99 dolara, teraz tuż nad nowym sufitem, zarabia już tylko około 5,25 dolara. Szersza strefa zmienia matematykę ceny. Nie zmienia niczego w tym, co faktycznie blokuje większość samodzielnie wydawanych książek przed czystym wejściem do sklepu: sam plik.

## Strefa 70% się poszerzyła, opłata za transfer nie

KDP wciąż potrąca opłatę transferową z każdej sprzedaży w stawce 70%: 0,15 dolara za megabajt w USA (0,10 funta w Wielkiej Brytanii, 0,12 euro w strefie euro), liczoną od pliku, który KDP dostarcza na urządzenie. Lekki, tekstowy EPUB w przedziale 2-4 MB kosztuje 0,30-0,60 dolara opłaty na sprzedaż, więc książka za 12,99 dolara zarabia w praktyce około 8,60 dolara po odliczeniu transferu, nie pełne 9,09. Książka pełna zdjęć przy 15-20 MB potrafi oddać 2-3 dolary od sprzedaży tej samej opłacie, co czyni nawyk "wyeksportuj wszystko jako PNG w wysokiej rozdzielczości" kosztownym przyzwyczajeniem. Do ceny dochodzi jeszcze jedno ograniczenie: jeśli sprzedajesz też wydanie papierowe, [KDP wymaga, by cena katalogowa ebooka była co najmniej 20% niższa od ceny katalogowej wydania drukowanego](https://kdp.amazon.com/en_US/help/topic/G200634560), więc przy planowaniu obu formatów cenę papierowej wersji ustala się najpierw.

## Techniczna poprzeczka, którą KDP faktycznie sprawdza

Żadna matematyka tantiem nie ma znaczenia, jeśli plik nie przejdzie recenzji. Recenzenci KDP nie oceniają treści, ale odrzucają plik, który nie spełnia struktury, a trzy kontrole łapią większość samodzielnie wgrywanych plików:

- **Zwalidowany EPUB3, nie skonwertowany PDF.** KDP przyjmuje EPUB, DOCX i KPF, ale to EPUB jest formatem zbudowanym pod sposób, w jaki Kindle faktycznie renderuje tekst, a plik przepuszczony przez [epubcheck](https://github.com/w3c/epubcheck) przed uploadem oszczędza rundę poprawek po recenzji. [Podział PDF kontra EPUB](/pl/blog/pdf-czy-epub/) nie jest tu kosmetyczny: KDP technicznie przyjmie PDF, ale efekt na telefonie czy czytniku Kindle trafia do jednogwiazdkowych recenzji, nie do odrzucenia przy uploadzie.
- **Dwa spisy treści, nie jeden.** KDP chce maszynowego pliku nawigacyjnego NCX i osobnej strony spisu treści widocznej dla czytelnika wewnątrz książki, a to naprawdę dwie różne rzeczy. Książka z samą nawigacją maszynową i tak nie przechodzi recenzji, książka z samą stroną w tekście traci funkcję "przeskocz do rozdziału", której czytelnik Kindle oczekuje.
- **Okładka zrobiona pod miniaturę, nie pod pełnostronicowy odbitek.** Techniczne minimum to 1000 px na dłuższym boku przy proporcji 1,6:1, przestrzeń sRGB, bez przezroczystości, ale wszystko poniżej 2560 × 1600 px dostaje w wyszukiwarce Kindle łatkę "niska jakość". Okładka zrobiona pod druk w 300 DPI przechodzi tę poprzeczkę bez osobnego eksportu.
- **Metadane wypełnione w każdym polu, jakie daje KDP.** Tytuł, podtytuł, opis napisany jako tekst sprzedażowy, a nie streszczenie, siedem miejsc na słowa kluczowe i do trzech kategorii. Nic z tego nie blokuje uploadu, jeśli zostawisz połowę pól pustą, co jest właśnie powodem, dla którego tyle wpisów siedzi na czwartej stronie kategorii z niewykorzystaną szansą.

## Gdzie "napisane przez AI" rozjeżdża się z "gotowe pod KDP"

KDP nie sprawdza za ciebie jakości formatowania. Opublikuje książkę z niespójnymi rozmiarami nagłówków, brakującym NCX-em albo akapitami, które trzymają się kupy tylko przy jednym rozmiarze czcionki, dopóki plik technicznie przechodzi walidację, a koszt tego wychodzi później w recenzjach, nie w mailu z odrzuceniem. Typowy scenariusz: rękopis napisany w oknie czatu, wklejony do szablonu w Wordzie, wyeksportowany do PDF-a i przepuszczony przez darmowy konwerter PDF na EPUB online. Plik się wgrywa, KDP go przyjmuje, a pierwsza recenzja tydzień później mówi, że nagłówki rozdziałów wyglądają jak losowe akapity, a spis treści nigdzie nie przenosi. To nie jest problem z samym tekstem.

Prawdziwa luka między rękopisem napisanym przez AI a takim, który jest gotowy pod sklep, leży pod warstwą treści: hierarchia nagłówków H1-H6, wpisy w spisie treści, podziały na rozdziały, na których opiera się czytnik, muszą powstać jako realna struktura już w momencie generowania książki, nie zostać doklejone konwerterem po fakcie. [Czteroetapowy proces, który zamienia temat w gotową książkę](/pl/blog/jak-ai-pisze-ksiazke/), buduje tę strukturę właśnie na etapie generowania z tego powodu, bo skonwertowany albo doklejony po fakcie EPUB to dokładnie ten typ pliku, który epubcheck łapie za każdym razem.

## Od rękopisu do wpisu w sklepie, który przechodzi recenzję

[InkMagnet](/pl/generator-ebookow/) pisze każdy rozdział na podstawie researchu, a potem przepuszcza go przez ten sam silnik składu dla obu plików wyjściowych: PDF gotowy do druku i EPUB do sklepu zbudowany z tego samego, ustrukturyzowanego źródła, nie skonwertowany z PDF-a po fakcie, z prawdziwymi poziomami nagłówków zasilającymi zarówno NCX, jak i stronę spisu treści w środku książki. Okładka powstaje pod druk w 300 DPI, co przechodzi rekomendację KDP 2560 × 1600 px bez osobnego eksportu. Książka w wariancie Extended, 76-115 stron, zakres, w który mieści się większość poradnikowych rękopisów bez sztucznego rozdmuchiwania, kosztuje 19,99 dolara jednorazowo, z pełnymi prawami komercyjnymi i bez znaku wodnego na żadnym z plików, więc to dokładnie te same pliki, które wgrywasz na KDP.

## Szeroko, czy w KDP Select

Nic z powyższego nie zmienia decyzji o wyłączności: zapis do KDP Select wstawia książkę do Kindle Unlimited na odnawialne okna 90-dniowe w zamian za rezygnację ze sprzedaży gdzie indziej, albo start szeroko na KDP, Apple Books i Kobo, z zachowaniem każdego kanału. [Pełne zestawienie obu ścieżek razem z checklistą tygodnia startu](/pl/blog/jak-wydac-ebooka-self-publishing/) opisuje tę decyzję dokładniej, niż powinien tekst skupiony wyłącznie na KDP. Techniczna poprzeczka z sekcji wyżej obowiązuje niezależnie od wyboru — to ona decyduje, czy pytania o cenę i wyłączność w ogóle dostaną szansę mieć znaczenie.

Porównaj jednorazowy koszt złożonej książki w dwóch formatach ze stawką freelancera za skład w [cenniku InkMagnet](/pl/#pricing), albo [zacznij od własnego tematu rękopisu](https://app.inkmagnet.com/auth/register) i zobacz strukturę rozdziałów gotową do zatwierdzenia w kilka minut.
