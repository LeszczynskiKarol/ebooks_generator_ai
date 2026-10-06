// Local smoke test of the free style sample's TYPESETTING (no LLM, no cost):
// renders a fixed chapter-1 opening in every preset × format to
// tmp/sample-typeset-test/<preset>-<format>/page-N.png.
// Usage: npx tsx scripts/sample-typeset-test.ts [preset,...] [format,...] [--tex-only]
// --tex-only writes the .tex files without compiling (to typeset elsewhere,
// e.g. on the TeX Live server when the local MiKTeX is broken).
import path from "path";
import fs from "fs";
import { typesetSample, buildSampleTex } from "../src/services/sampleGenerator";
import { resolveNumbering } from "../src/lib/numbering";

const latex = String.raw`\chapter{Stanowisko przed pierwszą rośliną}

Zioła na parapecie rzadko giną z braku troski. Częściej przegrywają z miejscem, które wybraliśmy za nie: za ciemnym, za ciepłym nad kaloryferem albo przewiewanym przy każdym otwarciu okna. Ten rozdział zaczyna się więc nie od nasion, ale od obejścia mieszkania z kartką w ręku.

\section{Światło: ile go naprawdę jest}

Okno południowe daje ziołom śródziemnomorskim to, czego potrzebują, ale już półtora metra w głąb pokoju światło słabnie kilkukrotnie. Bazylia i tymianek, które stoją przy szybie, rosną zwarte i aromatyczne; te same rośliny na stole obok wyciągają się i bledną.

\begin{tipbox}[Test kartki papieru]
W słoneczne południe połóż białą kartkę tam, gdzie ma stanąć doniczka, i przyłóż nad nią dłoń. Ostry, wyraźny cień oznacza miejsce dla rozmarynu i tymianku. Rozmyty cień wystarczy pietruszce i szczypiorowi. Brak cienia to sygnał, że roślina będzie tam tylko przetrwać.
\end{tipbox}

Kierunek okna to jednak tylko połowa odpowiedzi. Liczy się też to, co stoi naprzeciwko: ściana sąsiedniego bloku potrafi odebrać parapetowi połowę dnia.

\begin{table}[!htbp]
\centering
\begin{tabularx}{\linewidth}{lX}
\toprule
\textbf{Okno} & \textbf{Co postawić} \\
\midrule
Południe & rozmaryn, tymianek, oregano, bazylia \\
Wschód / zachód & pietruszka, mięta, melisa, kolendra \\
Północ & szczypiorek, mięta (z doświetlaniem) \\
\bottomrule
\end{tabularx}
\caption{Zioła a kierunek okna}
\end{table}

\section{Ciepło i przeciąg}

Kaloryfer pod parapetem wysusza podłoże szybciej, niż zdążymy to zauważyć. Wystarczy podstawka z keramzytem albo deska, która odetnie doniczki od strumienia ciepłego powietrza.

\begin{keyinsight}[Najpierw miejsce, potem roślina]
Wybierz zioła do parapetu, a nie parapet do ziół. Ta kolejność oszczędza więcej roślin niż jakikolwiek nawóz.
\end{keyinsight}`;

async function main() {
  const presets = (process.argv[2] || "modern,academic,minimal,creative,business").split(",");
  const formats = (process.argv[3] || "a5,a4").split(",");
  const numbering = resolveNumbering({ language: "pl" });
  for (const preset of presets) {
    for (const format of formats) {
      const dir = path.join(process.cwd(), "tmp", "sample-typeset-test", `${preset}-${format}`);
      const t0 = Date.now();
      const input = {
        title: "Ziołowy parapet",
          chapterTitle: "Stanowisko przed pierwszą rośliną",
          latex,
          language: "pl",
          format,
          stylePreset: preset,
          stripFootnotes: true,
          numbering,
      };
      if (process.argv.includes("--tex-only")) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/sample.tex`, buildSampleTex(input), "utf8");
        console.log(`${preset}-${format}: sample.tex written`);
        continue;
      }
      try {
        const n = await typesetSample(dir, input);
        console.log(`${preset}-${format}: ${n} pages in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (e: any) {
        console.log(`${preset}-${format}: FAILED ${e?.message?.slice(0, 200)}`);
      }
    }
  }
}
main();
