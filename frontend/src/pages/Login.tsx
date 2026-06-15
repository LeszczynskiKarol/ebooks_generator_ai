import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Loader2, Moon, Sun } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { warmRecaptcha } from "@/lib/recaptcha";
import { useT, useLangStore, translate } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";
import VerifyCodeForm from "@/components/VerifyCodeForm";
import GoogleButton from "@/components/GoogleButton";
import RecaptchaNotice from "@/components/RecaptchaNotice";

type LoginForm = { email: string; password: string };

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { dark, toggle } = useThemeStore();
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [loading, setLoading] = useState(false);
  // Set when login is blocked by EMAIL_NOT_VERIFIED — switches to the code step
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    warmRecaptcha();
  }, []);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(translate(lang, "errEmail")),
        password: z.string().min(1, translate(lang, "errPasswordRequired")),
      }),
    [lang],
  );

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (form: LoginForm) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
      toast.success(t("welcomeBackToast"));
      navigate("/dashboard");
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setPendingEmail(err.response.data.email || form.email);
      } else {
        toast.error(err.response?.data?.error || t("loginFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 transition-colors">
      <LangToggle />
      {/* Theme toggle */}
      <button onClick={toggle} className="fixed top-4 right-4 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
        {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <a href="https://inkmagnet.com" className="inline-flex items-center gap-2 mb-6">
            <BookOpen className="w-8 h-8 text-primary-600" />
            <span className="text-2xl font-bold font-display text-gray-900 dark:text-white">InkMagnet</span>
          </a>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {pendingEmail ? t("verifyTitle") : t("welcomeBack")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {pendingEmail ? t("notVerifiedYet") : t("signInToContinue")}
          </p>
        </div>

        {pendingEmail ? (
          <VerifyCodeForm
            email={pendingEmail}
            autoSend
            onBack={() => setPendingEmail(null)}
            onVerified={(user, accessToken, refreshToken) => {
              setAuth(user, accessToken, refreshToken);
              toast.success(t("welcomeToast"));
              navigate("/dashboard");
            }}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("email")}</label>
              <input type="email" {...register("email")} placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("password")}</label>
                <Link to="/auth/forgot-password" className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
                  {t("forgotPassword")}
                </Link>
              </div>
              <input type="password" {...register("password")} placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} {t("signIn")}
            </button>

            <GoogleButton />
          </form>
        )}

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          {t("noAccount")}{" "}
          <Link to="/auth/register" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">{t("createOne")}</Link>
        </p>
        <RecaptchaNotice />
      </div>
    </div>
  );
}
