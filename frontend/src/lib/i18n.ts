// Lightweight UI i18n for the app (auth screens today, extensible later).
// Language resolution priority:
//   1. ?lang=pl|en in the URL (passed from the localized landing) — persisted
//   2. localStorage "im_lang" (a previous explicit choice)
//   3. navigator.language (pl* → pl, otherwise en)
import { create } from "zustand";
import * as common from "./dict/common";
import * as layout from "./dict/layout";
import * as dashboard from "./dict/dashboard";
import * as newProject from "./dict/newProject";
import * as projectDetail from "./dict/projectDetail";
import * as forgotReset from "./dict/forgotReset";
import * as generation from "./dict/generation";
import * as structure from "./dict/structure";
import * as download from "./dict/download";
import * as editor from "./dict/editor";
import * as cover from "./dict/cover";
import * as titlePage from "./dict/titlePage";
import * as imageLibrary from "./dict/imageLibrary";
import * as admin from "./dict/admin";
import * as sample from "./dict/sample";
import * as payment from "./dict/payment";
import * as feedback from "./dict/feedback";
import * as aiEdit from "./dict/aiEdit";

export type AppLang = "en" | "pl" | "de";
export const APP_LANGS: AppLang[] = ["en", "pl", "de"];
const isAppLang = (v: unknown): v is AppLang => APP_LANGS.includes(v as AppLang);

export function resolveLang(): AppLang {
  if (typeof window === "undefined") return "en";
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isAppLang(q)) {
      localStorage.setItem("im_lang", q);
      return q;
    }
    const stored = localStorage.getItem("im_lang");
    if (isAppLang(stored)) return stored;
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("pl") ? "pl" : nav.startsWith("de") ? "de" : "en";
  } catch {
    return "en";
  }
}

interface LangState {
  lang: AppLang;
  setLang: (l: AppLang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: resolveLang(),
  setLang: (l) => {
    try {
      localStorage.setItem("im_lang", l);
    } catch {
      /* storage blocked — ignore */
    }
    set({ lang: l });
  },
}));

// ── Dictionary ──
type Dict = Record<string, string>;

const en: Dict = {
  // login
  welcomeBack: "Welcome back",
  signInToContinue: "Sign in to continue creating",
  email: "Email",
  password: "Password",
  forgotPassword: "Forgot password?",
  signIn: "Sign In",
  noAccount: "Don't have an account?",
  createOne: "Create one",
  welcomeBackToast: "Welcome back!",
  loginFailed: "Login failed",
  // register
  createAccountTitle: "Create your account",
  startCreating: "Start creating professional eBooks",
  fullName: "Full Name",
  namePlaceholder: "John Doe",
  passwordMinPlaceholder: "Min. 8 characters",
  createAccountBtn: "Create Account",
  haveAccount: "Already have an account?",
  accountCreatedToast: "Account created!",
  registrationFailed: "Registration failed",
  // verify
  verifyTitle: "Verify your email",
  notVerifiedYet: "Your account isn't verified yet",
  oneLastStep: "One last step before you start",
  checkEmail: "Check your email",
  sentCodeTo: "We sent a 6-digit code to",
  verify: "Verify",
  welcomeToast: "Welcome!",
  resendCode: "Resend code",
  resendCodeIn: "Resend code ({s}s)",
  useDifferentEmail: "Use a different email",
  codeSent: "Code sent. Check your inbox",
  couldNotResend: "Could not resend the code",
  invalidCode: "Invalid code",
  // validation
  errEmail: "Invalid email",
  errPasswordRequired: "Password required",
  errNameMin: "Min 2 characters",
  errPasswordMin: "Min 8 characters",
  // recaptcha notice
  recaptchaPre: "This site is protected by reCAPTCHA and the Google",
  recaptchaPrivacy: "Privacy Policy",
  recaptchaAnd: "and",
  recaptchaTerms: "Terms of Service",
  recaptchaPost: "apply.",
};

