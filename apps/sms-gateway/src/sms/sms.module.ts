import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { loadSmsGatewayConfig } from "../config/sms-gateway.config.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SmsController } from "./controllers/sms.controller.js";
import { ProviderRegistry } from "./providers/provider-registry.js";
import { SmsProcessor } from "./queue/sms.processor.js";
import { SmsQueue } from "./queue/sms.queue.js";
import { SMS_GATEWAY_CONFIG, SMS_QUEUE_NAME } from "./sms.constants.js";
import { SmsRepository } from "./sms.repository.js";
import { SmsService } from "./sms.service.js";

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: SMS_QUEUE_NAME
    })
  ],
  controllers: [SmsController],
  providers: [
    {
      provide: SMS_GATEWAY_CONFIG,
      useFactory: loadSmsGatewayConfig
    },
    {
      provide: SmsRepository,
      useFactory: (prisma: PrismaService) => new SmsRepository(prisma),
      inject: [PrismaService]
    },
    ProviderRegistry,
    SmsQueue,
    SmsService,
    SmsProcessor
  ],
  exports: [SmsService]
})
export class SmsModule {}
