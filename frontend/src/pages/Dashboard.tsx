import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import apiClient from "@/lib/api";
import { STAGE_LABELS, type ProjectSummary, type ProjectStage } from "@/lib/types";

const stageIcon: Record<string, React.ReactNode> = {
  BRIEF: <Clock className="w-4 h-4 text-gray-400" />,
  PRICING: <Clock className="w-4 h-4 text-gray-400" />,
  PAYMENT: <Clock className="w-4 h-4 text-amber-500" />,
  STRUCTURE: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  STRUCTURE_REVIEW: <BookOpen className="w-4 h-4 text-blue-500" />,
  IMAGES: <BookOpen className="w-4 h-4 text-purple-500" />,
  GENERATING: <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />,
  COMPILING: <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />,
  COMPLETED: <CheckCircle className="w-4 h-4 text-green-500" />,
  ERROR: <AlertCircle className="w-4 h-4 text-red-500" />,
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await apiClient.get("/projects");
      return res.data.data as ProjectSummary[];
    },
  });

  const projects = data || [];

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">My Books</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your eBook projects</p>
        </div>
        <Link to="/projects/new"
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium shadow-sm">
          <Plus className="w-5 h-5" /> New Book
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No books yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create your first professional eBook with AI. Takes less than a minute.
          </p>
          <Link to="/projects/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium">
            <Plus className="w-5 h-5" /> Create Your First Book
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-6 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {p.title || p.topic}
                  </h3>
                  {p.title && <p className="text-sm text-gray-500 dark:text-gray-500 mb-2">{p.topic}</p>}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{p.targetPages} pages</span>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      {stageIcon[p.currentStage]}
                      <span>{STAGE_LABELS[p.currentStage as ProjectStage]}</span>
                    </div>
                    {p.priceUsdFormatted && (
                      <>
                        <span>•</span>
                        <span>{p.priceUsdFormatted}</span>
                      </>
                    )}
                  </div>
                </div>
                {p.currentStage === "GENERATING" && (
                  <div className="w-20">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.round(p.generationProgress * 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-right">{Math.round(p.generationProgress * 100)}%</p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
