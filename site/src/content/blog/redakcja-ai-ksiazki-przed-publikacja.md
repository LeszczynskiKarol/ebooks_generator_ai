---
title: "Co znaczy \"recenzja, potem poprawki\": redakcja AI, zanim książka trafi do Ciebie"
seoTitle: "Redakcja AI, zanim książka trafi do Ciebie"
description: "InkMagnet uruchamia fazę Recenzja i poprawki na każdym rozdziale przed składem PDF. Co dokładnie sprawdza i dlaczego druga runda bije generowanie za jednym razem."
lang: pl
pubDate: 2026-09-23
translationOf: ai-book-editing-pass-before-it-ships
heroImage: ../../assets/blog/redakcja-ai-ksiazki-przed-publikacja-hero.jpg
heroAlt: "Krótki stos czystych, niezapisanych kartek manuskryptu przygniecionych mosiężnym przyciskiem do papieru na drewnianym biurku, obok zamknięty antyczny ołówek i małe nożyczki, szpulka czerwonej nici przy kościaku introligatorskim, jedna wstążka w kolorze głębokiego indygo przewleczona przez róg stosu"
coverPrompt: "A short stack of blank, completely unmarked manuscript paper held flat by a brass paperweight on a wood editor's desk, a closed antique wooden pencil and a small pair of scissors resting beside the stack, a coiled spool of red thread next to a bone folder, one deep indigo cloth ribbon bookmark trailing across the corner of the paper, warm directional window light, soft dark background, shallow depth of field"
eyebrow: "PORADNIK"
---

Poproś okno czatu o napisanie rozdziału, a dostaniesz dokładnie jedno: pierwszą wersję, dostarczoną za jednym razem, nieskonfrontowaną przez nikogo z sześcioma rozdziałami obok. To nie zarzut wobec modelu. Tak po prostu wygląda "wygeneruj", kiedy nic nie dzieje się potem. Potok InkMagnet ma na to nazwany etap: Recenzja i poprawki, między Generowaniem treści a Składaniem PDF na ekranie postępu, który obserwujesz podczas budowy książki. Nie stoi tam dla pozoru.

## Pierwsza wersja to jeszcze nie gotowy rozdział

[Napisanie całej książki w zwykłym oknie czatu](/pl/blog/czy-chatgpt-napisze-mi-ksiazke/) daje tekst, który zdanie po zdaniu brzmi w porządku, a rozpada się na poziomie rozdziału: case study obiecane w planie nigdy się nie pojawia, zamknięcie rozdziału powtarza otwarcie niemal słowo w słowo, rozdział szósty po cichu redefiniuje pojęcie, które rozdział drugi już zdefiniował inaczej. Żadna z tych rzeczy nie jest halucynacją w typowym sensie. Tak wygląda generowanie za jednym razem, kiedy nic nie sprawdza rozdziału względem planu, który miał realizować.

## Dwie różne recenzje w jednym potoku

InkMagnet uruchamia w praktyce dwie osobne kontrole, a mylenie ich prowadzi do złego wyobrażenia o tym, co właściwie sprawdza AI. Pierwsza dzieje się na etapie "Plan", zanim powstanie choć jeden rozdział: sam zatwierdzasz lub poprawiasz strukturę rozdziałów, tę samą bramkę, którą [czterokrokowy potok InkMagnet](/pl/blog/jak-ai-pisze-ksiazke/) opisuje jako łapanie problemów strukturalnych, dopóki są tanie do naprawienia. Na tym etapie oceniasz kilkuzdaniowe streszczenie każdego rozdziału, nie gotowy tekst, więc decyzja zapada w kilka minut od podania tematu. Druga kontrola dzieje się później, na etapie "Recenzja i poprawki" ekranu generowania, kiedy każdy rozdział ma już pełną pierwszą wersję. Tej drugiej nie zatwierdzasz ani nie pomijasz. Działa automatycznie, rozdział po rozdziale, na treści, która już istnieje, co czyni ją zadaniem znacznie bardziej mechanicznym niż ocena pięciozdaniowego streszczenia planu. Tu nie chodzi już o to, czy kierunek całej książki ma sens, tylko o to, czy konkretny akapit dowozi to, co obiecał.

## Co dokładnie sprawdza faza Recenzja i poprawki

W tej drugiej rundzie edytor AI czyta każdy rozdział względem zatwierdzonego planu i sąsiadujących rozdziałów, sprawdzając te same trzy rzeczy, na których opiera się checklista profesjonalnego redaktora prowadzącego: luki, gdzie plan obiecywał treść, której draft nie dowiózł, powtórzenia, które odtwarzają punkt już poruszony w tym samym rozdziale, oraz terminologię, która odjechała od tego, jak zdefiniował ją wcześniejszy rozdział. Uzupełnia brakujące i przycina powtórzenia, zanim rozdział w ogóle trafi do składania PDF, i robi to na każdym rozdziale każdej książki, nie tylko tam, gdzie tekst wygląda na słaby.

