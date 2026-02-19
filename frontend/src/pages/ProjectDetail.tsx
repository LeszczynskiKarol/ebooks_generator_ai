import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TitlePageEditor, {
  type TitlePageEditorHandle,
} from "@/components/TitlePageEditor";
import ColophonEditor, {
  type ColophonEditorHandle,
} from "@/components/ColophonEditor";
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Image,
  Sparkles,
  Pencil,
} from "lucide-react";
import DownloadPanel from "@/components/DownloadPanel";
import GenerationProgress from "@/components/GenerationProgress";
import apiClient from "@/lib/api";
import { STAGE_LABELS, type ProjectStage } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";
import { useRef, useState } from "react";
import StructureEditor from "@/components/StructureEditor";
import BookEditor, { type BookEditorHandle } from "@/components/BookEditor";

const STAGE_STEPS: ProjectStage[] = [
  "BRIEF",
  "PRICING",
  "PAYMENT",
  "STRUCTURE",
  "STRUCTURE_REVIEW",
  "IMAGES",
  "GENERATING",
  "COMPILING",
  "COMPLETED",
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [titlePageDirty, setTitlePageDirty] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const token = useAuthStore((s) => s.accessToken);

  // ── BookEditor ↔ DownloadPanel bridge ──
  const editorRef = useRef<BookEditorHandle>(null);
  const [unsavedCount, setUnsavedCount] = useState(0);

  // ── TitlePageEditor & ColophonEditor refs + dirty tracking ──
  const titlePageRef = useRef<TitlePageEditorHandle>(null);
  const colophonRef = useRef<ColophonEditorHandle>(null);
  const [titlePageFormDirty, setTitlePageFormDirty] = useState(false);
  const [colophonFormDirty, setColophonFormDirty] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${id}`);
      return res.data.data;
    },
    refetchInterval: (query) => {
      const stage = query.state.data?.currentStage;
      if (stage === "STRUCTURE" && !query.state.data?.structure) return 3000;
      if (stage === "GENERATING") return 5000;
      if (stage === "COMPILING") return 3000;
      return false;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Project not found</p>
        <Link to="/dashboard" className="text-primary-600 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const project = data;
  const currentStageIdx = STAGE_STEPS.indexOf(project.currentStage);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await apiClient.post(`/projects/${id}/checkout`);
      window.location.href = res.data.data.sessionUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleApproveStructure = async () => {
    try {
      await apiClient.post(`/projects/${id}/structure/approve`);
      toast.success("Structure approved!");
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const handleStartGeneration = async () => {
    try {
      await apiClient.post(`/projects/${id}/generate`);
      toast.success("Generation started!");
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  // ── Combined save-all: chapters + title page + colophon ──
  const handleSaveAll = async (): Promise<boolean> => {
    let allOk = true;

    // 1. Save title page if dirty
    if (titlePageRef.current?.isDirty) {
      const ok = await titlePageRef.current.save();
      if (!ok) allOk = false;
    }

    // 2. Save colophon if dirty
    if (colophonRef.current?.isDirty) {
      const ok = await colophonRef.current.save();
      if (!ok) allOk = false;
    }

    // 3. Save dirty chapters (BookEditor)
    if (editorRef.current && editorRef.current.dirtyCount > 0) {
      const ok = await editorRef.current.saveAllDirty();
      if (!ok) allOk = false;
    }

    return allOk;
  };

  // ── Compute total unsaved count across all sections ──
  const totalUnsaved =
    unsavedCount + (titlePageFormDirty ? 1 : 0) + (colophonFormDirty ? 1 : 0);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">
          {project.title || project.topic}
        </h1>
        {project.title && (
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {project.topic}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Progress
          </h2>
          <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
            {STAGE_LABELS[project.currentStage as ProjectStage]}
          </span>
        </div>
        <div className="flex gap-1">
          {STAGE_STEPS.map((stage, i) => (
            <div
              key={stage}
              className={`h-2 flex-1 rounded-full transition-colors ${i <= currentStageIdx ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"}`}
            />
          ))}
        </div>
      </div>

      {/* Project info */}
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            Details
          </h3>
          <dl className="space-y-3">
            {[
              ["Pages", project.targetPages],
              ["Language", project.language.toUpperCase()],
              ["Style", project.stylePreset],
              ["Format", project.bookFormat.toUpperCase()],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between">
                <dt className="text-sm text-gray-600 dark:text-gray-400">
                  {label}
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {val}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            Payment
          </h3>
          <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 font-display mb-1">
            {project.priceUsdFormatted || "—"}
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Status:{" "}
            <span
              className={`font-medium ${project.paymentStatus === "PAID" ? "text-green-600" : "text-amber-600"}`}
            >
              {project.paymentStatus}
            </span>
          </p>
          {project.guidelines && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Guidelines
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {project.guidelines}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Action area ═══ */}
      <div className="space-y-6">
        {/* PAYMENT — waiting or cancelled */}
        {project.paymentStatus !== "PAID" &&
          (project.currentStage === "PRICING" ||
            project.currentStage === "PAYMENT") && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 text-center">
              <CreditCard className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Payment Pending
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your payment of {project.priceUsdFormatted} hasn't been
                completed yet.
              </p>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-lg disabled:opacity-50 shadow-lg shadow-primary-600/25"
              >
                {checkoutLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
                Complete Payment — {project.priceUsdFormatted}
              </button>
              <p className="text-xs text-gray-500 mt-3">
                Secure payment via Stripe
              </p>
            </div>
          )}

        {/* STRUCTURE — waiting for AI */}
        {project.paymentStatus === "PAID" &&
          (project.currentStage === "STRUCTURE" ||
            project.currentStage === "STRUCTURE_REVIEW") &&
          !project.structure && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 text-center">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Payment Confirmed!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Generating your book structure with AI... This takes 10-30
                seconds.
              </p>
            </div>
          )}

        {/* STRUCTURE REVIEW — the editor! */}
        {(project.currentStage === "STRUCTURE" ||
          project.currentStage === "STRUCTURE_REVIEW") &&
          project.structure && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <StructureEditor
                projectId={project.id}
                structureJson={project.structure.structureJson}
                canRedo={!project.structureRedoUsed}
                onApprove={handleApproveStructure}
                onRefetch={() => refetch()}
              />
            </div>
          )}

        {/* IMAGES */}
        {project.currentStage === "IMAGES" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 text-center">
            <Image className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Images (Optional)
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Upload images or skip to generate without them.
            </p>
            <button
              onClick={handleStartGeneration}
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-lg shadow-lg shadow-primary-600/25"
            >
              <Sparkles className="w-5 h-5" /> Start Generation
            </button>
          </div>
        )}

        {/* GENERATING — rich progress panel */}
        {project.currentStage === "GENERATING" && (
          <GenerationProgress
            generationStatus={project.generationStatus}
            generationProgress={project.generationProgress}
            chapters={project.chapters || []}
            targetPages={project.targetPages}
            bookTitle={project.title || project.topic}
            language={project.language}
          />
        )}

        {/* COMPILING (also shown during recompilation) */}
        {project.currentStage === "COMPILING" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 text-center">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Compiling Your Book
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Assembling LaTeX and generating PDF... This takes 30-60 seconds.
            </p>
          </div>
        )}

        {/* COMPLETED — download + editor */}
        {project.currentStage === "COMPLETED" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
            <DownloadPanel
              projectId={id!}
              projectTitle={project.title || project.topic}
              currentStage={project.currentStage}
              generationStatus={project.generationStatus}
              unsavedChanges={totalUnsaved}
              titlePageDirty={titlePageDirty}
              onRecompiled={() => setTitlePageDirty(false)}
              onSaveAll={handleSaveAll}
            />

            <div className="border-t border-gray-200 dark:border-gray-700 my-6" />

            {/* ★★★ Title Page Editor ★★★ */}
            <TitlePageEditor
              ref={titlePageRef}
              projectId={id!}
              currentTitle={project.title || project.topic}
              currentAuthorName={project.authorName}
              currentSubtitle={project.subtitle}
              language={project.language}
              onDirtyChange={setTitlePageFormDirty}
              onSaved={() => {
                refetch();
                setTitlePageDirty(true);
              }}
            />

            <ColophonEditor
              ref={colophonRef}
              projectId={id!}
              language={project.language}
              bookTitle={project.title || project.topic}
              authorName={project.authorName}
              currentText={project.colophonText}
              currentFontSize={project.colophonFontSize}
              currentEnabled={project.colophonEnabled ?? false}
              onDirtyChange={setColophonFormDirty}
              onSaved={() => {
                refetch();
                setTitlePageDirty(true);
              }}
            />

            <div className="border-t border-gray-200 dark:border-gray-700 my-6" />

            {!showEditor ? (
              <div className="text-center">
                <button
                  onClick={() => setShowEditor(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors font-medium"
                >
                  <Pencil className="w-5 h-5" /> Edit Book Content
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Edit any chapter, then regenerate a new PDF
                </p>
              </div>
            ) : (
              <BookEditor
                ref={editorRef}
                projectId={id!}
                onDirtyChange={setUnsavedCount}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
