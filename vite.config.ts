import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// XSS defence in the browser: a strict Content-Security-Policy. Dev needs inline scripts for hot reload.
const csp = (dev: boolean) => [
  "default-src 'self'",
  `script-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join("; ");

const headers = (dev: boolean) => ({
  "Content-Security-Policy": csp(dev),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = { "/api": { target: `https://localhost:${env.HTTPS_PORT || 8443}`, secure: false, changeOrigin: true } };
  return {
    plugins: [react(), basicSsl()],
    server: { port: 5173, strictPort: true, proxy, headers: headers(true) },
    preview: { port: 5173, proxy, headers: headers(false) },
  };
});
