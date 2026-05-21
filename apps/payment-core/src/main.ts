import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createLogger } from "@payment-ops/shared-logger";

import { AppModule } from "./app.module.js";
import { loadPaymentCoreConfig } from "./config/payment-core.config.js";

async function bootstrap() {
  const config = loadPaymentCoreConfig();
  const logger = createLogger({
    serviceName: "payment-core",
    level: config.LOG_LEVEL
  });
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Payment Core")
    .setDescription("Local prototype payment core API")
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, "Payment Core listening");
}

void bootstrap();
