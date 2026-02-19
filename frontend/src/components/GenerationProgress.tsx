// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BookForge — Generation Progress v3
// Rich pipeline visualization matching backend phases
// + Review & Revision phase visibility
// GenerationProgress.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  PenTool,
  FileText,
  Smartphone,
  CheckCircle,
  Loader2,
  BookOpen,
  Globe,
  Cpu,
  Clock,
  Zap,
  BarChart3,
  Layers,
  Upload,
  Braces,
  ScanSearch,
  BrainCircuit,
  FileCode,
  Package,
  ClipboardCheck,
  ShieldCheck,
  Plus,
  Trash2,
} from "lucide-react";

// ── Types ──

interface Chapter {
  chapterNumber: number;
  title: string;
  status: string;
  targetPages?: number;
}

interface GenerationProgressProps {
  generationStatus: string;
  generationProgress: number;
  chapters: Chapter[];
  targetPages: number;
  bookTitle: string;
  language: string;
}

type Phase =
  | "research"
  | "writing"
  | "reviewing"
  | "compiling_pdf"
  | "compiling_epub"
  | "finalizing"
  | "done";

// ── Phase detection from backend state ──

function detectPhase(
  status: string,
  progress: number,
  chapters: Chapter[],
): Phase {
  if (status === "COMPLETED") return "done";
  if (status === "COMPILING_EPUB") return "compiling_epub";
  if (status === "COMPILING_LATEX" || status === "CONTENT_READY")
    return "compiling_pdf";
  if (status === "REVIEWING_CONTENT") return "reviewing";
  if (status === "GENERATING_CONTENT") {
    const anyActive = chapters.some(
      (c) =>
        c.status === "GENERATING" ||
        c.status === "LATEX_READY" ||
        c.status === "GENERATED",
    );
    if (anyActive || progress > 0) return "writing";
    return "research";
  }
  return "research";
}

// ── Research sub-steps (animated, not real-time from backend) ──

const RESEARCH_STEPS = [
  {
    icon: Globe,
    label: "Searching web sources for the book topic",
    detail: "Google Custom Search API",
  },
  {
    icon: ScanSearch,
    label: "Scraping and extracting content from sources",
    detail: "Analyzing page content",
  },
  {
    icon: BrainCircuit,
    label: "AI selecting highest-quality sources",
    detail: "Claude evaluates relevance & data density",
  },
  {
    icon: Search,
    label: "Per-chapter targeted research queries",
    detail: "2 specialized queries per chapter",
  },
  {
    icon: Layers,
    label: "Building chapter research briefs",
    detail: "Merging global + chapter-specific sources",
  },
];

const REVIEW_STEPS = [
  {
    icon: ClipboardCheck,
    label: "Reviewing book completeness & quality",
    detail: "AI editor evaluating coverage, redundancy, depth",
  },
  {
    icon: Trash2,
    label: "Removing redundant content",
    detail: "Trimming repeated sections across chapters",
  },
  {
    icon: Plus,
    label: "Adding missing topics",
    detail: "Writing new subsections for uncovered areas",
  },
  {
    icon: ShieldCheck,
    label: "Post-revision quality check",
    detail: "Verifying improvement score",
  },
];

const COMPILE_PDF_STEPS = [
  {
    icon: FileCode,
    label: "Assembling LaTeX document",
    detail: "Merging chapter content + preamble",
  },
  {
    icon: Braces,
    label: "Running pdflatex (pass 1/2)",
    detail: "Building cross-references",
  },
  {
    icon: Braces,
    label: "Running pdflatex (pass 2/2)",
    detail: "Resolving references",
  },
  {
    icon: Upload,
    label: "Uploading PDF to cloud",
    detail: "S3 versioned storage",
  },
];

const COMPILE_EPUB_STEPS = [
  {
    icon: FileCode,
    label: "Converting chapters to XHTML",
    detail: "Semantic HTML structure",
  },
  {
    icon: Package,
    label: "Packaging EPUB container",
    detail: "OPF + NCX + mimetype",
  },
  { icon: Upload, label: "Uploading EPUB", detail: "S3 cloud storage" },
];

