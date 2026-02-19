import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post("/api/auth/refresh", {
            refreshToken,
          });
          useAuthStore
            .getState()
            .setTokens(data.data.accessToken, data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = "/auth/login";
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
