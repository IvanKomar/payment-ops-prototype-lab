import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  LayoutBuilderAgentManifest,
  LayoutBuilderBrandIntentManifest,
  LayoutBuilderGeneratedArtifactInstructionsResponse
} from "@payment-ops/shared-types";

import { AiAgentManifestService } from "../ai/ai-agent-manifest.service.js";

@ApiTags("ai-agent")
@Controller("ai-agent")
export class AiAgentController {
  constructor(@Inject(AiAgentManifestService) private readonly manifestService: AiAgentManifestService) {}

  @Get("brand-generation-manifest")
  @ApiOkResponse({ description: "Machine-readable AI agent integration manifest for brand generation" })
  getBrandGenerationManifest(): LayoutBuilderAgentManifest {
    return this.manifestService.getManifest();
  }

  @Get("brand-intent-manifest")
  @ApiOkResponse({ description: "Minimal machine-readable manifest for external chat brand intent generation" })
  getBrandIntentManifest(): LayoutBuilderBrandIntentManifest {
    return this.manifestService.getIntentManifest();
  }

  @Get("generated-brand-manifest")
  @ApiOkResponse({ description: "Machine-readable manifest for Codex-generated React brand artifacts" })
  getGeneratedBrandManifest(): LayoutBuilderGeneratedArtifactInstructionsResponse {
    return this.manifestService.getGeneratedBrandManifest();
  }
}
