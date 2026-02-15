import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Image,
  Sparkles,
  Download,
  CheckCircle,
  Pencil,
} from "lucide-react";
import DownloadPanel from "@/components/DownloadPanel";
import apiClient from "@/lib/api";
import { STAGE_LABELS, type ProjectStage } from "@/lib/types";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";
import { useState } from "react";
import StructureEditor from "@/components/StructureEditor";
import BookEditor from "@/components/BookEditor";

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
  const [showEditor, setShowEditor] = useState(false);
  const token = useAuthStore((s) => s.accessToken);

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
      if (stage === "COMPILING") return 3000; // ← NEW: poll during recompilation
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
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
        {/* PRICING — checkout */}
        {(project.currentStage === "PRICING" ||
          project.currentStage === "PAYMENT") &&
          project.paymentStatus !== "PAID" && (
            <div className="text-center">
              <CreditCard className="w-12 h-12 text-primary-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Ready to proceed?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Pay {project.priceUsdFormatted} to start generating your{" "}
                {project.targetPages}-page eBook.
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
                Pay {project.priceUsdFormatted}
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
            <div className="text-center">
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
            <StructureEditor
              projectId={project.id}
              structureJson={project.structure.structureJson}
              canRedo={!project.structureRedoUsed}
              onApprove={handleApproveStructure}
              onRefetch={() => refetch()}
            />
          )}

        {/* IMAGES */}
        {project.currentStage === "IMAGES" && (
          <div className="text-center">
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

        {/* GENERATING */}
        {project.currentStage === "GENERATING" && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Generating Your Book
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {Math.round(project.generationProgress * 100)}% complete
            </p>
            <div className="w-full max-w-md mx-auto h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(project.generationProgress * 100)}%`,
                }}
              />
            </div>
            {project.chapters?.length > 0 && (
              <div className="mt-6 text-left max-w-md mx-auto space-y-2">
                {project.chapters.map((ch: any) => (
                  <div
                    key={ch.chapterNumber}
                    className="flex items-center gap-2 text-sm"
                  >
                    {ch.status === "GENERATED" ||
                    ch.status === "LATEX_READY" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : ch.status === "GENERATING" ? (
                      <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    )}
                    <span className="text-gray-700 dark:text-gray-300">
                      Ch. {ch.chapterNumber}: {ch.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPILING (also shown during recompilation) */}
        {project.currentStage === "COMPILING" && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Compiling Your Book
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Assembling LaTeX and generating PDF... This takes 30-60 seconds.
            </p>
          </div>
        )}

        {/* COMPLETED */}
        {project.currentStage === "COMPLETED" && (
          <div>
            <DownloadPanel
              projectId={id!}
              projectTitle={project.title || project.topic}
              currentStage={project.currentStage}
              generationStatus={project.generationStatus}
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
                projectId={id!}
                onRecompileStart={() => {}}
                onRecompileDone={() => {
                  refetch();
                  toast.success("New PDF ready for download!");
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
