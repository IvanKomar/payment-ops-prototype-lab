CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "resourceAlias" TEXT NOT NULL,
    "payloadStructure" TEXT NOT NULL,
    "fieldMap" JSONB NOT NULL,
    "statusMap" JSONB NOT NULL,
    "actionLabels" JSONB NOT NULL,
    "endpoints" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "generated_artifacts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "entryFile" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contract_versions_brandId_active_idx" ON "contract_versions"("brandId", "active");
CREATE INDEX "contract_versions_schemaId_createdAt_idx" ON "contract_versions"("schemaId", "createdAt");
CREATE INDEX "generated_artifacts_brandId_active_idx" ON "generated_artifacts"("brandId", "active");
CREATE INDEX "generated_artifacts_contractVersionId_active_idx" ON "generated_artifacts"("contractVersionId", "active");

ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "brand_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
