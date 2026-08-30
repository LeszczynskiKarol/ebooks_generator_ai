import { useEffect, useMemo, useRef, useState } from "react";
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
import { useT, useLangStore, translate, type AppLang } from "@/lib/i18n";
import { useMoney } from "@/lib/money";

// Language keys → i18n label keys (the select VALUES en/pl/de… stay code)
// Only the two languages the product is edited/proofread in. Default follows
// the UI locale (EN site → en, /pl → pl) — see defaultValues below.
const LANGUAGE_KEYS: Record<string, string> = {
  en: "newProject.langEn",
  pl: "newProject.langPl",
};
const STYLE_KEYS: Record<string, string> = {
  modern: "newProject.styleModern",
  academic: "newProject.styleAcademic",
  minimal: "newProject.styleMinimal",
  creative: "newProject.styleCreative",
  business: "newProject.styleBusiness",
};
const STYLE_NAME_KEYS: Record<string, string> = {
  modern: "newProject.styleNameModern",
  academic: "newProject.styleNameAcademic",
  minimal: "newProject.styleNameMinimal",
  creative: "newProject.styleNameCreative",
  business: "newProject.styleNameBusiness",
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
const FORMAT_KEYS: Record<string, string> = {
  a5: "newProject.formatA5",
  b5: "newProject.formatB5",
  letter: "newProject.formatLetter",
  a4: "newProject.formatA4",
};
// Real paper dimensions (mm) — rendered as proportional rectangles in the picker.
// `label` stays a literal (A5/B5/Letter/A4 are format codes); `descKey` is i18n.
const FORMAT_DIMS: { key: string; label: string; descKey: string; w: number; h: number }[] = [
  { key: "a5", label: "A5", descKey: "newProject.formatDescStandard", w: 148, h: 210 },
  { key: "b5", label: "B5", descKey: "newProject.formatDescLarger", w: 176, h: 250 },
  { key: "letter", label: "Letter", descKey: "newProject.formatDescUs", w: 216, h: 279 },
  { key: "a4", label: "A4", descKey: "newProject.formatDescFull", w: 210, h: 297 },
];
const FORMAT_SCALE = 0.16; // mm → px for the mini page previews

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Color palette — 20 curated presets
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PresetColor {
  hex: string;
  nameKey: string;
}

const COLOR_PALETTE: PresetColor[] = [
  { hex: "#FFFFFF", nameKey: "newProject.colorWhite" },
  { hex: "#000000", nameKey: "newProject.colorBlack" },
  { hex: "#1E40AF", nameKey: "newProject.colorRoyalBlue" },
  { hex: "#2563EB", nameKey: "newProject.colorBlue" },
  { hex: "#0EA5E9", nameKey: "newProject.colorSkyBlue" },
  { hex: "#06B6D4", nameKey: "newProject.colorCyan" },
  { hex: "#7C3AED", nameKey: "newProject.colorViolet" },
  { hex: "#9333EA", nameKey: "newProject.colorPurple" },
  { hex: "#A855F7", nameKey: "newProject.colorLavender" },
  { hex: "#EC4899", nameKey: "newProject.colorPink" },
  { hex: "#059669", nameKey: "newProject.colorEmerald" },
  { hex: "#16A34A", nameKey: "newProject.colorGreen" },
  { hex: "#65A30D", nameKey: "newProject.colorLime" },
  { hex: "#14B8A6", nameKey: "newProject.colorTeal" },
  { hex: "#DC2626", nameKey: "newProject.colorRed" },
  { hex: "#EA580C", nameKey: "newProject.colorOrange" },
  { hex: "#D97706", nameKey: "newProject.colorAmber" },
  { hex: "#CA8A04", nameKey: "newProject.colorGold" },
  { hex: "#1E293B", nameKey: "newProject.colorSlate" },
  { hex: "#374151", nameKey: "newProject.colorGray" },
  { hex: "#78350F", nameKey: "newProject.colorBrown" },
  { hex: "#831843", nameKey: "newProject.colorRose" },
];

const COLOR_ROLE_KEYS = [
  "newProject.colorRolePrimary",
  "newProject.colorRoleSecondary",
  "newProject.colorRoleTertiary",
];

const makeSchema = (lang: AppLang) =>
  z.object({
    topic: z
      .string()
      .min(5, translate(lang, "newProject.errMinChars"))
      .max(500),
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
type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function NewProject() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const schema = useMemo(() => makeSchema(lang), [lang]);
  const [loading, setLoading] = useState(false);
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTierIdx, setSelectedTierIdx] = useState(1);

  // Admin-only: enable the "Autopilot (Routines)" button that bypasses payment.
  useEffect(() => {
    apiClient
      .get("/auth/me")
      .then(({ data }) => setIsAdmin(data.data?.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, []);

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
      // Default the BOOK language to the UI locale — a PL visitor most likely
      // wants a Polish book (was hardcoded "en" even on /pl).
      language: lang === "pl" ? "pl" : "en",
      stylePreset: "modern",
      bookFormat: "a5",
      useAiImages: false,
      imageDensity: "standard",
      footnoteMode: "auto",
    },
  });

  const pages = watch("targetPages");
  const pricing = calculatePrice(pages || PAGE_SIZE_TIERS[1].targetPages);
  const { formatUsdCents, currency } = useMoney();

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
          toast(t("newProject.draftRestored"), { icon: "📝" });
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
        toast.error(t("newProject.maxColors"));
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
      toast.error(t("newProject.invalidHex"));
      return;
    }
    if (selectedColors.length >= 3) {
      toast.error(t("newProject.maxColors"));
      return;
    }
    if (selectedColors.includes(cleaned)) {
      toast.error(t("newProject.colorAlreadySelected"));
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
      payload.currency = currency; // "pln" for the Polish UI → Stripe charges in zł
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
        toast.success(t("newProject.projectCreated"));
        navigate(`/projects/${data.data.project.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("newProject.failed"));
    } finally {
      setLoading(false);
    }
  };

  // Admin "Autopilot (Routines)" — same form, but skips payment + the manual
  // structure-approval gate and runs the full pipeline unattended. Hits the
  // SAME backend path a Routine would (POST /api/admin/books/generate); the
  // logged-in admin's JWT authorizes it.
  const onAutopilot = async (form: FormData) => {
    setAutopilotLoading(true);
    try {
      // Fires the Anthropic Claude Code ROUTINE (subscription), which authors
      // the book and ingests it. No project exists yet — it appears once the
      // routine finishes, so we don't navigate to one.
      const payload: Record<string, unknown> = { ...form };
      if (selectedColors.length > 0) payload.customColors = selectedColors;
      const { data } = await apiClient.post("/admin/routine/run-book", payload);
      localStorage.removeItem(DRAFT_KEY);
      const sessionUrl =
        data?.data?.claude_code_session_url ||
        data?.data?.session_url ||
        data?.data?.url;
      toast.success(
        "Rutyna odpalona (subskrypcja) — książka pojawi się na liście po jej zakończeniu",
        { duration: 8000 },
      );
      if (sessionUrl) window.open(sessionUrl, "_blank");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("newProject.failed"));
    } finally {
      setAutopilotLoading(false);
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
          {t("newProject.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t("newProject.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Book Details */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            {t("newProject.bookDetails")}
          </h2>

          <div>
            <label className={labelCls}>{t("newProject.bookTitleLabel")}</label>
            <input
              type="text"
              {...register("title")}
              className={inputCls}
              placeholder={t("newProject.bookTitlePlaceholder")}
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t("newProject.bookTitleHelp")}
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls}>{t("newProject.topicLabel")}</label>
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
              placeholder={t("newProject.topicPlaceholder")}
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {t("newProject.topicHelp")}
            </p>
            {errors.topic && (
              <p className="text-red-500 text-xs mt-1">
                {errors.topic.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelCls}>{t("newProject.guidelinesLabel")}</label>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {watch("guidelines")?.length || 0}/5000
              </span>
            </div>
            <textarea
              {...register("guidelines")}
              rows={3}
              maxLength={5000}
              className={inputCls + " resize-none"}
              placeholder={t("newProject.guidelinesPlaceholder")}
            />
          </div>
        </div>

        {/* Size & Pricing */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            {t("newProject.bookSize")}
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
                      {t("newProject.popular")}
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
                        {t(`newProject.tierLabel.${tier.id}`)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(`newProject.tierDesc.${tier.id}`)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xl font-bold font-display ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {formatUsdCents(tierPrice.priceUsdCents)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatUsdCents(tierPrice.perPageCents)}
                      {t("newProject.perPage")}
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
            {t("newProject.colorScheme")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            {t("newProject.colorSchemeDesc")}
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
                        ? t("newProject.rolePrimary")
                        : idx === 1
                          ? t("newProject.roleSecondary")
                          : t("newProject.roleTertiary")}
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
                ? t("newProject.chooseColors")
                : t("newProject.colorsSelected", { s: selectedColors.length })}
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
                    title={`${t(color.nameKey)} (${color.hex})`}
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
                {t("newProject.addCustomColor")}
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
                  {t("newProject.add")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomHex("#");
                  }}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t("newProject.cancel")}
                </button>
              </div>
            )}
          </div>

          {/* Color role explanation */}
          {selectedColors.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <p className="font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                {t("newProject.howColorsUsed")}
              </p>
              {selectedColors.map((hex, idx) => (
                <p key={hex} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  {t(COLOR_ROLE_KEYS[idx])}
                </p>
              ))}
              {selectedColors.length === 1 && (
                <p className="text-gray-400 italic mt-1">
                  {t("newProject.oneColorNote")}
                </p>
              )}
            </div>
          )}
        </div>
        {/* ━━━ COVER ━━━ */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <ImagePlus className="w-5 h-5 text-primary-600 dark:text-primary-400" />{" "}
            {t("newProject.bookCover")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2">
            {t("newProject.bookCoverDesc")}
          </p>

          <div className="grid gap-2">
            {[
              {
                value: "generate" as const,
                label: t("newProject.coverGenerateLabel"),
                desc: t("newProject.coverGenerateDesc"),
                icon: <Sparkles className="w-4 h-4" />,
                recommended: true,
              },
              {
                value: "upload" as const,
                label: t("newProject.coverUploadLabel"),
                desc: t("newProject.coverUploadDesc", {
                  s:
                    t(FORMAT_KEYS[watch("bookFormat") || "a5"] || "newProject.formatA5")
                      .split("—")[0]
                      ?.trim() || "A5",
                }),
                icon: <Upload className="w-4 h-4" />,
              },
              {
                value: "none" as const,
                label: t("newProject.coverNoneLabel"),
                desc: t("newProject.coverNoneDesc"),
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
                        {t("newProject.recommended")}
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
                {t("newProject.aiIllustrations")}
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                  {t("newProject.included")}
                </span>
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("newProject.aiIllustrationsDesc")}
              </p>
            </div>
          </label>

          {/* Optional steering for the image generator */}
          {watch("useAiImages") && (
            <div className="mt-1 pl-3 border-l-2 border-primary-200 dark:border-primary-800 space-y-3">
              <div>
                <label className={labelCls}>{t("newProject.howManyIllustrations")}</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { value: "standard", label: t("newProject.densityStandardLabel"), desc: t("newProject.densityStandardDesc") },
                    { value: "rich", label: t("newProject.densityRichLabel"), desc: t("newProject.densityRichDesc") },
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
                  {t("newProject.imagePrefsLabel")}
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
                placeholder={t("newProject.imagePrefsPlaceholder")}
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {t("newProject.imagePrefsHelp")}
              </p>
            </div>
          )}
        </div>
        {/* Settings */}
        <div className={cardCls}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("newProject.settings")}
          </h2>

          <div className="grid gap-5">
            <div>
              <label className={labelCls}>{t("newProject.languageLabel")}</label>
              <select {...register("language")} className={inputCls}>
                {Object.entries(LANGUAGE_KEYS).map(([k, vKey]) => (
                  <option key={k} value={k}>
                    {t(vKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("newProject.pageFormatLabel")}</label>
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
                      title={t(FORMAT_KEYS[f.key])}
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
            <label className={labelCls}>{t("newProject.visualStyleLabel")}</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t("newProject.visualStyleHelp")}
            </p>
            <div className="grid gap-2">
              {Object.entries(STYLE_KEYS).map(([k, vKey]) => (
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
                    {t(vKey)}
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
            <label className={labelCls}>{t("newProject.footnotesLabel")}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              {[
                { value: "auto", label: t("newProject.footnoteAutoLabel"), desc: t("newProject.footnoteAutoDesc") },
                { value: "always", label: t("newProject.footnoteAlwaysLabel"), desc: t("newProject.footnoteAlwaysDesc") },
                { value: "never", label: t("newProject.footnoteNeverLabel"), desc: t("newProject.footnoteNeverDesc") },
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
                {t(`newProject.tierLabel.${PAGE_SIZE_TIERS[selectedTierIdx].id}`)} ·{" "}
                {t("newProject.pages", {
                  s: PAGE_SIZE_TIERS[selectedTierIdx].targetPages,
                })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {(watch("bookFormat") || "a5").toUpperCase()} ·{" "}
                {t(LANGUAGE_KEYS[watch("language") || "en"] || "newProject.langEn")} ·{" "}
                {t(STYLE_NAME_KEYS[watch("stylePreset") || "modern"] || "newProject.styleNameModern")}{" "}
                {t("newProject.styleSuffix")} ·{" "}
                {coverOption === "generate"
                  ? t("newProject.summaryAiCover")
                  : coverOption === "upload"
                    ? t("newProject.summaryOwnCover")
                    : t("newProject.summaryNoCover")}
                {watch("useAiImages")
                  ? ` · ${t("newProject.summaryAiIllustrations")}`
                  : ""}
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
                {formatUsdCents(pricing.priceUsdCents)}
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
          {t("newProject.continueToPayment", { s: formatUsdCents(pricing.priceUsdCents) })}
        </button>

        {/* Admin-only: separate Autopilot/Routines trigger — skips payment and
            runs the whole pipeline unattended. Standard payment flow above is
            untouched. */}
        {isAdmin && (
          <button
            type="button"
            disabled={autopilotLoading}
            onClick={handleSubmit(onAutopilot)}
            className="w-full py-3 border-2 border-dashed border-amber-400 text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {autopilotLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            ⚡ Autopilot (Routines) — admin, bez płatności
          </button>
        )}
      </form>
    </div>
  );
}
