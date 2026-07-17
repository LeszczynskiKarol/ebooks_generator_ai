// Standalone visual preview of the "premium" style preset.
// Renders a 2-chapter sample (all box types, stepflow, table, pullquote,
// bignumber, checklist) without touching the DB or S3.
// Usage:  npx tsx scripts/premium-preview.ts [stylePreset] [#hexPrimary]
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { assembleLatexDocument } from "../src/services/bookCompiler";

const preset = process.argv[2] || "premium";
const custom = process.argv[3] ? [process.argv[3]] : undefined;

const ch1 = String.raw`\chapter{Anatomia dobrze złożonego rozdziału}

Dobrze zaprojektowany rozdział prowadzi czytelnika od problemu do rozwiązania --- bez zbędnych dygresji i bez ściany tekstu. Ten przykładowy rozdział istnieje po to, żeby pokazać wszystkie elementy wizualne presetu w realnym układzie: ramki, tabelę, diagram procesu i checklistę.

\section{Element pierwszy: ramki z zakładkami}

Każdy typ ramki pełni inną funkcję redakcyjną, a czytelnik rozpoznaje je po kolorze i ikonie, zanim przeczyta pierwsze słowo.

\begin{tipbox}[Zacznij od szkieletu]
Zanim napiszesz pierwszy akapit, rozpisz strukturę rozdziału w pięciu punktach. Szkielet pilnuje proporcji i nie pozwala rozdziałowi rozjechać się w dygresje. Ten nawyk oszczędza więcej czasu niż jakiekolwiek narzędzie.
\end{tipbox}

\begin{keyinsight}[Jedna myśl na sekcję]
Sekcja, która broni dwóch tez naraz, nie broni żadnej. Najważniejsza informacja z tej sekcji powinna dać się wypowiedzieć jednym zdaniem --- właśnie takim jak to.
\end{keyinsight}

\begin{warningbox}[Pułapka: wszystko naraz]
Najczęstszy błąd początkujących autorów to upychanie trzech ramek na stronę. Efekt jest odwrotny od zamierzonego: gdy wyróżnione jest wszystko, wyróżnione jest nic. Stosuj najwyżej jedną ramkę na sekcję.
\end{warningbox}

\begin{examplebox}[Case study: podręcznik, który czyta się sam]
Autorka poradnika finansowego przeniosła wszystkie definicje do ramek, a przykłady liczbowe do tabel. Czas czytania rozdziału spadł z 22 do 14 minut przy identycznej zawartości merytorycznej, a oceny czytelników wzrosły o~jedną trzecią.
\end{examplebox}

\section{Element drugi: dane w tabeli}

\begin{table}[!htbp]
\centering
\caption{Porównanie elementów wizualnych i ich funkcji}
\begin{tabularx}{\textwidth}{lXr}
\toprule
\rowcolor{tableheadbg} \textcolor{tableheadfg}{\textbf{Element}} & \textcolor{tableheadfg}{\textbf{Funkcja}} & \textcolor{tableheadfg}{\textbf{Na rozdział}} \\
\midrule
tipbox & praktyczna wskazówka do wdrożenia & 1--2 \\
keyinsight & kluczowa myśl sekcji & 1--3 \\
warningbox & ostrzeżenie przed błędem & 1--2 \\
checklistbox & lista kontrolna na koniec & 1 \\
\bottomrule
\end{tabularx}
\end{table}

\section{Element trzeci: proces i liczby}

\stepflow{Szkielet, Szkic, Ramki, Tabele, Korekta}

\pullquote{Dobry skład nie ozdabia treści --- on ją porządkuje.}

\bignumber{68\%}{czytelników przegląda ramki przed przeczytaniem tekstu głównego}

\begin{checklistbox}[Checklista: zanim oddasz rozdział]
\begin{itemize}
\item Struktura rozpisana przed pisaniem, nie po
\item Najwyżej jedna ramka na sekcję
\item Każda tabela przywołana w tekście
\item Diagram tam, gdzie jest proces
\item Checklista zamyka rozdział
\end{itemize}
\end{checklistbox}
`;

const ch2 = String.raw`\chapter{Rytm, pagina i łamanie ramek między stronami}

Drugi rozdział istnieje głównie po to, żeby sprawdzić opener z numerem dwucyfrowym-jednocyfrowym, żywą paginę na kolejnych stronach i zachowanie ramki łamanej między stronami.

\section{Dłuższy wywód}

` + Array.from({ length: 6 }, (_, i) => String.raw`Akapit ${i + 1}: typografia książkowa wymaga rytmu. Zdania różnej długości, akapity po kilka zdań, śródtytuł co dwie--trzy strony. Czytelnik nie zauważa dobrego składu --- zauważa dopiero zły, gdy wiersze się rozjeżdżają, a tabela ląduje trzy strony za swoim omówieniem. `).join("\n\n") + String.raw`

\begin{keyinsight}[Test strony trzeciej]
Jeżeli na losowo otwartej stronie książki nie widać żadnego elementu struktury (śródtytułu, ramki, tabeli, wyróżnienia), rozdział jest ścianą tekstu i wymaga redakcji.
\end{keyinsight}

\begin{checklistbox}[Checklista: kontrola składu]
\begin{itemize}
\item Żywa pagina obecna na stronach treści
\item Numer strony w plakietce w zewnętrznym rogu
\item Ramki nie sąsiadują ze sobą bezpośrednio
\end{itemize}
\end{checklistbox}
`;

const tex = assembleLatexDocument({
  title: "Sztuka projektowania ebooków",
  language: "pl",
  format: "standard",
  stylePreset: preset,
  customColors: custom,
  authorName: "Zespół InkMagnet",
  subtitle: "Rozdział testowy wszystkich elementów wizualnych",
  coverType: "none",
  chapters: [
    { chapterNumber: 1, title: "Anatomia dobrze złożonego rozdziału", latexContent: ch1 },
    { chapterNumber: 2, title: "Rytm, pagina i łamanie", latexContent: ch2 },
  ],
});

const outDir = path.resolve(__dirname, "../tmp/premium-preview");
fs.mkdirSync(outDir, { recursive: true });
// Stale aux/toc from a different preset (e.g. titletoc macros) break the next
// run — always start clean.
for (const f of fs.readdirSync(outDir)) {
  if (/\.(aux|toc|out|log|lof|lot)$/.test(f))
    fs.unlinkSync(path.join(outDir, f));
}
const texPath = path.join(outDir, "preview.tex");
fs.writeFileSync(texPath, tex, "utf8");
console.log(`.tex written: ${texPath} (${tex.length} chars)`);

for (const pass of [1, 2]) {
  console.log(`lualatex pass ${pass}...`);
  try {
    execSync(
      `lualatex -interaction=nonstopmode -output-directory="${outDir}" "${texPath}"`,
      { stdio: "pipe", timeout: 300000 },
    );
  } catch (e: any) {
    const log = fs.readFileSync(path.join(outDir, "preview.log"), "utf8");
    const errors = log.split("\n").filter((l) => l.startsWith("!")).slice(0, 6);
    console.error(`pass ${pass} failed:\n` + errors.join("\n"));
    if (pass === 1 && errors.length === 0) continue; // refs-only rerun
    process.exit(1);
  }
}
console.log(`OK: ${path.join(outDir, "preview.pdf")}`);
