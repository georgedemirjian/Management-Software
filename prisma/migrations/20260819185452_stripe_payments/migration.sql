-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ADD COLUMN     "stripeFeeCents" INTEGER;

-- AlterTable
ALTER TABLE "tenant" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_stripeAccountId_key" ON "organization"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_stripeCheckoutSessionId_key" ON "payment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_stripeCustomerId_key" ON "tenant"("stripeCustomerId");
