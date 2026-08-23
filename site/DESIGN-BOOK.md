# InkMagnet — Księga designu (serwis + grafiki)

Jedno źródło prawdy dla wyglądu inkmagnet.com i wszystkich generowanych grafik
(blog, OG, ilustracje stron). Każda nowa grafika MUSI powstać według sekcji 4–6.

## 1. Esencja marki

InkMagnet zamienia wiedzę w prawdziwe, złożone typograficznie książki.
Świat wizualny marki to **atrament i papier**: warsztat wydawcy, nie ekran
startupu. Fizyczność druku (papier, fakury, światło na stronach) + jeden
cyfrowy akcent: głęboki indygo.

Słowa-klucze stylu: redakcyjny, rzemieślniczy, spokojny, precyzyjny, ciepły.
Anty-słowa: korporacyjny stock, neonowe gradienty, ludzie ściskający dłonie,
roboty/mózgi/żarówki jako metafory AI.

## 2. Kolory (web)

| Rola | Token | Hex |
|---|---|---|
| Brand / akcent | brand-600 | #4f46e5 |
| Brand ciemny | brand-700/800 | #4338ca / #3730a3 |
| Tekst | ink-900 | #0f172a |
| Tekst wtórny | ink-600 | #475569 |
| Tła sekcji | ink-50 / white | #f8fafc / #ffffff |
| Sekcje ciemne | ink-950 | #020617 |

W FOTOGRAFII indygo pojawia się jako fizyczny przedmiot (okładka książki,
atrament, wstążka-zakładka, płótno introligatorskie) — nigdy jako filtr
nałożony na całość.

## 3. Typografia (web)

Inter Variable (self-hosted), nagłówki extrabold z ciasnym trackingiem,
body 1.0625rem/1.75. Bez drugiego kroju na stronie.

## 4. Fotografia edytorialna — styl bazowy grafik

Wszystkie grafiki blogowe i ilustracyjne to **edytorialne martwe natury
świata druku**: papier, książki, maszyny do pisania, kaszty, atrament,
biurka twórców. Zawsze fotografia (nie flat illustration), zawsze przedmioty
— bez twarzy ludzi (dłonie przy pracy są OK).

**Stały sufiks promptu (obowiązkowy, EN):**

```
editorial still life photography, soft directional window light, shallow
depth of field, muted warm paper tones with a single deep indigo accent,
matte textures, clean balanced composition, generous negative space,
no text, no words, no letters, no labels, no watermark
```

**Twarde zakazy w promptach:** czytelny tekst/litery w kadrze (FLUX renderuje
bełkot), ekrany z interfejsem, twarze, uściski dłoni, żarówki, mózgi, roboty,
rakiety, kolaże ikon.

**Akcent indygo:** każdy kadr zawiera dokładnie JEDEN przedmiot w kolorze
deep indigo (#4f46e5↔#3730a3) — wymieniony wprost w prompcie
(np. "a deep indigo clothbound book", "a bottle of deep indigo ink").

## 5. Formaty

| Typ | Aspect | Zastosowanie |
|---|---|---|
| Hero bloga | 3:2 | góra artykułu + og:image artykułu |
| OG ogólne | 1200×630 (generowane 3:2, kadr CSS) | fallback social |
| Ilustracja inline | 3:2 | sekcje długich stron |

Model: black-forest-labs/flux-1.1-pro-ultra, **raw=true** (fotograficzny
realizm; decyzja 2026-08-23), output jpg, safety_tolerance 2. Każde zdjęcie
przechodzi automatyczną recenzję Sonneta (wizja) PRZED użyciem — kryteria
akceptacji i wszystkie parametry w `backend/shared/cover-style.json`
(JEDNO źródło prawdy dla CI i backendu; zmiany stylu robić TAM, nie w kodzie).

## 6. Szablon promptu

```
[SCENA: konkretne przedmioty + układ, w tym jeden przedmiot deep indigo],
[sufiks z sekcji 4]
```

Scena musi wynikać z TEMATU artykułu (nie ogólny stock "książki na stole"):
artykuł o statystykach → przedmioty sugerujące pomiar/porządek; o pisaniu →
warsztat pisarski; o formatach → czytnik obok druku. Rekwizyty wymieniaj
konkretnie (gatunek papieru, rodzaj światła, materiał).

## 7. Proces

1. Prompt wg sekcji 6 → FLUX 1.1 Pro Ultra (klucz: FLUX_API w d:/data/.app).
2. Zapis do site/src/assets/blog/ jako {slug}-hero.jpg (przez astro:assets).
3. Hero w artykule przez frontmatter `heroImage`, alt opisowy obowiązkowy.
4. Nowe typy grafik → najpierw dopisać zasadę tutaj, potem generować.
