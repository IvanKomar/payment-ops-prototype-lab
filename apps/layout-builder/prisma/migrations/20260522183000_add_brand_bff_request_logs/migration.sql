CREATE TABLE "brand_bff_request_logs" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "publicEndpoint" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responseSummary" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_bff_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_bff_request_logs_brandId_createdAt_idx" ON "brand_bff_request_logs"("brandId", "createdAt");
CREATE INDEX "brand_bff_request_logs_schemaId_createdAt_idx" ON "brand_bff_request_logs"("schemaId", "createdAt");

ALTER TABLE "brand_bff_request_logs" ADD CONSTRAINT "brand_bff_request_logs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_bff_request_logs" ADD CONSTRAINT "brand_bff_request_logs_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "brand_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
