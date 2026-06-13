// Required disclosure when the reCAPTCHA badge is hidden:
// https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge
export default function RecaptchaNotice() {
  return (
    <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
      This site is protected by reCAPTCHA and the Google{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        Privacy Policy
      </a>{" "}
      and{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        Terms of Service
      </a>{" "}
      apply.
    </p>
  );
}
