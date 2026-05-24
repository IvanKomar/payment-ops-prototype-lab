CREATE TABLE "brand_generation_drafts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "brandName" TEXT NOT NULL,
    "adminPrompt" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "controls" JSONB NOT NULL,
    "messages" JSONB NOT NULL,
    "spec" JSONB,
    "validationIssues" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_generation_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_generation_drafts_brandId_idx" ON "brand_generation_drafts"("brandId");
CREATE INDEX "brand_generation_drafts_createdAt_idx" ON "brand_generation_drafts"("createdAt");

ALTER TABLE "brand_generation_drafts"
ADD CONSTRAINT "brand_generation_drafts_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contract_versions" ADD COLUMN "aiSpec" JSONB;
