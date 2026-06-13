import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

let gsiLoader: Promise<boolean> | null = null;
function loadGsi(): Promise<boolean> {
  if (!CLIENT_ID) return Promise.resolve(false);
  if (gsiLoader) return gsiLoader;
  gsiLoader = new Promise((resolve) => {
    if ((window as any).google?.accounts?.id) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve(!!(window as any).google?.accounts?.id);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return gsiLoader;
}

/** "Continue with Google" — renders nothing when VITE_GOOGLE_CLIENT_ID is unset. */
export default function GoogleButton() {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGsi().then((ok) => {
      if (!ok || cancelled || !ref.current) return;
      const g = (window as any).google.accounts.id;
      g.initialize({
        client_id: CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const { data } = await api.post("/auth/google", { credential: resp.credential });
            setAuth(data.data.user, data.data.accessToken, data.data.refreshToken);
            navigate("/dashboard");
          } catch (err: any) {
            toast.error(err.response?.data?.error || "Google sign-in failed");
          }
        },
      });
      g.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width: 336,
        text: "continue_with",
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <div className={ready ? "" : "hidden"}>
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white dark:bg-gray-900 text-gray-400">or</span>
        </div>
      </div>
      <div ref={ref} className="flex justify-center" />
    </div>
  );
}
