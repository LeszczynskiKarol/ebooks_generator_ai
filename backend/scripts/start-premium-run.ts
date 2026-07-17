// Kick a full production-like autopilot run with the new "premium" preset.
// Creates a PAID project and enqueues structure → (auto) content → compile.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { enqueueGeneration } from "../src/lib/jobQueue";

(async () => {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("no user in DB");

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      topic:
        "Jak napisać pracę licencjacką z pielęgniarstwa — kompletny praktyczny przewodnik dla studentek i studentów pielęgniarstwa: od wyboru tematu i studium indywidualnego przypadku, przez proces pielęgnowania, skale i kwestionariusze, etykę badań z udziałem pacjentów, po redakcję pracy w stylu Vancouver i obronę",
      title: "Jak napisać pracę licencjacką z pielęgniarstwa",
      subtitle: "Od studium przypadku do obrony — praktyczny przewodnik",
      authorName: "Zespół Smart-Edu.ai",
      language: "pl",
      targetPages: 60,
      stylePreset: "premium",
      bookFormat: "a5",
      customColors: JSON.stringify(["#165D50"]),
      guidelines: [
        "Książka ściśle o PRACY LICENCJACKIEJ z pielęgniarstwa w polskich realiach — zero ogólników o pracach dyplomowych w ogóle.",
        "Rdzeń licencjatu pielęgniarskiego to STUDIUM INDYWIDUALNEGO PRZYPADKU: wywiad pielęgniarski, ocena stanu pacjenta uznanymi skalami, diagnozy pielęgniarskie, plan opieki, realizacja, ewaluacja, wskazówki do samoopieki. Poświęć temu 2-3 rozdziały.",
        "Omów alternatywne formy licencjatu: sondaż wśród pacjentów/personelu i pracę przeglądową.",
        "Skale i narzędzia: skala Barthel (ADL, 0-100), skala VAS/NRS bólu, podstawy kwestionariuszy standaryzowanych; wyjaśnij zasadę: narzędzie z autorem i adaptacją zamiast ankiety własnej.",
        "Etyka: zgoda pacjenta (dobrowolność bez wpływu na opiekę!), zgoda placówki, anonimizacja danych, granica dokumentacji medycznej.",
        "Redakcja: styl Vancouver (cytowania numeryczne [1], piśmiennictwo wg kolejności cytowań), streszczenie strukturalne PL/EN, tabele w konwencji medycznej (n i %).",
        "Struktura pracy licencjackiej: część teoretyczna o jednostce chorobowej pisana z wytycznych i artykułów (nie z 2 podręczników), część kazuistyczna/badawcza, wnioski punktowane.",
        "Finał: antyplagiat (JSA), harmonogram ostatniego miesiąca, obrona z kanonem pytań komisji.",
        "Ton: praktyczny, konkretny, ciepły ale rzeczowy; per 'Ty' do czytelniczki/czytelnika.",
        "Typografia polska: cudzysłowy „...”, myślniki —.",
        "Aparat wizualny: intensywnie używaj ramek (tipbox, keyinsight, warningbox, examplebox po polsku), checklistbox na końcu KAŻDEGO rozdziału, tabele porównawcze, \\stepflow dla procesów.",
      ].join("\n"),
      paymentStatus: "PAID",
      paidAt: new Date(),
      autoPilot: true,
      useAiImages: false,
      currentStage: "STRUCTURE",
    },
  });
  console.log("PROJECT:", project.id, "|", project.title);
  const r = await enqueueGeneration("structure", project.id);
  console.log("ENQUEUED:", JSON.stringify(r));
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 1200);
})();
