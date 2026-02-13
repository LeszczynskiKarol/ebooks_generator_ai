import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, BookOpen, DollarSign } from "lucide-react";
import { calculatePrice, MIN_PAGES, MAX_PAGES } from "@/lib/types";
import apiClient from "@/lib/api";
import toast from "react-hot-toast";

const LANGUAGES: Record<string, string> = { en: "English", pl: "Polish", de: "German", es: "Spanish", fr: "French", it: "Italian", pt: "Portuguese", nl: "Dutch" };
const STYLES: Record<string, string> = { modern: "Modern — Clean, contemporary", academic: "Academic — Formal, scholarly", minimal: "Minimal — Simple, elegant", creative: "Creative — Bold, expressive", business: "Business — Professional, corporate" };
const FORMATS: Record<string, string> = { a5: "A5 (148×210mm) — Standard", b5: "B5 (176×250mm) — Larger", letter: "Letter (216×279mm) — US", a4: "A4 (210×297mm) — Full" };

const schema = z.object({
  topic: z.string().min(5, "Min 5 chars").max(500),
  title: z.string().max(200).optional(),
  targetPages: z.number().min(MIN_PAGES).max(MAX_PAGES),
  language: z.string().default("en"),
  guidelines: z.string().max(5000).optional(),
  stylePreset: z.string().default("modern"),
  bookFormat: z.string().default("a5"),
});
type FormData = z.infer<typeof schema>;

export default function NewProject() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { targetPages: 50, language: "en", stylePreset: "modern", bookFormat: "a5" },
  });

  const pages = watch("targetPages");
  const pricing = calculatePrice(pages || 50);

  const onSubmit = async (form: FormData) => {
    setLoading(true);
    try {
      const { data } = await apiClient.post("/projects", form);
      toast.success("Project created!");
      navigate(`/projects/${data.data.project.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const cardCls = "bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-5";

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">Create New Book</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Tell us about your eBook. Edit everything later.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Book Details */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Book Details
          </h2>

          <div>
            <label className={labelCls}>Topic / Subject *</label>
            <textarea {...register("topic")} rows={3} className={inputCls + " resize-none"}
              placeholder="e.g., A comprehensive guide to starting a SaaS business in 2025..." />
            {errors.topic && <p className="text-red-500 text-xs mt-1">{errors.topic.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Book Title (optional)</label>
            <input type="text" {...register("title")} className={inputCls} placeholder="e.g., The SaaS Playbook" />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Leave empty — we'll generate one</p>
          </div>

          <div>
            <label className={labelCls}>Guidelines (optional)</label>
            <textarea {...register("guidelines")} rows={3} className={inputCls + " resize-none"}
              placeholder="e.g., Focus on practical examples, include case studies..." />
          </div>
        </div>

        {/* Size & Pricing */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Size & Pricing
          </h2>

          <div>
            <div className="flex justify-between mb-2">
              <label className={labelCls}>Target Pages</label>
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-display">{pages} pages</span>
            </div>
            <Controller name="targetPages" control={control} render={({ field }) => (
              <input type="range" min={MIN_PAGES} max={MAX_PAGES} value={field.value} onChange={(e) => field.onChange(+e.target.value)}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600" />
            )} />
            <div className="flex justify-between mt-1 text-xs text-gray-500"><span>{MIN_PAGES}</span><span>{MAX_PAGES}</span></div>
          </div>

          <div className="bg-primary-50 dark:bg-primary-950 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-700 dark:text-primary-400 font-medium">{pricing.tier.label} Plan</p>
              <p className="text-xs text-primary-600 dark:text-primary-500">${(pricing.perPageCents / 100).toFixed(2)} per page</p>
            </div>
            <div className="text-3xl font-bold text-primary-700 dark:text-primary-400 font-display">{pricing.priceUsdFormatted}</div>
          </div>
        </div>

        {/* Settings */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Language</label>
              <select {...register("language")} className={inputCls}>
                {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Page Format</label>
              <select {...register("bookFormat")} className={inputCls}>
                {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Visual Style</label>
            <div className="grid gap-2">
              {Object.entries(STYLES).map(([k, v]) => (
                <label key={k} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950">
                  <input type="radio" value={k} {...register("stylePreset")} className="accent-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading}
          className="w-full py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25">
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          Continue to Payment — {pricing.priceUsdFormatted}
        </button>
      </form>
    </div>
  );
}
