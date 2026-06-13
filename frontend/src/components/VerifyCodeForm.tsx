import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { uiLang } from "@/lib/locale";

interface VerifiedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface Props {
  email: string;
  /** Request a fresh code on mount (used from Login, where the last code may be stale). */
  autoSend?: boolean;
  onVerified: (user: VerifiedUser, accessToken: string, refreshToken: string) => void;
  onBack?: () => void;
}

export default function VerifyCodeForm({ email, autoSend, onVerified, onBack }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(60);

  useEffect(() => {
    if (autoSend) void resend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]);

  const resend = async (silent = false) => {
    try {
      const recaptchaToken = await getRecaptchaToken("resend_code");
      await api.post("/auth/resend-code", { email, recaptchaToken, lang: uiLang() });
      setResendIn(60);
      if (!silent) toast.success("Code sent — check your inbox");
    } catch (err: any) {
      const retryAfter = err.response?.data?.retryAfter;
      if (typeof retryAfter === "number") setResendIn(retryAfter);
      if (!silent) toast.error(err.response?.data?.error || "Could not resend the code");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-email", { email, code, lang: uiLang() });
      onVerified(data.data.user, data.data.accessToken, data.data.refreshToken);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid code");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 space-y-5">
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
          <MailCheck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Check your email</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          We sent a 6-digit code to <span className="font-medium text-gray-900 dark:text-white">{email}</span>
        </p>
      </div>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        autoFocus
        className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
      />

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Verify
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => resend()}
          disabled={resendIn > 0}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium disabled:opacity-50 disabled:cursor-default cursor-pointer"
        >
          {resendIn > 0 ? `Resend code (${resendIn}s)` : "Resend code"}
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            Use a different email
          </button>
        )}
      </div>
    </form>
  );
}
