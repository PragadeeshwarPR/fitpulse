import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Custom service worker (src/sw.ts) so we can handle push + background sync.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        injectRegister: false,
        manifest: false, // we ship public/manifest.json
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    server: {
      port: 5173,
      // In development, proxy the API so cookies are same-origin.
      proxy: {
        "/api": { target: env.VITE_DEV_API_TARGET || "http://localhost:4000", changeOrigin: false },
        "/uploads": { target: env.VITE_DEV_API_TARGET || "http://localhost:4000" },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "charts";
            if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
          },
        },
      },
    },
  };
});
