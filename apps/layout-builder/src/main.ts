import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createLogger } from "@payment-ops/shared-logger";

import { AppModule } from "./app.module.js";
import { loadLayoutBuilderConfig } from "./config/layout-builder.config.js";

async function bootstrap() {
  const config = loadLayoutBuilderConfig();
  const logger = createLogger({
    serviceName: "layout-builder",
    level: config.LOG_LEVEL
  });
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Layout Builder")
    .setDescription("Local prototype dynamic brand layout API")
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, "Layout Builder listening");
}

void bootstrap();