## Dlaczego druga runda bije jeden strzał — dowody z badań

To nie jest marketingowa intuicja o tym, że AI potrzebuje "ludzkiego dotyku". Praca z NeurIPS 2023 pod nazwą [Self-Refine](https://arxiv.org/abs/2303.17651), autorstwa Amana Madaana i współautorów, testowała dokładnie ten mechanizm: ten sam model generuje wynik, potem generuje informację zwrotną na temat własnego wyniku, potem poprawia się na jej podstawie, iteracyjnie, bez dodatkowego treningu ani drugiego modelu. W siedmiu zadaniach i na GPT-3.5, ChatGPT oraz GPT-4 wyniki po takiej pętli informacja-zwrotna-potem-poprawka były preferowane zarówno przez ludzkich oceniających, jak i metryki automatyczne, średnio o około 20 punktów procentowych częściej niż generowanie za jednym razem. Druga runda, która sprawdza pierwszą względem jawnych kryteriów, mierzalnie bije wysłanie pierwszej wersji bez sprawdzenia — z tego samego powodu istnieje redakcja merytoryczna w tradycyjnym wydawnictwie i z tego samego powodu faza Recenzja i poprawki działa na pojedynczym rozdziale, a nie na całym manuskrypcie naraz.

## Ile kosztuje ta sama kontrola zrobiona przez człowieka

Ta sama kontrola pokrycia i powtórzeń zrobiona ręcznie to redakcja merytoryczna, którą przeglądy stawek rynkowych z 2026 wyceniają na około 0,03–0,045 dolara za słowo w literaturze niebeletrystycznej, do tego osobno dochodzi jeszcze redakcja językowa i korekta. Dla 60-tysięcznego manuskryptu wychodzi z tego kilka tysięcy dolarów, fakturowane osobno od samego pisania. To też pierwsza pozycja, z której rezygnują autorzy self-publishingu przy ograniczonym budżecie: ankiety wśród niezależnych autorów regularnie pokazują, że nowsi, mniej zarabiający twórcy domyślnie wybierają brak redakcji albo betareadera, właśnie dlatego, że pełna redakcja merytoryczna jest wyceniana jak usługa specjalistyczna, a nie formalność do odhaczenia. W InkMagnet ta sama kontrola pokrycia działa na każdej książce w każdym wariancie długości, wliczona w tę samą jedną opłatę, którą zapłaciłeś za research i pisanie: od 9,99 dolara za 30–45-stronicową książkę Compact po 34,99 dolara za 161–200-stronicową Complete, [bez osobnej pozycji na fakturze](/pl/#pricing) za samą redakcję.

## Luka i powtórzenie, złapane zanim je zobaczysz

Wyobraź sobie rozdział, którego plan obiecywał porównanie cen konkurencji jako drugą sekcję. Pierwsza wersja zaczyna się mocno, w zamknięciu niemal dosłownie powtarza tezę z otwarcia i nigdy nie dociera do zapowiedzianego porównania. Faza Recenzja i poprawki łapie oba problemy w tej samej rundzie: brakująca sekcja zostaje dopisana zgodnie z pierwotnym briefem, a powtórzone zamknięcie przycięte do czegoś, co dokłada nową myśl zamiast powtarzać starą. Wersji z luką nigdy nie widzisz, bo nigdy nie trafia do składania PDF. To, co ląduje w [edytorze WYSIWYG](/pl/blog/edycja-ksiazki-ai-bez-utraty-zmian/) po ukończeniu książki, to wersja, która już przeszła tę kontrolę. Dlatego też edycja gotowej książki później działa tak, jak działa: regeneracja ograniczona do jednego rozdziału musi obsłużyć tylko to, co Ty sam chcesz zmienić, bo problem pokrycia i powtórzeń automatyczna faza rozwiązała, zanim Twoja własna lektura w ogóle się zaczęła.

Nic z tego nie zastępuje Twojej własnej lektury. Oznacza tylko, że tekst, który czytasz pierwszy raz, przeszedł już tę samą poprzeczkę, jaką postawiłby przed nim redaktor prowadzący, zanim poświęciłeś na to choć minutę. Ten sam mechanizm działa identycznie niezależnie od tego, czy piszesz 30-stronicowy lead magnet, czy 200-stronicową Complete: liczba rozdziałów rośnie, ale każdy z nich przechodzi dokładnie tę samą kontrolę pokrycia i powtórzeń, zanim trafi do składu. [Zacznij od własnego tematu](https://app.inkmagnet.com/auth/register) i zobacz fazę Recenzja i poprawki w akcji już przy pierwszej wygenerowanej książce.
