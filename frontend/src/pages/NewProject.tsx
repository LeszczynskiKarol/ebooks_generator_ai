import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  BookOpen,
  DollarSign,
  Check,
  Palette,
  Plus,
  X,
} from "lucide-react";
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Color palette — 20 curated presets
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PresetColor {
  hex: string;
  name: string;
}

const COLOR_PALETTE: PresetColor[] = [
  { hex: "#FFFFFF", name: "White" },
  { hex: "#000000", name: "Black" },
  { hex: "#1E40AF", name: "Royal Blue" },
  { hex: "#2563EB", name: "Blue" },
  { hex: "#0EA5E9", name: "Sky Blue" },
  { hex: "#06B6D4", name: "Cyan" },
  { hex: "#7C3AED", name: "Violet" },
  { hex: "#9333EA", name: "Purple" },
  { hex: "#A855F7", name: "Lavender" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#059669", name: "Emerald" },
  { hex: "#16A34A", name: "Green" },
  { hex: "#65A30D", name: "Lime" },
  { hex: "#14B8A6", name: "Teal" },
  { hex: "#DC2626", name: "Red" },
  { hex: "#EA580C", name: "Orange" },
  { hex: "#D97706", name: "Amber" },
  { hex: "#CA8A04", name: "Gold" },
  { hex: "#1E293B", name: "Slate" },
  { hex: "#374151", name: "Gray" },
  { hex: "#78350F", name: "Brown" },
  { hex: "#831843", name: "Rose" },
];

const COLOR_ROLES = [
  "Primary — chapter headings, main accents",
  "Secondary — boxes, highlights, tips",
  "Tertiary — details, borders, subtle elements",
];

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
  const [selectedTierIdx, setSelectedTierIdx] = useState(1);

  // Color state
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customHex, setCustomHex] = useState("#");

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

  // ── Color helpers ──
  const toggleColor = (hex: string) => {
    setSelectedColors((prev) => {
      if (prev.includes(hex)) return prev.filter((c) => c !== hex);
      if (prev.length >= 3) {
        toast.error("Maximum 3 colors");
        return prev;
      }
      return [...prev, hex];
    });
  };

  const removeColor = (hex: string) => {
    setSelectedColors((prev) => prev.filter((c) => c !== hex));
  };

  const addCustomColor = () => {
    const cleaned = customHex.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(cleaned)) {
      toast.error("Enter a valid hex color (e.g. #FF5500)");
      return;
    }
    if (selectedColors.length >= 3) {
      toast.error("Maximum 3 colors");
      return;
    }
    if (selectedColors.includes(cleaned)) {
      toast.error("Color already selected");
      return;
    }
    setSelectedColors((prev) => [...prev, cleaned]);
    setCustomHex("#");
    setShowCustomInput(false);
  };

  const onSubmit = async (form: FormData) => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (selectedColors.length > 0) {
        payload.customColors = selectedColors;
      }
      const { data } = await apiClient.post("/projects", payload);

      // Redirect to Stripe checkout immediately
      if (data.data.sessionUrl) {
        window.location.href = data.data.sessionUrl;
      } else {
        // Fallback if Stripe session wasn't created (shouldn't happen)
        toast.success("Project created!");
        navigate(`/projects/${data.data.project.id}`);
      }
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

        {/* Size & Pricing */}
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

          <input
            type="hidden"
            {...register("targetPages", { valueAsNumber: true })}
          />
        </div>

        {/* ━━━ COLOR SCHEME ━━━ */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <Palette className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            Color Scheme
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            Pick 1–3 accent colors for headings, boxes, and tables. Leave empty
            for style defaults.
          </p>

          {/* Selected colors strip */}
          {selectedColors.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {selectedColors.map((hex, idx) => (
                <div
                  key={hex}
                  className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2"
                >
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-white dark:border-gray-600 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      {idx === 0
                        ? "Primary"
                        : idx === 1
                          ? "Secondary"
                          : "Tertiary"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {hex}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeColor(hex)}
                    className="ml-1 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Color grid */}
          <div>
            <p className={labelCls}>
              {selectedColors.length === 0
                ? "Choose colors"
                : `${selectedColors.length}/3 selected`}
            </p>
            <div className="grid grid-cols-11 gap-2">
              {COLOR_PALETTE.map((color) => {
                const isActive = selectedColors.includes(color.hex);
                const orderIdx = selectedColors.indexOf(color.hex);
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => toggleColor(color.hex)}
                    title={`${color.name} (${color.hex})`}
                    className={`relative w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                      isActive
                        ? "border-gray-900 dark:border-white shadow-lg scale-110 ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-900"
                        : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    style={{
                      backgroundColor: color.hex,
                      boxShadow:
                        color.hex === "#FFFFFF"
                          ? "inset 0 0 0 1px #D1D5DB"
                          : undefined,
                    }}
                  >
                    {isActive && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-5 h-5 rounded-full bg-white/90 dark:bg-black/60 flex items-center justify-center text-[10px] font-bold text-gray-900 dark:text-white">
                          {orderIdx + 1}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom color input */}
          <div>
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                disabled={selectedColors.length >= 3}
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add custom color
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 flex-shrink-0"
                  style={{
                    backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customHex)
                      ? customHex
                      : "#E5E7EB",
                  }}
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (!v.startsWith("#")) v = "#" + v;
                    setCustomHex(v.slice(0, 7).toUpperCase());
                  }}
                  placeholder="#FF5500"
                  maxLength={7}
                  className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomColor();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomColor}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomHex("#");
                  }}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Color role explanation */}
          {selectedColors.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <p className="font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                How your colors will be used:
              </p>
              {selectedColors.map((hex, idx) => (
                <p key={hex} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  {COLOR_ROLES[idx]}
                </p>
              ))}
              {selectedColors.length === 1 && (
                <p className="text-gray-400 italic mt-1">
                  With 1 color, complementary shades are generated
                  automatically.
                </p>
              )}
            </div>
          )}
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
