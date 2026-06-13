import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  BookOpen,
  DollarSign,
  ImagePlus,
  Check,
  Palette,
  Plus,
  X,
  Sparkles,
  Upload,
  BookDashed,
} from "lucide-react";
import {
  calculatePrice,
  PAGE_SIZE_TIERS,
  MIN_PAGES,
  MAX_PAGES,
} from "@/lib/types";
import apiClient from "@/lib/api";
import toast from "react-hot-toast";
import DevModelPicker from "@/components/DevModelPicker";

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
// Accent palettes matching the backend style presets — gives the text-only
// radio list a visual cue of what each style actually looks like
const STYLE_SWATCHES: Record<string, string[]> = {
  modern: ["#7C3AED", "#00C853", "#00B8D4"],
  academic: ["#1A73E8", "#00C853", "#00B8D4"],
  minimal: ["#374151", "#6B7280", "#9CA3AF"],
  creative: ["#A855F7", "#F472B6", "#38BDF8"],
  business: ["#2563EB", "#10B981", "#F59E0B"],
};
const FORMATS: Record<string, string> = {
  a5: "A5 (148×210mm) — Standard",
  b5: "B5 (176×250mm) — Larger",
  letter: "Letter (216×279mm) — US",
  a4: "A4 (210×297mm) — Full",
};
// Real paper dimensions (mm) — rendered as proportional rectangles in the picker
const FORMAT_DIMS: { key: string; label: string; desc: string; w: number; h: number }[] = [
  { key: "a5", label: "A5", desc: "Standard", w: 148, h: 210 },
  { key: "b5", label: "B5", desc: "Larger", w: 176, h: 250 },
  { key: "letter", label: "Letter", desc: "US", w: 216, h: 279 },
  { key: "a4", label: "A4", desc: "Full", w: 210, h: 297 },
];
const FORMAT_SCALE = 0.16; // mm → px for the mini page previews

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
  useAiImages: z.boolean().default(false),
  imageGuidelines: z.string().max(1000).optional(),
  imageDensity: z.enum(["standard", "rich"]).default("standard"),
  footnoteMode: z.enum(["auto", "always", "never"]).default("auto"),
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
  // Cover preference
  const [coverOption, setCoverOption] = useState<
    "none" | "generate" | "upload"
  >("none");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      targetPages: PAGE_SIZE_TIERS[1].targetPages,
      language: "en",
      stylePreset: "modern",
      bookFormat: "a5",
      useAiImages: false,
      imageDensity: "standard",
      footnoteMode: "auto",
    },
  });

  const pages = watch("targetPages");
  const pricing = calculatePrice(pages || PAGE_SIZE_TIERS[1].targetPages);

  // ── Draft autosave (localStorage) — survives accidental tab close ──
  const DRAFT_KEY = "bookforge:newProjectDraft";
  const draftLoaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // Restore only when the user actually typed something
        if (d?.form && (d.form.topic || d.form.title || d.form.guidelines)) {
          reset({ ...d.form });
          if (Array.isArray(d.selectedColors)) {
            setSelectedColors(d.selectedColors.slice(0, 3));
          }
          if (["none", "generate", "upload"].includes(d.coverOption)) {
            setCoverOption(d.coverOption);
          }
          if (
            typeof d.selectedTierIdx === "number" &&
            PAGE_SIZE_TIERS[d.selectedTierIdx]
          ) {
            setSelectedTierIdx(d.selectedTierIdx);
          }
          toast("Draft restored", { icon: "📝" });
        }
      }
    } catch {
      /* corrupted draft — ignore */
    }
    draftLoaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formValues = watch();
  const formSnapshot = JSON.stringify(formValues);
  useEffect(() => {
    if (!draftLoaded.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            form: formValues,
            selectedColors,
            coverOption,
            selectedTierIdx,
            savedAt: Date.now(),
          }),
        );
      } catch {
        /* storage full/blocked — ignore */
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSnapshot, selectedColors, coverOption, selectedTierIdx]);

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
      if (coverOption !== "none") {
        payload.coverOption = coverOption;
      }
      const { data } = await apiClient.post("/projects", payload);

      // Project created — the draft served its purpose
      localStorage.removeItem(DRAFT_KEY);

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
      <DevModelPicker />
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
            <label className={labelCls}>Book Title (optional)</label>
            <input
              type="text"
              {...register("title")}
              className={inputCls}
              placeholder="e.g., The SaaS Playbook"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Leave empty — we'll suggest one based on your topic
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls}>Topic / Subject *</label>
              <span
                className={`text-xs ${(watch("topic")?.length || 0) > 450 ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}`}
              >
                {watch("topic")?.length || 0}/500
              </span>
            </div>
            <textarea
              {...register("topic")}
              rows={3}
              maxLength={500}
              className={inputCls + " resize-none"}
              placeholder="e.g., A comprehensive guide to starting a SaaS business in 2025..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              The more specific the topic, the better the book — audience,
              scope, angle.
            </p>
            {errors.topic && (
              <p className="text-red-500 text-xs mt-1">
                {errors.topic.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls}>Guidelines (optional)</label>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {watch("guidelines")?.length || 0}/5000
              </span>
            </div>
            <textarea
              {...register("guidelines")}
              rows={3}
              maxLength={5000}
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
                  className={`relative flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                    isSelected
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-950 shadow-md shadow-primary-500/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {tier.id === "standard" && (
                    <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wide">
                      Popular
                    </span>
                  )}
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
        {/* ━━━ COVER ━━━ */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <ImagePlus className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            Book Cover
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            Choose how to handle your book cover. You can always change this
            later.
          </p>

          <div className="grid gap-2">
            {[
              {
                value: "generate" as const,
                label: "Generate cover",
                desc: "AI-designed professional cover based on your book details",
                icon: <Sparkles className="w-4 h-4" />,
                recommended: true,
              },
              {
                value: "upload" as const,
                label: "Upload own cover",
                desc: `Provide your own image (${FORMATS[watch("bookFormat") || "a5"]?.split("—")[0]?.trim() || "A5"} format)`,
                icon: <Upload className="w-4 h-4" />,
              },
              {
                value: "none" as const,
                label: "No cover",
                desc: "Start without a cover — add one later in the editor",
                icon: <BookDashed className="w-4 h-4" />,
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  coverOption === opt.value
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
                    : "border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700"
                }`}
                data-cover-option
              >
                <input
                  type="radio"
                  name="coverOption"
                  value={opt.value}
                  checked={coverOption === opt.value}
                  onChange={() => setCoverOption(opt.value)}
                  className="accent-primary-600"
                />
                <span
                  className={`flex-shrink-0 ${coverOption === opt.value ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}`}
                >
                  {opt.icon}
                </span>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-2">
                    {opt.label}
                    {opt.recommended && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-wide">
                        Recommended
                      </span>
                    )}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {opt.desc}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {/* AI illustrations toggle */}
          <label className="flex items-start gap-3 p-3 mt-1 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-colors hover:border-primary-300 dark:hover:border-primary-700 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950">
            <input
              type="checkbox"
              {...register("useAiImages")}
              className="mt-0.5 accent-primary-600"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-2">
                AI illustrations inside the book
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                  Included
                </span>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI-generated images matched to the content and your visual
                style. No extra cost.
              </p>
            </div>
          </label>

          {/* Optional steering for the image generator */}
          {watch("useAiImages") && (
            <div className="mt-1 pl-3 border-l-2 border-primary-200 dark:border-primary-800 space-y-3">
              <div>
                <label className={labelCls}>How many illustrations?</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { value: "standard", label: "Standard", desc: "~1 image per 5 pages" },
                    { value: "rich", label: "Rich", desc: "~1 image per 3 pages — great for cooking, crafts, travel" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col gap-0.5 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                        watch("imageDensity") === opt.value
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
                          : "border-gray-200 dark:border-gray-700 hover:border-primary-300"
                      }`}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        {...register("imageDensity")}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <label className={labelCls}>
                  Image preferences (optional)
                </label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {watch("imageGuidelines")?.length || 0}/1000
                </span>
              </div>
              <textarea
                {...register("imageGuidelines")}
                rows={2}
                maxLength={1000}
                className={inputCls + " resize-none"}
                placeholder="e.g., prefer photos of real workplaces, warm tones, no close-up faces..."
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Lightly steer the AI images — mood, color, subjects to prefer
                or avoid.
              </p>
            </div>
          )}
        </div>
        {/* Settings */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Settings
          </h2>

          <div className="grid gap-5">
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
              <input type="hidden" {...register("bookFormat")} />
              <div className="grid grid-cols-4 gap-2">
                {FORMAT_DIMS.map((f) => {
                  const isActive = (watch("bookFormat") || "a5") === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() =>
                        setValue("bookFormat", f.key, { shouldDirty: true })
                      }
                      title={FORMATS[f.key]}
                      className={`flex flex-col items-center gap-1.5 p-2 pt-3 rounded-lg border-2 transition-all cursor-pointer ${
                        isActive
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      {/* proportional mini page */}
                      <span
                        className="flex items-end justify-center"
                        style={{ height: 297 * FORMAT_SCALE }}
                      >
                        <span
                          className={`block rounded-[3px] border ${
                            isActive
                              ? "border-primary-500 bg-white dark:bg-primary-900/40"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          }`}
                          style={{
                            width: f.w * FORMAT_SCALE,
                            height: f.h * FORMAT_SCALE,
                            boxShadow: "inset 0 0 0 3px transparent",
                          }}
                          aria-hidden="true"
                        >
                          <span className="block mx-1.5 mt-1.5 space-y-1">
                            {[0.9, 0.75, 0.85].map((wf, i) => (
                              <span
                                key={i}
                                className={`block h-[2px] rounded-full ${isActive ? "bg-primary-300 dark:bg-primary-600" : "bg-gray-200 dark:bg-gray-600"}`}
                                style={{ width: `${wf * 100}%` }}
                              />
                            ))}
                          </span>
                        </span>
                      </span>
                      <span className="leading-tight text-center">
                        <span
                          className={`block text-xs font-semibold ${isActive ? "text-primary-700 dark:text-primary-300" : "text-gray-700 dark:text-gray-300"}`}
                        >
                          {f.label}
                        </span>
                        <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                          {f.w}×{f.h}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
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
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {v}
                  </span>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {(STYLE_SWATCHES[k] || []).map((hex) => (
                      <span
                        key={hex}
                        className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/15"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Footnotes mode */}
          <div className="mt-4">
            <label className={labelCls}>Footnotes & sources</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              {[
                { value: "auto", label: "Auto", desc: "Follows the style — Academic gets footnotes, others stay clean" },
                { value: "always", label: "With footnotes", desc: "Full source apparatus in every chapter" },
                { value: "never", label: "No footnotes", desc: "Popular style — sources woven into the text" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col gap-0.5 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                    watch("footnoteMode") === opt.value
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-950"
                      : "border-gray-200 dark:border-gray-700 hover:border-primary-300"
                  }`}
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...register("footnoteMode")}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {PAGE_SIZE_TIERS[selectedTierIdx].label} ·{" "}
                {PAGE_SIZE_TIERS[selectedTierIdx].targetPages} pages
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {(watch("bookFormat") || "a5").toUpperCase()} ·{" "}
                {LANGUAGES[watch("language") || "en"]} ·{" "}
                {(watch("stylePreset") || "modern").charAt(0).toUpperCase() +
                  (watch("stylePreset") || "modern").slice(1)}{" "}
                style ·{" "}
                {coverOption === "generate"
                  ? "AI cover"
                  : coverOption === "upload"
                    ? "Own cover"
                    : "No cover"}
                {watch("useAiImages") ? " · AI illustrations" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {selectedColors.length > 0 && (
                <span className="flex items-center gap-1" aria-hidden="true">
                  {selectedColors.map((hex) => (
                    <span
                      key={hex}
                      className="w-4 h-4 rounded-full border border-black/10 dark:border-white/15"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </span>
              )}
              <p className="text-2xl font-bold font-display text-gray-900 dark:text-white">
                {pricing.priceUsdFormatted}
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25 cursor-pointer"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          Continue to Payment — {pricing.priceUsdFormatted}
        </button>
      </form>
    </div>
  );
}
