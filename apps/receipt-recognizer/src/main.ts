import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createLogger } from "@payment-ops/shared-logger";

import { AppModule } from "./app.module.js";
import { loadReceiptRecognizerConfig } from "./config/receipt-recognizer.config.js";

async function bootstrap() {
  const config = loadReceiptRecognizerConfig();
  const logger = createLogger({
    serviceName: "receipt-recognizer",
    level: config.LOG_LEVEL
  });
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Receipt Recognizer")
    .setDescription("Local prototype receipt OCR and normalization API")
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, "Receipt Recognizer listening");
}

void bootstrap();
