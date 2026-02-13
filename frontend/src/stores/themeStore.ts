import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  setDark: (v: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () =>
        set((s) => {
          const next = !s.dark;
          applyTheme(next);
          return { dark: next };
        }),
      setDark: (v) => {
        applyTheme(v);
        set({ dark: v });
      },
    }),
    {
      name: "bookforge-theme",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.dark);
      },
    }
  )
);

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
