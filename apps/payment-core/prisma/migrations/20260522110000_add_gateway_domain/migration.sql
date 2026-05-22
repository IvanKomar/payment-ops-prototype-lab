CREATE TYPE "PaymentBalanceTransactionType" AS ENUM (
    'payment_capture',
    'payment_settlement',
    'refund',
    'adjustment'
);

CREATE TABLE "payment_customers" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customerId" TEXT,
    "type" "PaymentMethodType" NOT NULL,
    "label" TEXT NOT NULL,
    "last4" TEXT,
    "brand" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "bankName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "paymentMethodId" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "balance_transactions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "paymentId" TEXT,
    "type" "PaymentBalanceTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payments" ADD COLUMN "customerId" TEXT;
ALTER TABLE "payments" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "payments" ADD COLUMN "paymentIntentId" TEXT;

CREATE UNIQUE INDEX "payment_customers_brandId_accountId_email_key" ON "payment_customers"("brandId", "accountId", "email");
CREATE INDEX "payment_customers_brandId_accountId_createdAt_idx" ON "payment_customers"("brandId", "accountId", "createdAt");
CREATE INDEX "payment_methods_brandId_accountId_createdAt_idx" ON "payment_methods"("brandId", "accountId", "createdAt");
CREATE INDEX "payment_methods_brandId_customerId_createdAt_idx" ON "payment_methods"("brandId", "customerId", "createdAt");
CREATE UNIQUE INDEX "payment_intents_externalReference_key" ON "payment_intents"("externalReference");
CREATE INDEX "payment_intents_brandId_accountId_createdAt_idx" ON "payment_intents"("brandId", "accountId", "createdAt");
CREATE INDEX "payment_intents_brandId_customerId_createdAt_idx" ON "payment_intents"("brandId", "customerId", "createdAt");
CREATE INDEX "payment_intents_status_createdAt_idx" ON "payment_intents"("status", "createdAt");
CREATE INDEX "balance_transactions_brandId_accountId_createdAt_idx" ON "balance_transactions"("brandId", "accountId", "createdAt");
CREATE INDEX "balance_transactions_paymentId_createdAt_idx" ON "balance_transactions"("paymentId", "createdAt");
CREATE INDEX "payments_brandId_customerId_createdAt_idx" ON "payments"("brandId", "customerId", "createdAt");
CREATE INDEX "payments_brandId_paymentMethodId_createdAt_idx" ON "payments"("brandId", "paymentMethodId", "createdAt");
CREATE INDEX "payments_paymentIntentId_idx" ON "payments"("paymentIntentId");

ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "payment_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "payment_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "payment_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "payment_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "payment_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
