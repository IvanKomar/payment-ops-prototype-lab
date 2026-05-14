import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ReceiptsModule } from "./receipts/receipts.module.js";
import { UiModule } from "./ui/ui.module.js";

@Module({
  imports: [PrismaModule, HealthModule, ReceiptsModule, UiModule]
})
export class AppModule {}
