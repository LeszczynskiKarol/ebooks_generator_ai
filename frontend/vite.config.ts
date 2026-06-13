import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "127.0.0.1", // nasłuch na IPv4 loopback – żeby frpc (tunel) trafiał w 127.0.0.1:5173
    port: 5173,
    allowedHosts: [
      "app-reactapp.ngrok.app",
      "server-reactapp.ngrok.app",
      "dev.torweb.pl",
    ],
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
