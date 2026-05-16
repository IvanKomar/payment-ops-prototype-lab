CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoOriginalFilename" TEXT NOT NULL,
    "logoMimeType" TEXT NOT NULL,
    "logoSizeBytes" INTEGER NOT NULL,
    "logoPath" TEXT NOT NULL,
    "palette" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_schemas" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fieldsStyle" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_schemas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_requests" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "originalPayload" JSONB NOT NULL,
    "canonicalPayload" JSONB NOT NULL,
    "renderedSvg" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_schemas_slug_key" ON "brand_schemas"("slug");
CREATE INDEX "brand_schemas_brandId_idx" ON "brand_schemas"("brandId");
CREATE INDEX "brand_requests_brandId_createdAt_idx" ON "brand_requests"("brandId", "createdAt");
CREATE INDEX "brand_requests_schemaId_idx" ON "brand_requests"("schemaId");

ALTER TABLE "brand_schemas" ADD CONSTRAINT "brand_schemas_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_requests" ADD CONSTRAINT "brand_requests_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_requests" ADD CONSTRAINT "brand_requests_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "brand_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
