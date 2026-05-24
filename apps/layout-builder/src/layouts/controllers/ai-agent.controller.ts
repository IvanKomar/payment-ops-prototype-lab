import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { LayoutBuilderAgentManifest } from "@payment-ops/shared-types";

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
}
