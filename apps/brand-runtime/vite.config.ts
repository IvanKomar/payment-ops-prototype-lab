import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv, type Plugin } from "vite";

function serviceTarget(env: Record<string, string>, key: string, fallback: string) {
  return env[key] && env[key].length > 0 ? env[key] : fallback;
}

function brandRuntimeBootstrapPlugin(appRoot: string, layoutBuilderTarget: string): Plugin {
  return {
    name: "brand-runtime-bootstrap",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.method !== "GET" || !request.url) {
          next();
          return;
        }

        const pathname = new URL(request.url, "http://brand-runtime.local").pathname;
        const match = /^\/(?<slug>[a-z0-9][a-z0-9_-]{6,80})\/app\/(?:login|dashboard|payments|customers|balances)$/u.exec(
          pathname
        );

        if (!match?.groups?.slug) {
          next();
          return;
        }

        try {
          const runtimeResponse = await fetch(`${layoutBuilderTarget}/${match.groups.slug}/_runtime`, {
            headers: { accept: "application/json" }
          });

          if (!runtimeResponse.ok) {
            throw new Error(await runtimeResponse.text());
          }

          const runtimeShell = await runtimeResponse.json();
          const html = await readFile(resolve(appRoot, "index.html"), "utf8");
          const bootstrap = `<script>window.__BRAND_RUNTIME_SHELL__=${safeScriptJson(runtimeShell)};</script>`;
          const transformed = await server.transformIndexHtml(request.url, html.replace("</head>", `${bootstrap}</head>`));

          response.statusCode = 200;
          response.setHeader("content-type", "text/html");
          response.end(transformed);
        } catch (error) {
          next(error);
        }
      });
    }
  };
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export default defineConfig(({ mode }) => {
  const appRoot = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(appRoot, "../..");
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, appRoot, "")
  };

  return {
    server: {
      host: "0.0.0.0",
      port: Number(env.BRAND_RUNTIME_PORT ?? 3006),
      strictPort: true,
      proxy: {
        "^/[a-z0-9][a-z0-9_-]{6,80}/[a-z0-9][a-z0-9_-]{1,80}$": {
          target: serviceTarget(env, "VITE_LAYOUT_PROXY_TARGET", "http://localhost:3003"),
          changeOrigin: true
        },
        "/layout-api": {
          target: serviceTarget(env, "VITE_LAYOUT_PROXY_TARGET", "http://localhost:3003"),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/layout-api/u, "")
        }
      }
    },
    plugins: [brandRuntimeBootstrapPlugin(appRoot, serviceTarget(env, "VITE_LAYOUT_PROXY_TARGET", "http://localhost:3003"))]
  };
});
