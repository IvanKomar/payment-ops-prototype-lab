import { BadRequestException, Injectable } from "@nestjs/common";
import type { LayoutBuilderGeneratedBrandArtifact } from "@payment-ops/shared-types";

import type { BrandRuntimeContract } from "../runtime/brand-runtime.types.js";

interface ValidateBrandArtifactInput {
  artifact: LayoutBuilderGeneratedBrandArtifact;
  brandId: string;
  contractVersionId: string;
  slug: string;
  contract: BrandRuntimeContract;
}

@Injectable()
export class AiBrandArtifactValidatorService {
  validate(input: ValidateBrandArtifactInput): LayoutBuilderGeneratedBrandArtifact {
    const checks = [
      assertMatchesBrand(input),
      assertEntryFile(input.artifact),
      assertRoutes(input.artifact),
      assertCapabilities(input.artifact),
      assertFacadeEndpoints(input),
      assertFileSafety(input.artifact)
    ];

    return {
      ...input.artifact,
      validation: {
        status: "passed",
        checks
      }
    };
  }
}

function assertMatchesBrand(input: ValidateBrandArtifactInput): string {
  const expectedFacadeBasePath = `/brands/${input.brandId}/${input.slug}`;

  if (input.artifact.brandId !== input.brandId) {
    throw new BadRequestException("Generated artifact brand id does not match the target brand");
  }

  if (input.artifact.contractVersionId !== input.contractVersionId) {
    throw new BadRequestException("Generated artifact contract version does not match the active contract");
  }

  if (input.artifact.facadeBasePath !== expectedFacadeBasePath) {
    throw new BadRequestException("Generated artifact facade base path does not match the public brand path");
  }

  return "artifact identity matches brand, slug, and contract version";
}

function assertEntryFile(artifact: LayoutBuilderGeneratedBrandArtifact): string {
  const entryFiles = artifact.files.filter((file) => file.kind === "entry");

  if (artifact.framework !== "react-vite") {
    throw new BadRequestException("Generated artifact must target the react-vite runtime");
  }

  if (entryFiles.length !== 1 || entryFiles[0]?.path !== artifact.entryFile) {
    throw new BadRequestException("Generated artifact must include exactly one matching entry file");
  }

  return "manifest has one matching React entry file";
}

function assertRoutes(artifact: LayoutBuilderGeneratedBrandArtifact): string {
  const routePaths = new Set(artifact.routes.map((route) => route.path));
  const requiredRoutes = ["/login", "/dashboard", "/payments"];

  if (!requiredRoutes.every((route) => routePaths.has(route))) {
    throw new BadRequestException("Generated artifact is missing required user-facing routes");
  }

  return "manifest declares login, dashboard, and payment routes";
}

function assertCapabilities(artifact: LayoutBuilderGeneratedBrandArtifact): string {
  const capabilities = new Set(artifact.capabilities);
  const requiredCapabilities: LayoutBuilderGeneratedBrandArtifact["capabilities"] = [
    "register_user",
    "login_user",
    "read_payments",
    "create_payment"
  ];

  if (!requiredCapabilities.every((capability) => capabilities.has(capability))) {
    throw new BadRequestException("Generated artifact is missing required payment capabilities");
  }

  return "manifest declares required auth and payment capabilities";
}

function assertFacadeEndpoints(input: ValidateBrandArtifactInput): string {
  for (const endpoint of Object.values(input.contract.endpoints)) {
    if (!endpoint.startsWith("bff/") || /^https?:\/\//iu.test(endpoint) || endpoint.includes("/runtime/")) {
      throw new BadRequestException("Generated contract endpoints must use only BFF aliases");
    }
  }

  return "network calls are restricted to generated BFF aliases";
}

function assertFileSafety(artifact: LayoutBuilderGeneratedBrandArtifact): string {
  for (const file of artifact.files) {
    if (file.path.startsWith("/") || file.path.includes("..")) {
      throw new BadRequestException("Generated artifact contains an unsafe file path");
    }

    const forbiddenPatterns = file.kind === "bundle" ? FORBIDDEN_COMPILED_PATTERNS : FORBIDDEN_SOURCE_PATTERNS;

    if (forbiddenPatterns.some((pattern) => pattern.test(file.content))) {
      throw new BadRequestException("Generated artifact source exposes internal platform details");
    }
  }

  return "source files avoid internal service names and unsafe paths";
}

const FORBIDDEN_SOURCE_PATTERNS = [
  /\bfetch\s*\(/iu,
  /\bXMLHttpRequest\b/u,
  /\bWebSocket\b/u,
  /\bEventSource\b/u,
  /\bnavigator\.sendBeacon\b/u,
  /\beval\s*\(/u,
  /\bnew\s+Function\b/u,
  /\bdocument\.cookie\b/u,
  /\bpayment-core\b/iu,
  /\bPaymentCore\b/u,
  /\bPrisma\b/u,
  /\bDATABASE_URL\b/u,
  /\bbrandId\b/u,
  /\bbff\b/iu,
  /\/bff\b/iu,
  /\/runtime\//u,
  /\/profile\b/iu,
  /\/rest-api\b/iu,
  /https?:\/\//iu
];

const FORBIDDEN_COMPILED_PATTERNS = [
  /\bXMLHttpRequest\b/u,
  /\bWebSocket\b/u,
  /\bEventSource\b/u,
  /\bnavigator\.sendBeacon\b/u,
  /\beval\s*\(/u,
  /\bnew\s+Function\b/u,
  /https?:\/\//iu
];
