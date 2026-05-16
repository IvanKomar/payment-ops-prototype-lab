import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { LayoutsModule } from "./layouts/layouts.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { UiModule } from "./ui/ui.module.js";

@Module({
  imports: [PrismaModule, HealthModule, LayoutsModule, UiModule]
})
export class AppModule {}
