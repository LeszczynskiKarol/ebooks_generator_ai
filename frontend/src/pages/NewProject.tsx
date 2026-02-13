import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, BookOpen, DollarSign, Check } from "lucide-react";
import {
  calculatePrice,
  PAGE_SIZE_TIERS,
  MIN_PAGES,
  MAX_PAGES,
} from "@/lib/types";
import apiClient from "@/lib/api";
import toast from "react-hot-toast";

const LANGUAGES: Record<string, string> = {
  en: "English",
  pl: "Polish",
  de: "German",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
};
const STYLES: Record<string, string> = {
  modern: "Modern — Clean, contemporary",
  academic: "Academic — Formal, scholarly",
  minimal: "Minimal — Simple, elegant",
  creative: "Creative — Bold, expressive",
  business: "Business — Professional, corporate",
};
const FORMATS: Record<string, string> = {
  a5: "A5 (148×210mm) — Standard",
  b5: "B5 (176×250mm) — Larger",
  letter: "Letter (216×279mm) — US",
  a4: "A4 (210×297mm) — Full",
};

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
  const [selectedTierIdx, setSelectedTierIdx] = useState(1); // Default: Standard

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetPages: PAGE_SIZE_TIERS[1].targetPages,
      language: "en",
      stylePreset: "modern",
      bookFormat: "a5",
    },
  });

  const pages = watch("targetPages");
  const pricing = calculatePrice(pages || PAGE_SIZE_TIERS[1].targetPages);

  const selectTier = (idx: number) => {
    setSelectedTierIdx(idx);
    setValue("targetPages", PAGE_SIZE_TIERS[idx].targetPages);
  };

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

  const inputCls =
    "w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all";
  const labelCls =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const cardCls =
    "bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-5";

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">
          Create New Book
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Tell us about your eBook. Edit everything later.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Book Details */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            Book Details
          </h2>

          <div>
            <label className={labelCls}>Topic / Subject *</label>
            <textarea
              {...register("topic")}
              rows={3}
              className={inputCls + " resize-none"}
              placeholder="e.g., A comprehensive guide to starting a SaaS business in 2025..."
            />
            {errors.topic && (
              <p className="text-red-500 text-xs mt-1">
                {errors.topic.message}
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Book Title (optional)</label>
            <input
              type="text"
              {...register("title")}
              className={inputCls}
              placeholder="e.g., The SaaS Playbook"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Leave empty — we'll generate one
            </p>
          </div>

          <div>
            <label className={labelCls}>Guidelines (optional)</label>
            <textarea
              {...register("guidelines")}
              rows={3}
              className={inputCls + " resize-none"}
              placeholder="e.g., Focus on practical examples, include case studies..."
            />
          </div>
        </div>

        {/* Size & Pricing — TIER SELECTOR */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            Book Size
          </h2>

          <div className="grid gap-3">
            {PAGE_SIZE_TIERS.map((tier, idx) => {
              const tierPrice = calculatePrice(tier.targetPages);
              const isSelected = selectedTierIdx === idx;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => selectTier(idx)}
                  className={`relative flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-950 shadow-md shadow-primary-500/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "border-primary-500 bg-primary-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p
                        className={`font-semibold ${isSelected ? "text-primary-700 dark:text-primary-400" : "text-gray-900 dark:text-white"}`}
                      >
                        {tier.label}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {tier.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xl font-bold font-display ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {tierPrice.priceUsdFormatted}
                    </p>
                    <p className="text-xs text-gray-500">
                      ${(tierPrice.perPageCents / 100).toFixed(2)}/page
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hidden input for form */}
          <input
            type="hidden"
            {...register("targetPages", { valueAsNumber: true })}
          />
        </div>

        {/* Settings */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Settings
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Language</label>
              <select {...register("language")} className={inputCls}>
                {Object.entries(LANGUAGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Page Format</label>
              <select {...register("bookFormat")} className={inputCls}>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Visual Style</label>
            <div className="grid gap-2">
              {Object.entries(STYLES).map(([k, v]) => (
                <label
                  key={k}
                  className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950"
                >
                  <input
                    type="radio"
                    value={k}
                    {...register("stylePreset")}
                    className="accent-primary-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {v}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          Continue to Payment — {pricing.priceUsdFormatted}
        </button>
      </form>
    </div>
  );
}
