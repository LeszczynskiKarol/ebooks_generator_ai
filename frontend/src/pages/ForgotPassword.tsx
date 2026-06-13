import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Loader2, MailCheck, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { getRecaptchaToken, warmRecaptcha } from "@/lib/recaptcha";
import { uiLang } from "@/lib/locale";
import RecaptchaNotice from "@/components/RecaptchaNotice";

const schema = z.object({
  email: z.string().email("Invalid email"),
});
type Form = z.infer<typeof schema>;

export default function ForgotPassword() {
  const { dark, toggle } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    warmRecaptcha();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (form: Form) => {
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken("forgot_password");
      await api.post("/auth/forgot-password", {
        email: form.email,
        recaptchaToken,
        lang: uiLang(),
      });
      setSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Something went wrong — try again");
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset your password</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            We'll email you a link to set a new one
          </p>
        </div>

        {sent ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <MailCheck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Check your inbox</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If an account exists for that address, a reset link is on its way.
              The link expires in 30 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" {...register("email")} placeholder="you@example.com" autoFocus
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send reset link
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Remembered it?{" "}
          <Link to="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">Sign in</Link>
        </p>
        <RecaptchaNotice />
      </div>
    </div>
  );
}
