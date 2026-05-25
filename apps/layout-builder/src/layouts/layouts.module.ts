import { Module } from "@nestjs/common";

import { loadLayoutBuilderConfig } from "../config/layout-builder.config.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AuthBoundaryService } from "./auth/auth-boundary.service.js";
import { AdminAuthController } from "./controllers/admin-auth.controller.js";
import { AiAgentController } from "./controllers/ai-agent.controller.js";
import { BrandBffController } from "./controllers/brand-bff.controller.js";
import { BrandRuntimeController } from "./controllers/brand-runtime.controller.js";
import { BrandsController } from "./controllers/brands.controller.js";
import { PublicBrandApiController } from "./controllers/public-brand-api.controller.js";
import { LayoutRepository } from "./layout.repository.js";
import { LayoutService } from "./layout.service.js";
import { LAYOUT_BUILDER_CONFIG } from "./layout.constants.js";
import { LogoStorageService } from "./logo/logo-storage.service.js";
import { PaletteService } from "./palette/palette.service.js";
import { SvgRendererService } from "./render/svg-renderer.service.js";
import { PayloadMapperService } from "./schema/payload-mapper.service.js";
import { SchemaGeneratorService } from "./schema/schema-generator.service.js";
import { AiBrandArtifactValidatorService } from "./ai/ai-brand-artifact-validator.service.js";
import { AiBrandGeneratorService } from "./ai/ai-brand-generator.service.js";
import { AiBrandProviderRegistryService } from "./ai/ai-brand-provider-registry.service.js";
import { AiBrandSpecService } from "./ai/ai-brand-spec.service.js";
import { AiAgentManifestService } from "./ai/ai-agent-manifest.service.js";
import { BrandIntentCompilerService } from "./ai/brand-intent-compiler.service.js";
import { BrandSpecUniquenessService } from "./ai/brand-spec-uniqueness.service.js";
import { PaymentCoreClientService } from "./runtime/payment-core-client.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AiAgentController, BrandsController, BrandRuntimeController, BrandBffController, AdminAuthController, PublicBrandApiController],
  providers: [
    {
      provide: LAYOUT_BUILDER_CONFIG,
      useFactory: () => loadLayoutBuilderConfig()
    },
    LayoutRepository,
    LayoutService,
    AuthBoundaryService,
    AiBrandArtifactValidatorService,
    AiBrandGeneratorService,
    AiBrandProviderRegistryService,
    AiBrandSpecService,
    AiAgentManifestService,
    BrandIntentCompilerService,
    BrandSpecUniquenessService,
    PaymentCoreClientService,
    LogoStorageService,
    PaletteService,
    SchemaGeneratorService,
    PayloadMapperService,
    SvgRendererService
  ]
})
export class LayoutsModule {}
