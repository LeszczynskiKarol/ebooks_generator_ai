import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import { getAttribution, track } from "@/lib/attribution";
import toast from "react-hot-toast";
import { getRecaptchaToken, warmRecaptcha } from "@/lib/recaptcha";
import { uiLang } from "@/lib/locale";
import { useT, useLangStore, translate } from "@/lib/i18n";
import AuthShell from "@/components/AuthShell";
import VerifyCodeForm from "@/components/VerifyCodeForm";
import GoogleButton from "@/components/GoogleButton";
import RecaptchaNotice from "@/components/RecaptchaNotice";

type RegisterForm = { name: string; email: string; password: string };

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [loading, setLoading] = useState(false);
  // Email awaiting a verification code; non-null switches to the code step
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Honeypot — bots fill it, humans never see it
  const [company, setCompany] = useState("");

  useEffect(() => {
    warmRecaptcha();
  }, []);

  const registerSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, translate(lang, "errNameMin")),
        email: z.string().email(translate(lang, "errEmail")),
        password: z.string().min(8, translate(lang, "errPasswordMin")),
      }),
    [lang],
  );

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (form: RegisterForm) => {
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken("register");
      const { data } = await api.post("/auth/register", {
        ...form,
        company,
        recaptchaToken,
        lang: uiLang(),
        attribution: getAttribution(),
      });
      if (data.data?.requiresVerification) {
        track("sign_up", { method: "email" });
        setPendingEmail(form.email);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {pendingEmail ? t("verifyTitle") : t("createAccountTitle")}
        </h1>
        <p className="mt-1.5 text-gray-600 dark:text-gray-400">
          {pendingEmail ? t("oneLastStep") : t("startCreating")}
        </p>
      </div>

      {pendingEmail ? (
        <VerifyCodeForm
          email={pendingEmail}
          onBack={() => setPendingEmail(null)}
          onVerified={(user, accessToken, refreshToken) => {
            setAuth(user, accessToken, refreshToken);
            toast.success(t("accountCreatedToast"));
            navigate("/dashboard");
          }}
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-7 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("fullName")}</label>
            <input type="text" {...register("name")} placeholder={t("namePlaceholder")}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("email")}</label>
            <input type="email" {...register("email")} placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("password")}</label>
            <input type="password" {...register("password")} placeholder={t("passwordMinPlaceholder")}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {/* Honeypot — keep off-screen, not display:none (some bots skip hidden inputs) */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 overflow-hidden">
            <label>
              Company
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-fuchsia-600 hover:from-primary-700 hover:to-fuchsia-700 text-white font-semibold shadow-lg shadow-primary-600/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {t("createAccountBtn")}
          </button>

          <GoogleButton />
        </form>
      )}

      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
        {t("haveAccount")}{" "}
        <Link to="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">{t("signIn")}</Link>
      </p>
      <RecaptchaNotice />
    </AuthShell>
  );
}
