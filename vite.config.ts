import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Dev-only: fetch publisher HTML same-origin so articleContent.ts can parse without browser CORS. */
function articleHtmlFetchProxy(): Plugin {
  return {
    name: "article-html-fetch-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url ?? "";
        if (!reqUrl.startsWith("/api/article-fetch")) return next();
        if (req.method !== "GET") return next();
        try {
          const params = new URL(reqUrl, "http://vite.local").searchParams;
          const target = params.get("url");
          if (!target) {
            res.statusCode = 400;
            res.end("Missing url");
            return;
          }
          let parsed: URL;
          try {
            parsed = new URL(target);
          } catch {
            res.statusCode = 400;
            res.end("Invalid url");
            return;
          }
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            res.statusCode = 400;
            res.end("Invalid protocol");
            return;
          }
          const upstream = await fetch(parsed.toString(), {
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; ResilienceInsightBot/1.0; +https://example.com)",
            },
          });
          const body = await upstream.text();
          const ct = upstream.headers.get("content-type");
          if (ct) res.setHeader("Content-Type", ct);
          res.statusCode = upstream.status;
          res.end(body);
        } catch (e) {
          res.statusCode = 502;
          res.end(e instanceof Error ? e.message : "Upstream error");
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // NewsAPI.ai (Event Registry) — browser calls same-origin in dev to avoid CORS edge cases
      "/api/event-registry": {
        target: "https://eventregistry.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/event-registry/, ""),
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && articleHtmlFetchProxy(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
}));
