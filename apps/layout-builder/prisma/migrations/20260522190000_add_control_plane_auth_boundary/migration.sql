CREATE TABLE "admin_identities" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_memberships" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "adminId" TEXT,
    "merchantUserId" TEXT,
    "merchantEmail" TEXT,
    "merchantDisplayName" TEXT,
    "merchantAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_identities_email_key" ON "admin_identities"("email");
CREATE UNIQUE INDEX "admin_sessions_tokenHash_key" ON "admin_sessions"("tokenHash");
CREATE INDEX "admin_sessions_adminId_idx" ON "admin_sessions"("adminId");
CREATE UNIQUE INDEX "brand_memberships_brandId_subjectKey_key" ON "brand_memberships"("brandId", "subjectKey");
CREATE INDEX "brand_memberships_adminId_idx" ON "brand_memberships"("adminId");
CREATE INDEX "brand_memberships_brandId_role_idx" ON "brand_memberships"("brandId", "role");

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_memberships" ADD CONSTRAINT "brand_memberships_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_memberships" ADD CONSTRAINT "brand_memberships_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
