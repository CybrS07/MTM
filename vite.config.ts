import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), basicSsl()], // dev server is served over HTTPS
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: `https://localhost:${env.HTTPS_PORT || 8443}`, secure: false, changeOrigin: true },
      },
    },
  };
});
