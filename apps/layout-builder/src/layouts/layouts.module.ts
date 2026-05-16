import { Module } from "@nestjs/common";

import { loadLayoutBuilderConfig } from "../config/layout-builder.config.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { BrandsController } from "./controllers/brands.controller.js";
import { LayoutRepository } from "./layout.repository.js";
import { LayoutService } from "./layout.service.js";
import { LAYOUT_BUILDER_CONFIG } from "./layout.constants.js";
import { LogoStorageService } from "./logo/logo-storage.service.js";
import { PaletteService } from "./palette/palette.service.js";
import { SvgRendererService } from "./render/svg-renderer.service.js";
import { PayloadMapperService } from "./schema/payload-mapper.service.js";
import { SchemaGeneratorService } from "./schema/schema-generator.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [BrandsController],
  providers: [
    {
      provide: LAYOUT_BUILDER_CONFIG,
      useFactory: () => loadLayoutBuilderConfig()
    },
    LayoutRepository,
    LayoutService,
    LogoStorageService,
    PaletteService,
    SchemaGeneratorService,
    PayloadMapperService,
    SvgRendererService
  ]
})
export class LayoutsModule {}
