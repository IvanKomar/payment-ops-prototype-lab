import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiGenerationProfile,
  LayoutBuilderGeneratedArtifactSource,
  LayoutBuilderGeneratedBrandArtifact,
  LayoutBuilderGeneratedBrandSourceType
} from "@payment-ops/shared-types";
import * as esbuild from "esbuild";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize } from "node:path";

import type { BrandRuntimeContract } from "../runtime/brand-runtime.types.js";

interface CompileGeneratedArtifactInput {
  source: LayoutBuilderGeneratedArtifactSource;
  brandId: string;
  brandName: string;
  contractVersionId: string;
  contractSlug: string;
  facadeBasePath: string;
  generationProfile: LayoutBuilderAiGenerationProfile;
  contract: BrandRuntimeContract;
  uiSpec: LayoutBuilderGeneratedBrandArtifact["uiSpec"];
  model: string;
  sourceType: LayoutBuilderGeneratedBrandSourceType;
}

@Injectable()
export class GeneratedArtifactCompilerService {
  async compile(input: CompileGeneratedArtifactInput): Promise<LayoutBuilderGeneratedBrandArtifact> {
    const fileMap = new Map(input.source.files.map((file) => [normalizeArtifactPath(file.path), file]));
    const entry = normalizeArtifactPath(input.source.entryFile);

    if (!fileMap.has(entry)) {
      throw new Error(`Generated artifact is missing entry file ${input.source.entryFile}`);
    }

    const output = await esbuild.build({
      absWorkingDir: process.cwd(),
      bundle: true,
      entryPoints: [entry],
      format: "iife",
      globalName: "GeneratedBrandArtifact",
      jsx: "automatic",
      logLevel: "silent",
      minify: false,
      outfile: "dist/generated-app.js",
      platform: "browser",
      sourcemap: false,
      target: ["es2020"],
      treeShaking: true,
      write: false,
      plugins: [generatedArtifactPlugin(fileMap, generatedBrandSdkSource())]
    });

    const compiledFiles = output.outputFiles.map((file) => ({
      path: file.path.endsWith(".css") ? "dist/generated-app.css" : "dist/generated-app.js",
      kind: file.path.endsWith(".css") ? "style" as const : "bundle" as const,
      bytes: byteLength(file.text),
      content: file.text
    }));

    return {
      artifactId: `artifact_${randomUUID().replaceAll("-", "")}`,
      brandId: input.brandId,
      provider: input.generationProfile.provider,
      model: input.model,
      sourceType: input.sourceType,
      status: "active",
      framework: "react-vite",
      entryFile: entry,
      contractVersionId: input.contractVersionId,
      facadeBasePath: input.facadeBasePath,
      uiSpec: input.uiSpec,
      routes: input.source.routes,
      capabilities: input.source.capabilities,
      files: [
        ...input.source.files.map((file) => ({
          path: normalizeArtifactPath(file.path),
          kind: file.kind,
          bytes: byteLength(file.content),
          content: file.content
        })),
        ...compiledFiles
      ],
      validation: {
        status: "passed",
        checks: []
      },
      generatedAt: new Date().toISOString()
    };
  }
}

function generatedArtifactPlugin(
  fileMap: Map<string, LayoutBuilderGeneratedArtifactSource["files"][number]>,
  sdkSource: string
): esbuild.Plugin {
  const require = createRequire(import.meta.url);

  return {
    name: "generated-artifact-virtual-files",
    setup(build) {
      build.onResolve({ filter: /^@brand\/sdk$/ }, () => ({ path: "@brand/sdk", namespace: "brand-sdk" }));
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path === "@brand/sdk") {
          return { path: args.path, namespace: "brand-sdk" };
        }

        if (args.kind === "entry-point") {
          const path = normalizeArtifactPath(args.path);
          return fileMap.has(path) ? { path, namespace: "artifact-source" } : null;
        }

        if (!args.path.startsWith(".")) {
          if (args.path === "react" || args.path === "react/jsx-runtime" || args.path === "react-dom/client") {
            return { path: require.resolve(args.path) };
          }

          return null;
        }

        const importerDir = args.importer ? dirname(args.importer) : "src";
        const candidates = resolveCandidates(importerDir, args.path);
        const match = candidates.find((candidate) => fileMap.has(candidate));

        return match ? { path: match, namespace: "artifact-source" } : null;
      });
      build.onLoad({ filter: /.*/, namespace: "brand-sdk" }, () => ({
        contents: sdkSource,
        loader: "js"
      }));
      build.onLoad({ filter: /.*/, namespace: "artifact-source" }, (args) => {
        const file = fileMap.get(args.path);

        if (!file) {
          return null;
        }

        return {
          contents: file.content,
          loader: loaderForPath(file.path)
        };
      });
    }
  };
}