const pl: Dict = {
  // login
  welcomeBack: "Witaj ponownie",
  signInToContinue: "Zaloguj się, aby tworzyć dalej",
  email: "E-mail",
  password: "Hasło",
  forgotPassword: "Nie pamiętasz hasła?",
  signIn: "Zaloguj się",
  noAccount: "Nie masz konta?",
  createOne: "Załóż je",
  welcomeBackToast: "Witaj ponownie!",
  loginFailed: "Logowanie nie powiodło się",
  // register
  createAccountTitle: "Załóż konto",
  startCreating: "Zacznij tworzyć profesjonalne ebooki",
  fullName: "Imię i nazwisko",
  namePlaceholder: "Jan Kowalski",
  passwordMinPlaceholder: "Min. 8 znaków",
  createAccountBtn: "Załóż konto",
  haveAccount: "Masz już konto?",
  accountCreatedToast: "Konto utworzone!",
  registrationFailed: "Rejestracja nie powiodła się",
  // verify
  verifyTitle: "Zweryfikuj e-mail",
  notVerifiedYet: "Twoje konto nie jest jeszcze zweryfikowane",
  oneLastStep: "Ostatni krok, zanim zaczniesz",
  checkEmail: "Sprawdź e-mail",
  sentCodeTo: "Wysłaliśmy 6-cyfrowy kod na",
  verify: "Zweryfikuj",
  welcomeToast: "Witaj!",
  resendCode: "Wyślij kod ponownie",
  resendCodeIn: "Wyślij ponownie ({s}s)",
  useDifferentEmail: "Użyj innego adresu",
  codeSent: "Kod wysłany. Sprawdź skrzynkę",
  couldNotResend: "Nie udało się wysłać kodu",
  invalidCode: "Nieprawidłowy kod",
  // validation
  errEmail: "Nieprawidłowy e-mail",
  errPasswordRequired: "Hasło jest wymagane",
  errNameMin: "Min. 2 znaki",
  errPasswordMin: "Min. 8 znaków",
  // recaptcha notice
  recaptchaPre: "Ta strona jest chroniona przez reCAPTCHA; obowiązują",
  recaptchaPrivacy: "Polityka prywatności",
  recaptchaAnd: "i",
  recaptchaTerms: "Warunki usługi",
  recaptchaPost: "Google.",
};


const de: Dict = {
  // login
  welcomeBack: "Willkommen zurück",
  signInToContinue: "Melden Sie sich an, um weiterzuarbeiten",
  email: "E-Mail",
  password: "Passwort",
  forgotPassword: "Passwort vergessen?",
  signIn: "Anmelden",
  noAccount: "Noch kein Konto?",
  createOne: "Jetzt erstellen",
  welcomeBackToast: "Willkommen zurück!",
  loginFailed: "Anmeldung fehlgeschlagen",
  // register
  createAccountTitle: "Konto erstellen",
  startCreating: "Erstellen Sie professionelle E-Books",
  fullName: "Vor- und Nachname",
  namePlaceholder: "Max Mustermann",
  passwordMinPlaceholder: "Mind. 8 Zeichen",
  createAccountBtn: "Konto erstellen",
  haveAccount: "Sie haben schon ein Konto?",
  accountCreatedToast: "Konto erstellt!",
  registrationFailed: "Registrierung fehlgeschlagen",
  // verify
  verifyTitle: "E-Mail bestätigen",
  notVerifiedYet: "Ihr Konto ist noch nicht bestätigt",
  oneLastStep: "Ein letzter Schritt, bevor Sie starten",
  checkEmail: "Prüfen Sie Ihr Postfach",
  sentCodeTo: "Wir haben einen 6-stelligen Code gesendet an",
  verify: "Bestätigen",
  welcomeToast: "Willkommen!",
  resendCode: "Code erneut senden",
  resendCodeIn: "Code erneut senden ({s}s)",
  useDifferentEmail: "Andere E-Mail-Adresse verwenden",
  codeSent: "Code gesendet. Prüfen Sie Ihr Postfach",
  couldNotResend: "Der Code konnte nicht gesendet werden",
  invalidCode: "Ungültiger Code",
  // validation
  errEmail: "Ungültige E-Mail-Adresse",
  errPasswordRequired: "Passwort erforderlich",
  errNameMin: "Mind. 2 Zeichen",
  errPasswordMin: "Mind. 8 Zeichen",
  // recaptcha notice
  recaptchaPre: "Diese Seite ist durch reCAPTCHA geschützt; es gelten die",
  recaptchaPrivacy: "Datenschutzerklärung",
  recaptchaAnd: "und die",
  recaptchaTerms: "Nutzungsbedingungen",
  recaptchaPost: "von Google.",
};

const AREAS: Array<{ en: Dict; pl: Dict; de?: Dict }> = [common, layout, dashboard, newProject, projectDetail, forgotReset, generation, structure, download, editor, cover, titlePage, imageLibrary, admin, sample, payment, feedback, aiEdit];

const DICT: Record<AppLang, Dict> = {
  en: Object.assign({}, en, ...AREAS.map((a) => a.en)),
  pl: Object.assign({}, pl, ...AREAS.map((a) => a.pl)),
  // an area without a German dictionary (admin) falls back to English
  de: Object.assign({}, de, ...AREAS.map((a) => a.de ?? {})),
};

/** Translate with optional `{s}`-style interpolation. */
export function translate(lang: AppLang, key: string, vars?: Record<string, string | number>): string {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** React hook — re-renders on language change. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
