CREATE TYPE "SmsStatus" AS ENUM ('queued', 'processing', 'sent', 'failed');

CREATE TABLE "sms_messages" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "status" "SmsStatus" NOT NULL,
    "selectedProvider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_messages_idempotencyKey_key" ON "sms_messages"("idempotencyKey");
