import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import apiClient from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 60_000;

export default function NotificationsBell() {
  const t = useT();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = () =>
    apiClient
      .get("/notifications")
      .then(({ data }) => {
        setItems(data.data?.items ?? []);
        setUnread(data.data?.unread ?? 0);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // opening the panel marks everything as read
      apiClient.post("/notifications/read", {}).then(() => setUnread(0)).catch(() => {});
    }
  };

  const onItem = (n: Notif) => {
    setOpen(false);
    if (n.projectId) navigate(`/projects/${n.projectId}`);
  };

  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={t("layout.notifications")}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              {t("layout.noNotifications")}
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItem(n)}
                className="w-full text-left px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{n.body}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">{fmt(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
