import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  FileText,
  MessageSquare,
  Bot,
  Clock,
  Hash,
  Search,
  Globe,
  Link2,
  CheckCircle2,
  XCircle,
  Database,
  Zap,
  Trash2,
} from "lucide-react";
import apiClient from "@/lib/api";
import toast from "react-hot-toast";

export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: project,
    isLoading: loadingProject,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ["admin-project", id],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/projects/${id}`);
      return res.data.data;
    },
  });

  const {
    data: researchData,
    isLoading: loadingResearch,
    refetch: refetchResearch,
  } = useQuery({
    queryKey: ["admin-research", id],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/projects/${id}/research`);
      return res.data.data;
    },
  });

  const {
    data: promptsData,
    isLoading: loadingPrompts,
    refetch: refetchPrompts,
  } = useQuery({
    queryKey: ["admin-prompts", id],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/projects/${id}/prompts`);
      return res.data.data;
    },
  });

  if (loadingProject) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-red-500">Project not found</div>
    );
  }

  const handleRecompile = async () => {
    try {
      await apiClient.post(`/admin/projects/${id}/recompile`);
      toast.success("Recompilation started");
    } catch {
      toast.error("Failed");
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "Re-generate all chapters? This will overwrite existing content.",
      )
    )
      return;
    try {
      await apiClient.post(`/admin/projects/${id}/regenerate`);
      toast.success("Regeneration started");
    } catch {
      toast.error("Failed");
    }
  };

  const handleReResearch = async () => {
    if (
      !confirm(
        "Re-run research pipeline? This will replace existing research data.",
      )
    )
      return;
    try {
      await apiClient.post(`/admin/projects/${id}/re-research`);
      toast.success("Research pipeline started");
      setTimeout(() => refetchResearch(), 30000);
    } catch {
      toast.error("Failed");
    }
  };

  const handleRegenStructure = async () => {
    if (
      !confirm("Re-generate structure? This includes running research first.")
    )
      return;
    try {
      await apiClient.post(`/admin/projects/${id}/regenerate-structure`);
      toast.success("Structure regeneration started");
    } catch {
      toast.error("Failed");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `DELETE this project permanently?\n\n"${project?.title || project?.topic}"\n\nThis cannot be undone!`,
      )
    )
      return;
    try {
      await apiClient.delete(`/admin/projects/${id}`);
      toast.success("Project deleted");
      navigate("/admin");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const refreshAll = () => {
    refetchProject();
    refetchResearch();
    refetchPrompts();
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Admin Panel
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.title || project.topic}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
              {project.id}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={refreshAll}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Refresh all"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={handleReResearch}
              className="px-3 py-2 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium dark:bg-purple-950 dark:text-purple-300"
            >
              Re-research
            </button>
            <button
              onClick={handleRegenStructure}
              className="px-3 py-2 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-medium dark:bg-amber-950 dark:text-amber-300"
            >
              Re-gen Structure
            </button>
            <button
              onClick={handleRecompile}
              className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium dark:bg-blue-950 dark:text-blue-300"
            >
              Re-compile PDF
            </button>
            <button
              onClick={handleRegenerate}
              className="px-3 py-2 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium dark:bg-red-950 dark:text-red-300"
            >
              Re-generate All
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-black font-medium dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Project meta */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-6">
        {[
          {
            label: "Stage",
            value: project.currentStage,
            color: "text-primary-600",
          },
          {
            label: "Payment",
            value: `${project.priceFormatted || "—"} (${project.paymentStatus})`,
          },
          { label: "Generation", value: project.generationStatus },
          {
            label: "Pages",
            value: `${project.targetPages} (${project.bookFormat})`,
          },
          {
            label: "Tokens",
            value: (project.totalTokensUsed || 0).toLocaleString(),
          },
          {
            label: "Cost",
            value: `$${(project.totalCostUsd || 0).toFixed(4)}`,
          },
          {
            label: "Research",
            value: project.researchSummary
              ? `${project.researchSummary.selectedSourcesCount} sources`
              : "None",
            color: project.researchSummary ? "text-green-600" : "text-gray-400",
          },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3"
          >
            <span className="text-[10px] uppercase font-semibold text-gray-400">
              {m.label}
            </span>
            <p
              className={`text-sm font-bold mt-0.5 ${m.color || "text-gray-900 dark:text-white"}`}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ═══ 0. RESEARCH PIPELINE ═══ */}
      <Section title="0. Research Pipeline" icon={Search} defaultOpen={true}>
        {loadingResearch ? (
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        ) : researchData ? (
          <ResearchView data={researchData} projectId={id!} />
        ) : (
          <div className="text-gray-400 text-sm italic flex items-center gap-2">
            <XCircle className="w-4 h-4" /> No research data — pipeline hasn't
            run or API keys not configured
          </div>
        )}
      </Section>

      {/* ═══ 1. STRUCTURE GENERATION ═══ */}
      <Section title="1. Structure Generation" icon={FileText}>
        {promptsData?.structure ? (
          <div className="space-y-4">
            <PromptBlock
              label="Prompt → Claude"
              content={promptsData.structure.prompt}
            />
            <ResponseBlock
              label="Claude Response"
              content={promptsData.structure.response}
            />
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Version: {promptsData.structure.version}</span>
              <span>
                User edited: {promptsData.structure.isUserEdited ? "Yes" : "No"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">No structure data yet</p>
        )}
      </Section>

      {/* ═══ 2. CHAPTER GENERATION ═══ */}
      <Section title="2. Chapter Generation (LaTeX)" icon={Bot}>
        {loadingPrompts ? (
          <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        ) : promptsData?.chapters?.length > 0 ? (
          <div className="space-y-4">
            {promptsData.chapters.map((ch: any) => (
              <ChapterBlock key={ch.id} chapter={ch} projectId={id!} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">
            No chapters generated yet
          </p>
        )}
      </Section>

      {/* ═══ 3. RAW PROJECT DATA ═══ */}
      <Section title="3. Raw Project Data" icon={Hash}>
        <CollapsibleJson label="Full project object" data={project} />
      </Section>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Research View — full pipeline visualization
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ResearchView({ data, projectId }: { data: any; projectId: string }) {
  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div className="col-span-2 sm:col-span-6 bg-purple-50 dark:bg-purple-950/50 rounded-lg p-3">
          <span className="text-[10px] uppercase font-semibold text-purple-400">
            Search Queries
          </span>
          <p className="text-sm font-bold text-purple-700 dark:text-purple-300 mt-0.5 break-all">
            🔍 "{data.googleQuery}"
            {data.englishQuery ? ` → 🇬🇧 "${data.englishQuery}"` : ""}
          </p>
        </div>
        {[
          { label: "Search Results", value: data.stats.totalSearchResults },
          {
            label: "Scraped OK",
            value: `${data.stats.successfulScrapes}/${data.stats.totalScraped}`,
          },
          {
            label: "Selected",
            value: `${data.stats.selectedCount} (${data.stats.nativeSources || 0} native + ${data.stats.englishSources || 0} EN)`,
          },
          {
            label: "Total Chars",
            value: data.stats.totalSourceChars?.toLocaleString(),
          },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-purple-50 dark:bg-purple-950/50 rounded-lg p-3"
          >
            <span className="text-[10px] uppercase font-semibold text-purple-400">
              {s.label}
            </span>
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300 mt-0.5 break-all">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Claude's reasoning */}
      {data.selectionReasoning && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
          <span className="text-[10px] uppercase font-semibold text-amber-500">
            Claude's Quality Assessment
          </span>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            {data.selectionReasoning}
          </p>
        </div>
      )}

      {/* Google search results (target lang) */}
      <SubSection
        title={`Google Results — Target Language (${data.searchResults?.length || 0})`}
        icon={Globe}
      >
        {data.searchResults?.length > 0 ? (
          <div className="space-y-2">
            {data.searchResults.map((r: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <span className="text-gray-400 font-mono shrink-0 w-5 text-right">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener"
                    className="text-blue-600 hover:underline font-medium break-all"
                  >
                    {r.title}
                  </a>
                  <p className="text-gray-500 mt-0.5 break-all">{r.link}</p>
                  <p className="text-gray-400 mt-0.5">{r.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs italic">No search results</p>
        )}
      </SubSection>

      {/* English search results (if supplement ran) */}
      {data.englishSearchResults?.length > 0 && (
        <SubSection
          title={`Google Results — English Supplement (${data.englishSearchResults.length})`}
          icon={Globe}
        >
          <div className="space-y-2">
            {data.englishSearchResults.map((r: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30"
              >
                <span className="text-blue-400 font-mono shrink-0 w-5 text-right">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener"
                    className="text-blue-600 hover:underline font-medium break-all"
                  >
                    {r.title}
                  </a>
                  <p className="text-gray-500 mt-0.5 break-all">{r.link}</p>
                  <p className="text-gray-400 mt-0.5">{r.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {/* Scraping results */}
      <SubSection
        title={`Scraping (${data.stats.successfulScrapes}/${data.stats.totalScraped} OK)`}
        icon={Link2}
      >
        {data.scrapingResults?.length > 0 ? (
          <div className="space-y-1">
            {data.scrapingResults.map((s: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                {s.status === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
                <span className="text-gray-500 break-all flex-1 font-mono">
                  {s.url}
                </span>
                <span
                  className={`shrink-0 font-medium ${s.status === "success" ? "text-green-600" : "text-red-400"}`}
                >
                  {s.status === "success"
                    ? `${s.length.toLocaleString()} chars`
                    : "failed"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs italic">No scraping data</p>
        )}
      </SubSection>

      {/* Step 3: Selected sources */}
      <SubSection
        title={`Step 4: Selected Sources (${data.selectedSources?.length || 0})`}
        icon={Database}
      >
        {data.selectedSources?.length > 0 ? (
          <div className="space-y-3">
            {data.selectedSources.map((s: any) => (
              <SourceBlock key={s.index} source={s} projectId={projectId} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-xs italic">No sources selected</p>
        )}
      </SubSection>

      {/* Timestamp */}
      {data.researchedAt && (
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Researched:{" "}
          {new Date(data.researchedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function SourceBlock({
  source,
  projectId,
}: {
  source: any;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFullText = async () => {
    if (fullText) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/admin/projects/${projectId}/research/source/${source.index}`,
      );
      setFullText(res.data.data.text);
      setExpanded(true);
    } catch {
      toast.error("Failed to load source text");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-purple-200 dark:border-purple-900 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/50">
        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0">
          #{source.index}
        </span>
        <a
          href={source.url}
          target="_blank"
          rel="noopener"
          className="text-xs text-blue-600 hover:underline break-all flex-1 font-mono"
        >
          {source.url}
        </a>
        <span className="text-[10px] text-purple-400 shrink-0">
          {source.fullTextLength?.toLocaleString()} chars
        </span>
      </div>

      {/* Preview */}
      <div className="px-3 py-2">
        <pre className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-32 overflow-hidden font-mono leading-relaxed">
          {source.textPreview}
          {source.textPreview?.length < source.fullTextLength && "..."}
        </pre>
      </div>

      {/* Full text toggle */}
      <div className="px-3 py-2 border-t border-purple-100 dark:border-purple-900">
        <button
          onClick={loadFullText}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {expanded ? "Hide" : "Show"} full source text (
          {source.fullTextLength?.toLocaleString()} chars)
        </button>

        {expanded && fullText && (
          <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex justify-end px-2 py-1 bg-gray-100 dark:bg-gray-800">
              <CopyButton text={fullText} />
            </div>
            <pre className="p-3 text-[11px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-[500px] overflow-auto font-mono leading-relaxed">
              {fullText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
      >
        <Icon className="w-5 h-5 text-primary-500" />
        <span className="font-semibold text-gray-900 dark:text-white flex-1">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function SubSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors bg-gray-50 dark:bg-gray-800/50"
      >
        <Icon className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function ChapterBlock({
  chapter,
  projectId,
}: {
  chapter: any;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [latexExpanded, setLatexExpanded] = useState(false);
  const [fullLatex, setFullLatex] = useState<string | null>(null);

  const loadFullLatex = async () => {
    if (fullLatex) {
      setLatexExpanded(!latexExpanded);
      return;
    }
    try {
      const res = await apiClient.get(
        `/admin/projects/${projectId}/chapters/${chapter.number}/latex`,
      );
      setFullLatex(res.data.data.latexContent);
      setLatexExpanded(true);
    } catch {
      toast.error("Failed to load LaTeX");
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-gray-200 text-gray-600",
    GENERATING: "bg-yellow-200 text-yellow-700",
    GENERATED: "bg-green-200 text-green-700",
    LATEX_READY: "bg-emerald-200 text-emerald-700",
    ERROR: "bg-red-200 text-red-700",
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className="font-mono text-xs text-gray-400 shrink-0">
          Ch.{chapter.number}
        </span>
        <span className="font-medium text-gray-900 dark:text-white flex-1 truncate">
          {chapter.title}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[chapter.status] || ""}`}
        >
          {chapter.status}
        </span>
        <span className="text-xs text-gray-400 shrink-0">
          {chapter.actualWords || 0}/{chapter.targetWords}w
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {chapter.prompts?.length > 0 ? (
            chapter.prompts.map((p: any, i: number) => (
              <PromptBlock
                key={i}
                label={`${p.step === "main" ? "🔵" : "🟡"} ${p.role.toUpperCase()} — ${p.step}`}
                content={p.content}
                timestamp={p.timestamp}
              />
            ))
          ) : (
            <p className="text-gray-400 text-xs italic">No prompts logged</p>
          )}

          {chapter.responses?.length > 0 ? (
            chapter.responses.map((r: any, i: number) => (
              <ResponseBlock
                key={i}
                label={`${r.step === "main" ? "🟢" : "🟠"} Response — ${r.step}`}
                content={
                  r.content?.slice(0, 3000) +
                  (r.content?.length > 3000 ? "\n\n... [truncated]" : "")
                }
                meta={`${r.model} | in: ${r.inputTokens} | out: ${r.outputTokens} | ${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ""}`}
              />
            ))
          ) : (
            <p className="text-gray-400 text-xs italic">No responses logged</p>
          )}

          <div>
            <button
              onClick={loadFullLatex}
              className="inline-flex items-center gap-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <FileText className="w-3 h-3" />
              {latexExpanded ? "Hide" : "Show"} full LaTeX (
              {chapter.latexContentLength?.toLocaleString()} chars)
            </button>
            {latexExpanded && fullLatex && (
              <div className="mt-2">
                <CodeBlock content={fullLatex} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PromptBlock({
  label,
  content,
  timestamp,
}: {
  label: string;
  content: string | null;
  timestamp?: string;
}) {
  if (!content) return null;
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950">
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3" /> {label}
        </span>
        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-[10px] text-blue-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{" "}
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
          <CopyButton text={content} />
        </div>
      </div>
      <pre className="p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto font-mono leading-relaxed">
        {content}
      </pre>
    </div>
  );
}

function ResponseBlock({
  label,
  content,
  meta,
}: {
  label: string;
  content: string | null;
  meta?: string;
}) {
  if (!content) return null;
  return (
    <div className="rounded-lg border border-green-200 dark:border-green-900 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-950">
        <span className="text-xs font-semibold text-green-700 dark:text-green-300 flex items-center gap-1.5">
          <Bot className="w-3 h-3" /> {label}
        </span>
        <div className="flex items-center gap-2">
          {meta && <span className="text-[10px] text-green-400">{meta}</span>}
          <CopyButton text={content} />
        </div>
      </div>
      <pre className="p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto font-mono leading-relaxed">
        {content}
      </pre>
    </div>
  );
}

function CodeBlock({ content }: { content: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800">
        <span className="text-[10px] font-mono text-gray-500">
          LaTeX source
        </span>
        <CopyButton text={content} />
      </div>
      <pre className="p-3 text-[11px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 overflow-x-auto whitespace-pre-wrap max-h-[600px] overflow-y-auto font-mono leading-relaxed">
        {content}
      </pre>
    </div>
  );
}

function CollapsibleJson({ label, data }: { label: string; data: any }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(data, null, 2);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 font-medium"
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {label}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex justify-end px-3 py-1 bg-gray-100 dark:bg-gray-800">
            <CopyButton text={json} />
          </div>
          <pre className="p-3 text-[11px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 overflow-auto max-h-[500px] font-mono">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 text-gray-400" />
      )}
    </button>
  );
}
