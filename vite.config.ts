import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// XSS defence in the browser: a strict Content-Security-Policy. Dev needs inline scripts for hot reload.
const csp = (dev: boolean, connect: string[] = [], images: string[] = [], meta = false) => [
  "default-src 'self'",
  `script-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${images.join(" ")}`.trim(),
  `connect-src 'self' ${connect.join(" ")}${dev ? " ws: wss:" : ""}`.trim(),
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", ...(meta ? [] : ["frame-ancestors 'none'"]),
].join("; ");

const headers = (dev: boolean, connect: string[], images: string[]) => ({
  "Content-Security-Policy": csp(dev, connect, images),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
});

const origin = (u?: string) => { try { return new URL(u ?? "").origin; } catch { return ""; } };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const connect = [origin(env.VITE_API_URL), origin(env.VITE_SUPABASE_URL)].filter(Boolean);
  const images = [origin(env.VITE_SUPABASE_URL)].filter(Boolean);
  const proxy = { "/api": { target: `https://localhost:${env.HTTPS_PORT || 8443}`, secure: false, changeOrigin: true } };
  // GitHub Pages cannot send headers, so the production policy ships as a meta tag.
  const cspMeta = {
    name: "csp-meta", apply: "build" as const,
    transformIndexHtml: (html: string) => html.replace("</head>", `<meta http-equiv="Content-Security-Policy" content="${csp(false, connect, images, true)}" /></head>`),
  };
  return {
    base: env.VITE_BASE || "/",
    plugins: [react(), basicSsl(), cspMeta],
    server: { port: 5173, strictPort: true, proxy, headers: headers(true, connect, images) },
    preview: { port: 5173, proxy, headers: headers(false, connect, images) },
  };
});
