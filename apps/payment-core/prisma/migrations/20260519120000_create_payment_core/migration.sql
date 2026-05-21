CREATE TYPE "PaymentStatus" AS ENUM (
    'created',
    'requires_payment_method',
    'requires_confirmation',
    'processing',
    'authorized',
    'captured',
    'settled',
    'failed',
    'canceled',
    'refunded'
);

CREATE TYPE "PaymentMethodType" AS ENUM (
    'card',
    'bank_transfer',
    'wallet',
    'crypto',
    'manual'
);

CREATE TABLE "payment_users" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_accounts" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_sessions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "payerLabel" TEXT NOT NULL,
    "destinationLabel" TEXT NOT NULL,
    "methodType" "PaymentMethodType" NOT NULL,
    "provider" TEXT NOT NULL,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fromStatus" "PaymentStatus",
    "toStatus" "PaymentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_users_brandId_email_key" ON "payment_users"("brandId", "email");
CREATE INDEX "payment_accounts_brandId_userId_idx" ON "payment_accounts"("brandId", "userId");
CREATE UNIQUE INDEX "payment_sessions_tokenHash_key" ON "payment_sessions"("tokenHash");
CREATE INDEX "payment_sessions_brandId_userId_idx" ON "payment_sessions"("brandId", "userId");
CREATE UNIQUE INDEX "payments_externalReference_key" ON "payments"("externalReference");
CREATE INDEX "payments_brandId_accountId_createdAt_idx" ON "payments"("brandId", "accountId", "createdAt");
CREATE INDEX "payments_userId_createdAt_idx" ON "payments"("userId", "createdAt");
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");
CREATE INDEX "payment_events_paymentId_createdAt_idx" ON "payment_events"("paymentId", "createdAt");

ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "payment_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "payment_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "payment_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
