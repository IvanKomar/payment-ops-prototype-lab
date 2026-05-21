import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";

function serviceTarget(env: Record<string, string>, key: string, fallback: string) {
  return env[key] && env[key].length > 0 ? env[key] : fallback;
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
        "/layout-api": {
          target: serviceTarget(env, "VITE_LAYOUT_PROXY_TARGET", "http://localhost:3003"),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/layout-api/u, "")
        }
      }
    }
  };
});