// ── Phase metadata ──

const PHASE_META: Record<
  Phase,
  {
    icon: any;
    label: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    dotColor: string;
  }
> = {
  research: {
    icon: Search,
    label: "Research & Source Analysis",
    description:
      "Web search, source scraping, AI-powered source selection — building the knowledge base for your book",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  writing: {
    icon: PenTool,
    label: "Content Generation",
    description:
      "AI writing each chapter with expert voice, rich LaTeX formatting, tables, and colored insight boxes",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    borderColor: "border-violet-200 dark:border-violet-800",
    dotColor: "bg-violet-500",
  },
  reviewing: {
    icon: ClipboardCheck,
    label: "Review & Revision",
    description:
      "AI editor reviewing completeness, removing redundancy, and adding missing topics to improve quality",
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
    borderColor: "border-rose-200 dark:border-rose-800",
    dotColor: "bg-rose-500",
  },
  compiling_pdf: {
    icon: FileText,
    label: "PDF Compilation",
    description:
      "Assembling LaTeX, running pdflatex with auto-fix, generating print-ready PDF",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  compiling_epub: {
    icon: Smartphone,
    label: "EPUB Generation",
    description: "Converting to XHTML, packaging for Kindle/Apple Books/Kobo",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
  finalizing: {
    icon: Upload,
    label: "Publishing",
    description: "Uploading files and finalizing version",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-950/30",
    borderColor: "border-teal-200 dark:border-teal-800",
    dotColor: "bg-teal-500",
  },
  done: {
    icon: CheckCircle,
    label: "Complete",
    description: "Your book is ready!",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    dotColor: "bg-green-500",
  },
};

const ALL_PHASES: Phase[] = [
  "research",
  "writing",
  "reviewing",
  "compiling_pdf",
  "compiling_epub",
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function GenerationProgress({
  generationStatus,
  generationProgress,
  chapters,
  targetPages,
  bookTitle,
  language,
}: GenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const [researchStep, setResearchStep] = useState(0);
  const [reviewStep, setReviewStep] = useState(0);
  const [compileStep, setCompileStep] = useState(0);
  const [epubStep, setEpubStep] = useState(0);

  const currentPhase = detectPhase(
    generationStatus,
    generationProgress,
    chapters,
  );

  // ── Elapsed timer ──
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Animated sub-steps for research phase ──
  useEffect(() => {
    if (currentPhase !== "research") return;
    const interval = setInterval(() => {
      setResearchStep((s) => Math.min(s + 1, RESEARCH_STEPS.length - 1));
    }, 15000);
    return () => clearInterval(interval);
  }, [currentPhase]);

  // ── Animated sub-steps for review phase ──
  useEffect(() => {
    if (currentPhase !== "reviewing") {
      setReviewStep(0);
      return;
    }
    const interval = setInterval(() => {
      setReviewStep((s) => Math.min(s + 1, REVIEW_STEPS.length - 1));
    }, 15000); // ~15s per step, total review ~1min
    return () => clearInterval(interval);
  }, [currentPhase]);

  // ── Animated sub-steps for compilation ──
  useEffect(() => {
    if (currentPhase !== "compiling_pdf") {
      setCompileStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCompileStep((s) => Math.min(s + 1, COMPILE_PDF_STEPS.length - 1));
    }, 12000);
    return () => clearInterval(interval);
  }, [currentPhase]);

  // ── Animated sub-steps for EPUB ──
  useEffect(() => {
    if (currentPhase !== "compiling_epub") {
      setEpubStep(0);
      return;
    }
    const interval = setInterval(() => {
      setEpubStep((s) => Math.min(s + 1, COMPILE_EPUB_STEPS.length - 1));
    }, 8000);
    return () => clearInterval(interval);
  }, [currentPhase]);

  // ── Chapter stats ──
  const chapterStats = useMemo(() => {
    const total = chapters.length;
    const done = chapters.filter(
      (c) => c.status === "LATEX_READY" || c.status === "GENERATED",
    ).length;
    const generating = chapters.filter((c) => c.status === "GENERATING").length;
    const pending = chapters.filter((c) => c.status === "PENDING").length;
    const errored = chapters.filter((c) => c.status === "ERROR").length;
    return { total, done, generating, pending, errored };
  }, [chapters]);

  // ── Time estimate ──
  const estimatedMinutes = useMemo(() => {
    const totalChapters = chapters.length || 4;
    if (currentPhase === "research") return totalChapters * 1.5 + 3 + 1 + 1;
    if (currentPhase === "writing") {
      const remaining = chapterStats.pending + chapterStats.generating;
      return remaining * 1.5 + 2.5; // +1 for review
    }
    if (currentPhase === "reviewing") return 1.5;
    if (currentPhase === "compiling_pdf") return 1.5;
    if (currentPhase === "compiling_epub") return 0.5;
    return 0;
  }, [currentPhase, chapters.length, chapterStats]);

  // ── Format helpers ──
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  };

  const phaseIdx = ALL_PHASES.indexOf(currentPhase);

  // Overall progress calculation
  // Research=0-15%, Writing=15-75%, Reviewing=75-85%, PDF=85-95%, EPUB=95-100%
  const overallProgress = useMemo(() => {
    if (currentPhase === "done") return 100;
    if (currentPhase === "research") {
      return Math.round((researchStep / RESEARCH_STEPS.length) * 15);
    }
    if (currentPhase === "writing") {
      return 15 + Math.round(generationProgress * 60);
    }
    if (currentPhase === "reviewing") {
      return 75 + Math.round((reviewStep / REVIEW_STEPS.length) * 10);
    }
    if (currentPhase === "compiling_pdf") {
      return 85 + Math.round((compileStep / COMPILE_PDF_STEPS.length) * 10);
    }
    if (currentPhase === "compiling_epub") {
      return 95 + Math.round((epubStep / COMPILE_EPUB_STEPS.length) * 5);
    }
    return 0;
  }, [
    currentPhase,
    researchStep,
    generationProgress,
    reviewStep,
    compileStep,
    epubStep,
  ]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* ── Header ── */}
      <div className="relative px-6 pt-6 pb-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <BookOpen className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                Generating Your Book
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-sm truncate">
                {bookTitle}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(elapsed)}
            </div>
            {estimatedMinutes > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                ~{Math.ceil(estimatedMinutes)}m remaining
              </p>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums min-w-[3ch]">
            {overallProgress}%
          </span>
        </div>
      </div>

      {/* ── Pipeline Timeline ── */}
      <div className="px-6 py-5">
        <div className="space-y-0">
          {ALL_PHASES.map((phase, idx) => {
            const meta = PHASE_META[phase];
            const Icon = meta.icon;
            const isComplete = phaseIdx > idx || currentPhase === "done";
            const isActive = phase === currentPhase;
            const isPending = phaseIdx < idx;
            const isLast = idx === ALL_PHASES.length - 1;

            return (
              <div key={phase} className="relative">
                {/* Timeline connector line */}
                {!isLast && (
                  <div
                    className={`absolute left-[17px] top-[38px] w-0.5 h-[calc(100%-22px)] transition-colors duration-500 ${
                      isComplete
                        ? "bg-green-300 dark:bg-green-700"
                        : isActive
                          ? `bg-gradient-to-b ${meta.dotColor.replace("bg-", "from-")} to-gray-200 dark:to-gray-700`
                          : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                )}

                <div className="flex gap-4 relative">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 mt-1 z-10">
                    {isComplete ? (
                      <div className="w-[34px] h-[34px] rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    ) : isActive ? (
                      <div className="relative">
                        <div
                          className={`w-[34px] h-[34px] rounded-full ${meta.bgColor} flex items-center justify-center border-2 ${meta.borderColor}`}
                        >
                          <Loader2
                            className={`w-4.5 h-4.5 ${meta.color} animate-spin`}
                          />
                        </div>
                        {/* Pulse ring */}
                        <div
                          className={`absolute inset-0 rounded-full ${meta.dotColor} opacity-20 animate-ping`}
                        />
                      </div>
                    ) : (
                      <div className="w-[34px] h-[34px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                  </div>

                  {/* Phase content */}
                  <div className={`flex-1 pb-5 ${isActive ? "pb-6" : ""}`}>
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-semibold ${
                          isComplete
                            ? "text-green-700 dark:text-green-400"
                            : isActive
                              ? meta.color
                              : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {meta.label}
                      </h4>
                      {isComplete && (
                        <span className="text-[10px] font-medium bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                          Done
                        </span>
                      )}
                      {isActive && (
                        <span
                          className={`text-[10px] font-medium ${meta.bgColor} ${meta.color} px-1.5 py-0.5 rounded`}
                        >
                          In Progress
                        </span>
                      )}
                    </div>

                    {(isActive || isComplete) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {meta.description}
                      </p>
                    )}

                    {/* ── Active phase: expanded detail ── */}
                    {isActive && phase === "research" && (
                      <ResearchDetail
                        currentStep={researchStep}
                        chaptersCount={
                          chapters.length || targetPages > 100 ? 8 : 4
                        }
                        language={language}
                      />
                    )}

                    {isActive && phase === "writing" && (
                      <WritingDetail
                        chapters={chapters}
                        stats={chapterStats}
                        progress={generationProgress}
                      />
                    )}

                    {isActive && phase === "reviewing" && (
                      <SubStepDetail
                        steps={REVIEW_STEPS}
                        currentStep={reviewStep}
                        accentColor="rose"
                      />
                    )}

                    {isActive && phase === "compiling_pdf" && (
                      <SubStepDetail
                        steps={COMPILE_PDF_STEPS}
                        currentStep={compileStep}
                        accentColor="amber"
                      />
                    )}

                    {isActive && phase === "compiling_epub" && (
                      <SubStepDetail
                        steps={COMPILE_EPUB_STEPS}
                        currentStep={epubStep}
                        accentColor="emerald"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stats Footer ── */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <BarChart3 className="w-3.5 h-3.5" />
              {targetPages} pages target
            </span>
            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Layers className="w-3.5 h-3.5" />
              {chapters.length || "—"} chapters
            </span>
            {chapterStats.done > 0 && (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Zap className="w-3.5 h-3.5" />
                {chapterStats.done}/{chapterStats.total} written
              </span>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <Cpu className="w-3.5 h-3.5" />
            Claude Sonnet 4.5
          </span>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ResearchDetail({
  currentStep,
  chaptersCount,
  language,
}: {
  currentStep: number;
  chaptersCount: number;
  language: string;
}) {
  return (
    <div className="mt-3 space-y-1.5">
      {RESEARCH_STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <div
            key={idx}
            className={`flex items-center gap-2.5 py-1.5 px-3 rounded-lg transition-all duration-300 ${
              isActive
                ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900"
                : isDone
                  ? "opacity-60"
                  : "opacity-30"
            }`}
          >
            <div className="flex-shrink-0">
              {isDone ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : isActive ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`text-xs font-medium ${
                  isActive
                    ? "text-blue-700 dark:text-blue-300"
                    : isDone
                      ? "text-gray-600 dark:text-gray-400"
                      : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </p>
              {isActive && (
                <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2 mt-2 pl-3">
        <Globe className="w-3 h-3 text-blue-400" />
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          Searching in{" "}
          {language === "pl"
            ? "Polish"
            : language === "en"
              ? "English"
              : language.toUpperCase()}{" "}
          + English supplement • {chaptersCount * 2} targeted queries planned
        </span>
      </div>
    </div>
  );
}

function WritingDetail({
  chapters,
  stats,
  progress,
}: {
  chapters: Chapter[];
  stats: {
    total: number;
    done: number;
    generating: number;
    pending: number;
    errored: number;
  };
  progress: number;
}) {
  if (chapters.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 py-2 px-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-100 dark:border-violet-900">
        <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
        <span className="text-xs text-violet-600 dark:text-violet-400">
          Initializing chapter records...
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {chapters.map((ch) => {
        const isDone = ch.status === "LATEX_READY" || ch.status === "GENERATED";
        const isActive = ch.status === "GENERATING";
        const isError = ch.status === "ERROR";

        return (
          <div
            key={ch.chapterNumber}
            className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300 ${
              isActive
                ? "bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900"
                : isDone
                  ? "bg-green-50/50 dark:bg-green-950/20 border border-transparent"
                  : isError
                    ? "bg-red-50/50 dark:bg-red-950/20 border border-transparent"
                    : "border border-transparent opacity-50"
            }`}
          >
            {/* Status icon */}
            <div className="flex-shrink-0">
              {isDone ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : isActive ? (
                <div className="relative">
                  <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                </div>
              ) : isError ? (
                <div className="w-4 h-4 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center">
                  <span className="text-[8px] text-red-600 dark:text-red-300 font-bold">
                    !
                  </span>
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
              )}
            </div>

            {/* Chapter info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isActive
                      ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300"
                      : isDone
                        ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  Ch.{ch.chapterNumber}
                </span>
                <p
                  className={`text-xs truncate ${
                    isActive
                      ? "text-violet-700 dark:text-violet-300 font-medium"
                      : isDone
                        ? "text-gray-700 dark:text-gray-300"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {ch.title}
                </p>
              </div>
              {isActive && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-violet-500 dark:text-violet-400">
                    Writing with research sources • LaTeX formatting • Tables &
                    insight boxes
                  </p>
                </div>
              )}
            </div>

            {/* Page count badge */}
            {ch.targetPages && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                ~{ch.targetPages}p
              </span>
            )}
          </div>
        );
      })}

      {/* Writing stats bar */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-violet-100 dark:border-violet-900/50 px-3">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
            {stats.done > 0 && (
              <div
                className="h-full bg-green-400 dark:bg-green-500 transition-all duration-700"
                style={{ width: `${(stats.done / stats.total) * 100}%` }}
              />
            )}
            {stats.generating > 0 && (
              <div
                className="h-full bg-violet-400 dark:bg-violet-500 animate-pulse transition-all duration-700"
                style={{
                  width: `${(stats.generating / stats.total) * 100}%`,
                }}
              />
            )}
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
            {stats.done}/{stats.total} chapters
          </span>
        </div>
      )}
    </div>
  );
}

function SubStepDetail({
  steps,
  currentStep,
  accentColor = "amber",
}: {
  steps: Array<{ icon: any; label: string; detail: string }>;
  currentStep: number;
  accentColor?: "amber" | "rose" | "emerald";
}) {
  const colors = {
    amber: {
      activeBg:
        "bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900",
      spinner: "text-amber-500",
      label: "text-amber-700 dark:text-amber-300",
      detail: "text-amber-500 dark:text-amber-400",
    },
    rose: {
      activeBg:
        "bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900",
      spinner: "text-rose-500",
      label: "text-rose-700 dark:text-rose-300",
      detail: "text-rose-500 dark:text-rose-400",
    },
    emerald: {
      activeBg:
        "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900",
      spinner: "text-emerald-500",
      label: "text-emerald-700 dark:text-emerald-300",
      detail: "text-emerald-500 dark:text-emerald-400",
    },
  };
  const c = colors[accentColor];

  return (
    <div className="mt-3 space-y-1.5">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <div
            key={idx}
            className={`flex items-center gap-2.5 py-1.5 px-3 rounded-lg transition-all duration-300 ${
              isActive ? c.activeBg : isDone ? "opacity-60" : "opacity-30"
            }`}
          >
            <div className="flex-shrink-0">
              {isDone ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : isActive ? (
                <Loader2 className={`w-3.5 h-3.5 ${c.spinner} animate-spin`} />
              ) : (
                <Icon className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
            <div>
              <p
                className={`text-xs font-medium ${
                  isActive
                    ? c.label
                    : isDone
                      ? "text-gray-600 dark:text-gray-400"
                      : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </p>
              {isActive && (
                <p className={`text-[10px] ${c.detail} mt-0.5`}>
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
