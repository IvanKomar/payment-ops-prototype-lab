import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createLogger } from "@payment-ops/shared-logger";

import { AppModule } from "./app.module.js";
import { loadSmsGatewayConfig } from "./config/sms-gateway.config.js";

async function bootstrap() {
  const config = loadSmsGatewayConfig();
  const logger = createLogger({
    serviceName: "sms-gateway",
    level: config.LOG_LEVEL
  });
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SMS Gateway")
    .setDescription("Local prototype SMS Gateway API")
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, "SMS Gateway listening");
}

void bootstrap();
