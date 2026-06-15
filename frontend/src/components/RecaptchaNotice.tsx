// Required disclosure when the reCAPTCHA badge is hidden:
// https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge
import { useT } from "@/lib/i18n";

export default function RecaptchaNotice() {
  const t = useT();
  return (
    <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
      {t("recaptchaPre")}{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        {t("recaptchaPrivacy")}
      </a>{" "}
      {t("recaptchaAnd")}{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        {t("recaptchaTerms")}
      </a>{" "}
      {t("recaptchaPost")}
    </p>
  );
}
