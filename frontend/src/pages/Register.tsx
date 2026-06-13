import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Loader2, Moon, Sun } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { getRecaptchaToken, warmRecaptcha } from "@/lib/recaptcha";
import { uiLang } from "@/lib/locale";
import VerifyCodeForm from "@/components/VerifyCodeForm";
import GoogleButton from "@/components/GoogleButton";
import RecaptchaNotice from "@/components/RecaptchaNotice";

const registerSchema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});
type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { dark, toggle } = useThemeStore();
  const [loading, setLoading] = useState(false);
  // Email awaiting a verification code; non-null switches to the code step
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Honeypot — bots fill it, humans never see it
  const [company, setCompany] = useState("");

  useEffect(() => {
    warmRecaptcha();
  }, []);

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
      });
      if (data.data?.requiresVerification) {
        setPendingEmail(form.email);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 transition-colors">
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
            {pendingEmail ? "Verify your email" : "Create your account"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {pendingEmail ? "One last step before you start" : "Start creating professional eBooks"}
          </p>
        </div>

        {pendingEmail ? (
          <VerifyCodeForm
            email={pendingEmail}
            onBack={() => setPendingEmail(null)}
            onVerified={(user, accessToken, refreshToken) => {
              setAuth(user, accessToken, refreshToken);
              toast.success("Account created!");
              navigate("/dashboard");
            }}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <input type="text" {...register("name")} placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" {...register("email")} placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input type="password" {...register("password")} placeholder="Min. 8 characters"
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
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create Account
            </button>

            <GoogleButton />
          </form>
        )}

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">Sign in</Link>
        </p>
        <RecaptchaNotice />
      </div>
    </div>
  );
}
