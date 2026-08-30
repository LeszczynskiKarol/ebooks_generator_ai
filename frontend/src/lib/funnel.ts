import { useAuthStore } from "@/stores/authStore";

// Product-funnel telemetry. First-party, cookie-less: one POST per step the
// logged-in user reaches. Uses fetch keepalive so an "abandon" fired on
// pagehide/unmount survives navigation (sendBeacon can't carry the JWT).
export type FunnelEvent =
  | "dashboard_empty"
  | "new_project_open"
  | "new_project_filled"
  | "new_project_abandon"
  | "checkout_start"
  | "checkout_created";

export function track(
  event: FunnelEvent,
  meta?: Record<string, string | number | boolean | null>,
) {
  try {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    fetch("/api/funnel", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event, meta }),
    }).catch(() => {});
  } catch {
    /* telemetry must never break the UI */
  }
}
