import { useParams, Link } from "react-router-dom";
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
  Play,
  FileText,
  MessageSquare,
  Bot,
  Zap,
  Clock,
  Hash,
} from "lucide-react";
import apiClient from "@/lib/api";
import toast from "react-hot-toast";

export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>();

  // Full project data
  const { data: project, isLoading: loadingProject, refetch: refetchProject } = useQuery({
    queryKey: ["admin-project", id],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/projects/${id}`);
      return res.data.data;
    },
  });

  // Prompts data
  const { data: promptsData, isLoading: loadingPrompts, refetch: refetchPrompts } = useQuery({
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
    return <div className="text-center py-20 text-red-500">Project not found</div>;
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
    if (!confirm("Re-generate all chapters? This will overwrite existing content.")) return;
    try {
      await apiClient.post(`/admin/projects/${id}/regenerate`);
      toast.success("Regeneration started");
    } catch {
      toast.error("Failed");
    }
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{project.id}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { refetchProject(); refetchPrompts(); }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={handleRecompile}
              className="px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
            >
              Re-compile PDF
            </button>
            <button
              onClick={handleRegenerate}
              className="px-3 py-2 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium"
            >
              Re-generate All
            </button>
          </div>
        </div>
      </div>

      {/* Project meta */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Stage", value: project.currentStage, color: "text-primary-600" },
          { label: "Payment", value: `${project.priceFormatted || "—"} (${project.paymentStatus})` },
          { label: "Generation", value: project.generationStatus },
          { label: "Pages", value: project.targetPages },
          { label: "Tokens", value: (project.totalTokensUsed || 0).toLocaleString() },
          { label: "Cost", value: `$${(project.totalCostUsd || 0).toFixed(4)}` },
        ].map((m) => (
          <div key={m.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
            <span className="text-[10px] uppercase font-semibold text-gray-400">{m.label}</span>
            <p className={`text-sm font-bold mt-0.5 ${m.color || "text-gray-900 dark:text-white"}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ═══ STRUCTURE GENERATION ═══ */}
      <Section title="1. Structure Generation" icon={FileText}>
        {promptsData?.structure ? (
          <div className="space-y-4">
            <PromptBlock label="Prompt → Claude" content={promptsData.structure.prompt} />
            <ResponseBlock label="Claude Response" content={promptsData.structure.response} />
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Version: {promptsData.structure.version}</span>
              <span>User edited: {promptsData.structure.isUserEdited ? "Yes" : "No"}</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">No structure data yet</p>
        )}
      </Section>

      {/* ═══ CHAPTER GENERATION ═══ */}
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
          <p className="text-gray-400 text-sm italic">No chapters generated yet</p>
        )}
      </Section>

      {/* ═══ RAW PROJECT DATA ═══ */}
      <Section title="3. Raw Project Data" icon={Hash}>
        <CollapsibleJson label="Full project object" data={project} />
      </Section>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
      >
        <Icon className="w-5 h-5 text-primary-500" />
        <span className="font-semibold text-gray-900 dark:text-white flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function ChapterBlock({ chapter, projectId }: { chapter: any; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [latexExpanded, setLatexExpanded] = useState(false);
  const [fullLatex, setFullLatex] = useState<string | null>(null);

  const loadFullLatex = async () => {
    if (fullLatex) {
      setLatexExpanded(!latexExpanded);
      return;
    }
    try {
      const res = await apiClient.get(`/admin/projects/${projectId}/chapters/${chapter.number}/latex`);
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
      {/* Chapter header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className="font-mono text-xs text-gray-400 shrink-0">Ch.{chapter.number}</span>
        <span className="font-medium text-gray-900 dark:text-white flex-1 truncate">{chapter.title}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[chapter.status] || ""}`}>
          {chapter.status}
        </span>
        <span className="text-xs text-gray-400 shrink-0">
          {chapter.actualWords || 0}/{chapter.targetWords} words
        </span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Prompts */}
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

          {/* Responses */}
          {chapter.responses?.length > 0 ? (
            chapter.responses.map((r: any, i: number) => (
              <ResponseBlock
                key={i}
                label={`${r.step === "main" ? "🟢" : "🟠"} Response — ${r.step}`}
                content={r.content?.slice(0, 3000) + (r.content?.length > 3000 ? "\n\n... [truncated]" : "")}
                meta={`${r.model} | in: ${r.inputTokens} | out: ${r.outputTokens} | ${r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ""}`}
              />
            ))
          ) : (
            <p className="text-gray-400 text-xs italic">No responses logged</p>
          )}

          {/* Full LaTeX */}
          <div>
            <button
              onClick={loadFullLatex}
              className="inline-flex items-center gap-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <FileText className="w-3 h-3" />
              {latexExpanded ? "Hide" : "Show"} full LaTeX ({chapter.latexContentLength?.toLocaleString()} chars)
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

function PromptBlock({ label, content, timestamp }: { label: string; content: string | null; timestamp?: string }) {
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
              <Clock className="w-2.5 h-2.5" /> {new Date(timestamp).toLocaleTimeString()}
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

function ResponseBlock({ label, content, meta }: { label: string; content: string | null; meta?: string }) {
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
        <span className="text-[10px] font-mono text-gray-500">LaTeX source</span>
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
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
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
