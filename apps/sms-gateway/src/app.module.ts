import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { loadSmsGatewayConfig } from "./config/sms-gateway.config.js";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { SmsModule } from "./sms/sms.module.js";
import { UiModule } from "./ui/ui.module.js";

const config = loadSmsGatewayConfig();
const redisUrl = new URL(config.REDIS_URL);

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379)
      }
    }),
    PrismaModule,
    HealthModule,
    SmsModule,
    UiModule
  ]
})
export class AppModule {}
