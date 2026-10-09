// i18n strings for: payment  (keys prefixed "payment.")
// The withdrawal waiver is a legal statement (consumer law: digital content
// supplied before the 14-day withdrawal period ends) — every UI language
// needs its own wording; the backend refuses checkout without the tick.
export const en: Record<string, string> = {
  "payment.methodsLabel": "Accepted payment methods",
  "payment.consent":
    "I request that work on my book starts immediately, before the 14-day withdrawal period ends, and I acknowledge that I lose my right of withdrawal once generation of the book begins.",
  "payment.consentTerms": "Terms",
  "payment.consentTermsUrl": "https://inkmagnet.com/terms/",
  "payment.consentRequired": "Tick the box above to continue to payment.",
  "payment.waitRedo": "Wait for the new version of the outline. You can pay once it is ready.",
  "payment.waitSample": "Your sample pages are being prepared. You can pay once they are ready.",
};

export const pl: Record<string, string> = {
  "payment.methodsLabel": "Akceptowane metody płatności",
  "payment.consent":
    "Żądam rozpoczęcia pracy nad moją książką przed upływem 14-dniowego terminu na odstąpienie od umowy i przyjmuję do wiadomości, że z chwilą rozpoczęcia generowania książki tracę prawo do odstąpienia od umowy.",
  "payment.consentTerms": "Regulamin",
  "payment.consentTermsUrl": "https://inkmagnet.com/pl/regulamin/",
  "payment.consentRequired": "Zaznacz pole powyżej, aby przejść do płatności.",
  "payment.waitRedo": "Poczekaj na nową wersję planu. Zapłacisz, gdy będzie gotowa.",
  "payment.waitSample": "Przygotowujemy strony próbki. Zapłacisz, gdy będą gotowe.",
};
