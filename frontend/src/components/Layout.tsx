import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Plus, User, Moon, Sun, Shield, Lock } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import api from "@/lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const [adminLockBanner, setAdminLockBanner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        setAdminLockBanner(
          data.data?.isAdmin === true && data.data?.generationLocked === true,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {adminLockBanner && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            <strong>Generation lock active</strong> — only your admin account can
            create books; all other users are blocked. Unset{" "}
            <code className="px-1 py-0.5 bg-amber-400/60 rounded text-xs">GENERATION_LOCKED</code>{" "}
            on the server to open the gates.
          </span>
        </div>
      )}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary-600" />
            <span className="text-xl font-bold font-display text-gray-900 dark:text-white">InkMagnet</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link to="/projects/new" className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium whitespace-nowrap">
              <Plus className="w-4 h-4" /> New<span className="hidden sm:inline">&nbsp;Book</span>
            </Link>

            <Link to="/admin" className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm" title="Admin Panel">
              <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span>
            </Link>

            <button onClick={toggle} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Toggle theme">
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 sm:pl-3 sm:border-l border-gray-200 dark:border-gray-700">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/50 rounded-full hidden sm:flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:block">{user?.name || user?.email}</span>
              <button onClick={() => { logout(); navigate("/"); }} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Log out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
