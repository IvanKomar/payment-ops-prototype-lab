import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiCredentialMode,
  LayoutBuilderAiBrandSpec,
  LayoutBuilderAiGenerationProfile,
  LayoutBuilderAiProvider,
  LayoutBuilderClarificationAnswers,
  LayoutBuilderClarifyBrandResponse,
  LayoutBuilderGeneratedBrandArtifact
} from "@payment-ops/shared-types";

import type { BrandRuntimeContract } from "../runtime/brand-runtime.types.js";
import { AiBrandGeneratorService, DEFAULT_BRAND_AI_SYSTEM_PROMPT } from "./ai-brand-generator.service.js";

export interface ClarifyBrandWithProviderInput {
  brandName: string;
  aiPrompt: string;
  aiProvider?: LayoutBuilderAiProvider;
  aiModel?: string;
}

export interface GenerateBrandProfileWithProviderInput {
  brandId: string;
  brandName: string;
  adminPrompt: string;
  systemPrompt?: string;
  aiProvider?: LayoutBuilderAiProvider;
  aiModel?: string;
  clarificationAnswers?: LayoutBuilderClarificationAnswers;
}

export interface GenerateBrandArtifactWithProviderInput {
  brandId: string;
  brandName: string;
  contractVersionId: string;
  contractSlug: string;
  contract: BrandRuntimeContract;
  generationProfile: LayoutBuilderAiGenerationProfile;
  uiSpec?: LayoutBuilderAiBrandSpec["ui"];
  sourceType?: LayoutBuilderGeneratedBrandArtifact["sourceType"];
}

interface ProviderDescriptor {
  provider: LayoutBuilderAiProvider;
  credentialMode: LayoutBuilderAiCredentialMode;
  defaultModel: string;
  configured: boolean;
}

const PROVIDERS: Record<LayoutBuilderAiProvider, ProviderDescriptor> = {
  local: {
    provider: "local",
    credentialMode: "none",
    defaultModel: "local-brand-runtime-v1",
    configured: true
  },
  openai: {
    provider: "openai",
    credentialMode: "server_api_key",
    defaultModel: "gpt-5-mini",
    configured: false
  },
  gemini: {
    provider: "gemini",
    credentialMode: "server_api_key",
    defaultModel: "gemini-2.5-flash",
    configured: false
  },
  anthropic: {
    provider: "anthropic",
    credentialMode: "server_api_key",
    defaultModel: "claude-sonnet-4-5",
    configured: false
  },
  codex: {
    provider: "codex",
    credentialMode: "server_api_key",
    defaultModel: "codex-provider-placeholder",
    configured: false
  }
};

@Injectable()
export class AiBrandProviderRegistryService {
  constructor(@Inject(AiBrandGeneratorService) private readonly localGenerator: AiBrandGeneratorService) {}

  clarify(input: ClarifyBrandWithProviderInput): LayoutBuilderClarifyBrandResponse {
    const descriptor = providerDescriptor(input.aiProvider);

    if (!descriptor.configured) {
      throw providerNotConfigured(descriptor);
    }

    return this.localGenerator.clarify({
      brandName: input.brandName,
      aiPrompt: input.aiPrompt,
      aiModel: input.aiModel ?? descriptor.defaultModel
    });
  }

  generateProfile(input: GenerateBrandProfileWithProviderInput): LayoutBuilderAiGenerationProfile {
    const descriptor = providerDescriptor(input.aiProvider);

    if (!descriptor.configured) {
      throw providerNotConfigured(descriptor);
    }

    return this.localGenerator.generate({
      brandId: input.brandId,
      brandName: input.brandName,
      adminPrompt: input.adminPrompt,
      systemPrompt: input.systemPrompt ?? DEFAULT_BRAND_AI_SYSTEM_PROMPT,
      aiModel: input.aiModel ?? descriptor.defaultModel,
      ...(input.clarificationAnswers ? { clarificationAnswers: input.clarificationAnswers } : {})
    });
  }

  generateArtifact(input: GenerateBrandArtifactWithProviderInput): LayoutBuilderGeneratedBrandArtifact {
    return this.localGenerator.generateArtifact(input);
  }
}

function providerDescriptor(provider: LayoutBuilderAiProvider | undefined): ProviderDescriptor {
  return PROVIDERS[provider ?? "local"];
}

function providerNotConfigured(descriptor: ProviderDescriptor): BadRequestException {
  return new BadRequestException(
    `AI provider "${descriptor.provider}" is registered but not configured. Configure a server-side API key before using this provider.`
  );
}
