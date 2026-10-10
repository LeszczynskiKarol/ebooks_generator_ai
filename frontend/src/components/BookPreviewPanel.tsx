import { useState } from "react";
import { BookOpen, Loader2, Pencil, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";
import { track } from "@/lib/funnel";
import StructureEditor, { type StructureData } from "@/components/StructureEditor";
import SamplePages, { type SampleState } from "@/components/SamplePages";
import CheckoutConsent from "@/components/CheckoutConsent";
import { uiLang } from "@/lib/locale";
import PaymentMethods from "@/components/PaymentMethods";

// Same shape as ProjectStructure.structureJson (+ subtitle/promise), so the
// customer edits the free preview in the very editor they get after payment.
export interface BookPreview extends StructureData {
  rejected?: boolean;
  reason?: string;
  subtitle?: string;
  promise?: string;
  editedByCustomer?: boolean;
}

interface Props {
  projectId: string;
  preview: BookPreview | null;
  /** formatted price, e.g. "$14.99" / "59,90 zł" */
  priceLabel: string;
  /** checkout currency ("usd" | "pln") — picks the payment marks */
  currency?: string | null;
  /** 1 while the order's single AI redo is unused, else 0 */
  remaining: number;
  onPreviewChange: (preview: BookPreview, remaining: number) => void;
  /** back to the order form (only in the order form flow) */
  onEdit?: () => void;
  /** right before leaving for Stripe (clear drafts, rewrite history…) */
  onBeforeCheckout?: () => void;
  /** set when no (new) preview could be generated */
  notice?: string | null;
  /** after the AI redo both versions exist; which one is chosen (1|2) */
  initialVersions?: { hasAlt: boolean; active: number };
  /** state of the free style sample (order page) */
  initialSample?: SampleState | null;
}

export default function BookPreviewPanel({
  projectId,
  preview: previewProp,
  priceLabel,
  currency,
  remaining,
  onPreviewChange,
  onEdit,
  onBeforeCheckout,
  notice,
  initialVersions,
  initialSample,
}: Props) {
  const t = useT();
  const [payLoading, setPayLoading] = useState(false);
  // Pay stays blocked while the outline is being re-planned or the sample is
  // being made — paying mid-way would start the book from a stale plan.
  const [redoing, setRedoing] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentNag, setConsentNag] = useState(false);
  const blocked = redoing
    ? t("payment.waitRedo")
    : sampleBusy
      ? t("payment.waitSample")
      : null;
  // Remount the editor whenever the AI delivers a new version.
  const [version, setVersion] = useState(0);
  // The panel is the source of truth once mounted: switch/redo/save answers
  // land here immediately (a parent refetch would arrive after the remount).
  const [preview, setPreview] = useState(previewProp);
  const apply = (pv: BookPreview, left: number) => {
    setPreview(pv);
    onPreviewChange(pv, left);
  };
  const rejected = preview?.rejected === true;
  const [versions, setVersions] = useState(
    initialVersions ?? { hasAlt: false, active: 1 },
  );

  const switchVersion = async () => {
    const { data } = await apiClient.post(`/projects/${projectId}/preview/switch`);
    apply(data.data.preview, data.data.previewRemaining ?? 0);
    setVersions({ hasAlt: true, active: data.data.previewActiveVersion });
    setVersion((v) => v + 1);
  };

  const save = async (s: StructureData) => {
    const { data } = await apiClient.put(`/projects/${projectId}/preview`, {
      suggestedTitle: s.suggestedTitle,
      chapters: s.chapters,
    });
    apply(data.data.preview, remaining);
  };

  const redo = async (feedback: string) => {
    track("preview_regenerate", { left: remaining, feedback: !!feedback.trim() });
    setRedoing(true);
    try {
      const { data } = await apiClient.post(`/projects/${projectId}/preview`, {
        regenerate: true,
        feedback,
      });
      apply(data.data.preview, data.data.remaining ?? 0);
      setVersions({
        hasAlt: !!data.data.hasAlt,
        active: data.data.activeVersion ?? 1,
      });
      setVersion((v) => v + 1);
      track("preview_shown", {
        cached: false,
        rejected: data.data.preview?.rejected === true,
        chapters: data.data.preview?.chapters?.length ?? 0,
        regenerate: true,
      });
    } catch (err: any) {
      const code = err.response?.data?.code;
      toast.error(
        code?.startsWith("PREVIEW_") && err.response?.status === 429
          ? t("newProject.previewLimit")
          : t("newProject.previewFailed"),
      );
    } finally {
      setRedoing(false);
    }
  };

  // "I like it": keep the customer's edits, then Stripe.
  const pay = async (s: StructureData) => {
    if (blocked) return;
    if (!consent) {
      setConsentNag(true);
      return;
    }
    setPayLoading(true);
    try {
      await save(s);
      track("checkout_start", { preview: true, edited: !!preview?.editedByCustomer });
      const { data } = await apiClient.post(`/projects/${projectId}/checkout`, {
        withdrawalConsent: true,
        lang: uiLang(),
      });
      track("checkout_created", { projectId });
      onBeforeCheckout?.();
      window.location.href = data.data.sessionUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("newProject.failed"));
      setPayLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-700 dark:text-gray-300">
          {notice}
        </div>
      )}

      {rejected && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-6">
          <p className="font-semibold text-gray-900 dark:text-white">
            {t("newProject.previewRejectedTitle")}
          </p>
          {preview?.reason && (
            <p className="text-gray-700 dark:text-gray-300 mt-1">{preview.reason}</p>
          )}
        </div>
      )}

      {preview && !rejected && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {t("newProject.previewBadge")}
            </p>
            {preview.subtitle && (
              <p className="text-gray-600 dark:text-gray-400">{preview.subtitle}</p>
            )}
            {preview.promise && (
              <p className="text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
                {preview.promise}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              {t("newProject.previewEditHint")}
            </p>
          </div>

          <SamplePages
            projectId={projectId}
            initial={initialSample}
            onBusyChange={setSampleBusy}
          />

          <StructureEditor
            key={version}
            projectId={projectId}
            structureJson={JSON.stringify(preview)}
            canRedo={remaining > 0}
            redoLabel={t("newProject.previewRedo")}
            onRedo={redo}
            onSave={save}
            onRefetch={() => {}}
            onApprove={pay}
            versions={
              versions.hasAlt
                ? { active: versions.active, onSwitch: switchVersion }
                : undefined
            }
            approveLabel={t("newProject.previewPay", { s: priceLabel })}
            approveLoading={payLoading}
            approveBlocked={blocked}
            beforeActions={
              <CheckoutConsent
                checked={consent}
                onChange={(v) => {
                  setConsent(v);
                  if (v) setConsentNag(false);
                }}
                showRequired={consentNag}
              />
            }
            footer={
              <div className="space-y-3 mt-3">
                <PaymentMethods currency={currency} />
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 px-1">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
                  <span>{t("newProject.previewAssurance")}</span>
                </div>
              </div>
            }
          />
        </div>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="w-full py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2 cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
          {t("newProject.previewEdit")}
        </button>
      )}
    </div>
  );
}

/** Loading state while the preview is generated (~15-30 s). */
export function BookPreviewLoading() {
  const t = useT();
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary-600 mx-auto mb-4" />
      <p className="text-lg font-semibold text-gray-900 dark:text-white">
        {t("newProject.previewLoadingTitle")}
      </p>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        {t("newProject.previewLoadingText")}
      </p>
    </div>
  );
}
