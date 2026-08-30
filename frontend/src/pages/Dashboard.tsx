import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  BookOpen,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  CreditCard,
  Eye,
  ImageIcon,
} from "lucide-react";
import apiClient from "@/lib/api";
import { track } from "@/lib/funnel";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n";
import {
  type ProjectSummary,
  type ProjectStage,
} from "@/lib/types";

// ── Status badge: color + icon per stage ──
const STAGE_BADGE: Record<
  ProjectStage,
  { classes: string; icon: React.ReactNode; spin?: boolean }
> = {
  BRIEF: {
    classes:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  PRICING: {
    classes:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  PAYMENT: {
    classes:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
  STRUCTURE: {
    classes:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    spin: true,
  },
  STRUCTURE_REVIEW: {
    classes:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
    icon: <Eye className="w-3.5 h-3.5" />,
  },
  IMAGES: {
    classes:
      "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border-violet-200 dark:border-violet-500/30",
    icon: <ImageIcon className="w-3.5 h-3.5" />,
  },
  GENERATING: {
    classes:
      "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400 border-primary-200 dark:border-primary-500/30",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    spin: true,
  },
  COMPILING: {
    classes:
      "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400 border-primary-200 dark:border-primary-500/30",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    spin: true,
  },
  COMPLETED: {
    classes:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  ERROR: {
    classes:
      "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-200 dark:border-red-500/30",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ stage }: { stage: ProjectStage }) {
  const t = useT();
  const badge = STAGE_BADGE[stage] ?? STAGE_BADGE.BRIEF;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium backdrop-blur-sm ${badge.classes}`}
    >
      {badge.icon}
      {t("common.stage." + stage)}
    </span>
  );
}

// ── Cover area: real thumbnail when available, styled placeholder otherwise ──
function CoverThumb({ project }: { project: ProjectSummary }) {
  const t = useT();
  const token = useAuthStore((s) => s.accessToken);
  const [failed, setFailed] = useState(false);

  const hasCover = project.coverType && project.coverType !== "NONE";
  const showImage = hasCover && !failed && token;
  // cache-bust when the cover changes
  const version = project.coverUpdatedAt || String(project.currentVersion ?? 0);
  const thumbUrl = `/api/projects/${project.id}/cover/thumb?token=${token}&v=${encodeURIComponent(version)}`;

  return (
    <div className="relative aspect-[210/297] overflow-hidden bg-gray-100 dark:bg-gray-800">
      {showImage ? (
        <img
          src={thumbUrl}
          alt={t("dashboard.coverAlt", { s: project.title || project.topic })}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-700 dark:from-primary-600 dark:via-primary-700 dark:to-indigo-900">
          <BookOpen
            className="absolute -right-5 -bottom-5 w-28 h-28 text-white/10"
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col justify-center p-5">
            <div className="w-8 h-0.5 bg-white/60 mb-3" aria-hidden="true" />
            <p className="text-white font-display font-bold leading-snug line-clamp-4 text-[15px]">
              {project.title || project.topic}
            </p>
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="absolute top-2.5 left-2.5">
        <StatusBadge stage={project.currentStage} />
      </div>

      {/* Progress overlay while generating/compiling */}
      {(project.currentStage === "GENERATING" ||
        project.currentStage === "COMPILING") && (
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-white/90">
              {project.currentStage === "COMPILING"
                ? t("dashboard.compiling")
                : t("dashboard.writingChapters")}
            </span>
            <span className="text-[11px] font-semibold text-white">
              {Math.round(project.generationProgress * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(project.generationProgress * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const t = useT();
  const created = new Date(project.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <CoverThumb project={project} />

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {project.title || project.topic}
        </h3>
        {project.title && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            {project.topic}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span>{t("dashboard.pages", { s: project.targetPages })}</span>
            {project.bookFormat && (
              <>
                <span
                  className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"
                  aria-hidden="true"
                />
                <span className="uppercase">{project.bookFormat}</span>
              </>
            )}
          </span>
          <span>{created}</span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="aspect-[210/297] bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/5" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-2/5" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await apiClient.get("/projects");
      if (Array.isArray(res.data?.data) && res.data.data.length === 0) {
        track("dashboard_empty");
      }
      return res.data.data as ProjectSummary[];
    },
  });

  const projects = data || [];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">
              {t("dashboard.myBooks")}
            </h1>
            {!isLoading && projects.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300">
                {projects.length}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium shadow-sm cursor-pointer"
        >
          <Plus className="w-5 h-5" /> {t("dashboard.newBook")}
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t("dashboard.noBooks")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {t("dashboard.emptyDesc")}
          </p>
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium cursor-pointer"
          >
            <Plus className="w-5 h-5" /> {t("dashboard.createFirst")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