function resolveCandidates(importerDir: string, request: string): string[] {
  const base = normalizeArtifactPath(join(importerDir, request));

  if (extname(base)) {
    return [base];
  }

  return [`${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, `${base}.css`, `${base}/index.tsx`, `${base}/index.ts`];
}

function loaderForPath(path: string): esbuild.Loader {
  const extension = extname(path);

  switch (extension) {
    case ".css":
      return "css";
    case ".jsx":
      return "jsx";
    case ".js":
      return "js";
    case ".ts":
      return "ts";
    case ".tsx":
    default:
      return "tsx";
  }
}

function normalizeArtifactPath(path: string): string {
  return normalize(path).replaceAll("\\", "/").replace(/^\.?\//u, "");
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function generatedBrandSdkSource(): string {
  return `
const context = window.__BRAND_SDK_CONTEXT__;
const sessionKey = "generated-brand-session:" + context.slug;

function readSession() {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

function clearSession() {
  window.localStorage.removeItem(sessionKey);
}

async function request(endpointKey, options = {}) {
  const endpoint = context.contract.endpoints[endpointKey];
  const session = readSession();
  const response = await fetch(context.facadeBasePath + "/" + endpoint, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(session?.sessionToken ? { authorization: "Bearer " + session.sessionToken } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Request failed");
  }
  return payload;
}

function unwrapArray(payload, preferredKeys) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  for (const key of preferredKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    if (Array.isArray(payload?.result?.[key])) return payload.result[key];
  }
  const firstArray = Object.values(payload || {}).find(Array.isArray);
  return firstArray || [];
}

function unwrapObject(payload, preferredKeys) {
  if (!payload || typeof payload !== "object") return {};
  for (const key of preferredKeys) {
    if (payload[key] && typeof payload[key] === "object") return payload[key];
    if (payload.data?.[key] && typeof payload.data[key] === "object") return payload.data[key];
    if (payload.result?.[key] && typeof payload.result[key] === "object") return payload.result[key];
  }
  return payload.result || payload.data || payload;
}

function unwrapAuth(payload) {
  const tokenKey = context.contract.authFields.sessionToken;
  const sessionToken = payload?.[tokenKey] || payload?.sessionToken || payload?.token || payload?.data?.[tokenKey] || payload?.result?.[tokenKey];
  const session = {
    sessionToken,
    user: payload?.user || payload?.data?.user || payload?.result?.user || null,
    account: payload?.account || payload?.data?.account || payload?.result?.account || null
  };
  return writeSession(session);
}

function authPayload(values) {
  const fields = context.contract.authFields;
  return {
    [fields.email]: values.email,
    [fields.password]: values.password,
    ...(values.displayName ? { [fields.displayName]: values.displayName } : {}),
    ...(values.currency ? { [fields.currency]: values.currency } : {})
  };
}

function paymentPayload(values) {
  const fields = context.contract.fields;
  const customerFields = context.contract.customerFields;
  const methodFields = context.contract.paymentMethodFields;
  const methodType = values.methodType || "card";
  return {
    [fields.amount]: Number(values.amount || 0),
    [fields.currency]: values.currency || "USD",
    [fields.methodType]: methodType,
    ...(values.destinationLabel ? { [fields.destinationLabel]: values.destinationLabel } : {}),
    scenario: values.scenario || "settle",
    customer: {
      [customerFields.name]: values.customerName || values.customer || "New player",
      ...(values.customerEmail ? { [customerFields.email]: values.customerEmail } : {})
    },
    paymentMethod: {
      [methodFields.type]: methodType,
      [methodFields.label]: values.instrumentReference || values.instrument || "Player wallet",
      [methodFields.last4]: String(values.last4 || "4242")
    }
  };
}

export const sdk = {
  brand: {
    name: context.brand.name,
    logoDataUri: context.brand.logoDataUri,
    palette: context.brand.palette,
    labels: context.labels,
    copy: context.copy,
    themeTokens: context.themeTokens
  },
  auth: {
    login: async (values) => unwrapAuth(await request("login", { method: "POST", body: authPayload(values) })),
    register: async (values) => unwrapAuth(await request("register", { method: "POST", body: authPayload(values) })),
    logout: () => clearSession(),
    getSession: () => readSession()
  },
  payments: {
    list: async () => unwrapArray(await request("payments"), [context.contract.responseKeys.payments, context.contract.resourceAlias, "payments"]),
    create: async (values) => unwrapObject(await request("payments", { method: "POST", body: paymentPayload(values) }), ["payment", context.contract.resourceAlias.slice(0, -1)])
  },
  customers: {
    list: async () => unwrapArray(await request("customers"), [context.contract.responseKeys.customers, "customers"])
  },
  balances: {
    list: async () => unwrapArray(await request("balances"), [context.contract.responseKeys.balances, "balances"])
  }
};
`;
}
