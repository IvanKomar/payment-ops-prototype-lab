import { Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { UiModule } from "./ui/ui.module.js";

@Module({
  imports: [PrismaModule, HealthModule, PaymentsModule, UiModule]
})
export class AppModule {}
