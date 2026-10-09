import { useT } from "@/lib/i18n";

/**
 * Withdrawal-right waiver, right above a pay button.
 * The tick is sent as `withdrawalConsent: true` with the checkout request;
 * the backend refuses any Stripe checkout without it and stores the time + IP.
 */
export default function CheckoutConsent({
  checked,
  onChange,
  showRequired,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** highlight after a pay click without the tick */
  showRequired?: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      <label
        className={
          "flex items-start gap-3 text-sm text-left rounded-xl border p-3 cursor-pointer transition-colors " +
          (showRequired && !checked
            ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20"
            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50")
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-900 cursor-pointer"
        />
        <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
          {t("payment.consent")}{" "}
          <a
            href={t("payment.consentTermsUrl")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline text-primary-600 dark:text-primary-400 hover:no-underline"
          >
            {t("payment.consentTerms")}
          </a>
        </span>
      </label>
      {showRequired && !checked && (
        <p className="text-xs text-amber-700 dark:text-amber-400 px-1">
          {t("payment.consentRequired")}
        </p>
      )}
    </div>
  );
}
