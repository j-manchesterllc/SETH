-- CreateTable
CREATE TABLE "UserVault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidAccessTokenEncrypted" TEXT,
    "apifyTokenEncrypted" TEXT,
    "socialTokensEncrypted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    "netProfit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    "netProfit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerMessage" (
    "id" TEXT NOT NULL,
    "sourceAgent" TEXT NOT NULL,
    "targetAgent" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityCard" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceEventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "netBenefit" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL,
    "taxes" DOUBLE PRECISION NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "OpportunityCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyRunway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyRunway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusMessage" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "BusMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserVault_userId_key" ON "UserVault"("userId");

-- CreateIndex
CREATE INDEX "MoneyEvent_userId_idx" ON "MoneyEvent"("userId");

-- CreateIndex
CREATE INDEX "MoneyEvent_status_idx" ON "MoneyEvent"("status");

-- CreateIndex
CREATE INDEX "MoneyEvent_type_idx" ON "MoneyEvent"("type");

-- CreateIndex
CREATE INDEX "BusinessEvent_userId_idx" ON "BusinessEvent"("userId");

-- CreateIndex
CREATE INDEX "BusinessEvent_status_idx" ON "BusinessEvent"("status");

-- CreateIndex
CREATE INDEX "BusinessEvent_type_idx" ON "BusinessEvent"("type");

-- CreateIndex
CREATE INDEX "BrokerMessage_sourceAgent_targetAgent_idx" ON "BrokerMessage"("sourceAgent", "targetAgent");

-- CreateIndex
CREATE INDEX "BrokerMessage_processed_idx" ON "BrokerMessage"("processed");

-- CreateIndex
CREATE INDEX "BrokerMessage_eventType_idx" ON "BrokerMessage"("eventType");

-- CreateIndex
CREATE INDEX "OpportunityCard_sourceEventId_idx" ON "OpportunityCard"("sourceEventId");

-- CreateIndex
CREATE INDEX "OpportunityCard_approved_idx" ON "OpportunityCard"("approved");

-- CreateIndex
CREATE INDEX "OpportunityCard_executed_idx" ON "OpportunityCard"("executed");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyRunway_userId_key" ON "EmergencyRunway"("userId");

-- CreateIndex
CREATE INDEX "EmergencyRunway_userId_idx" ON "EmergencyRunway"("userId");

-- CreateIndex
CREATE INDEX "BusMessage_source_target_idx" ON "BusMessage"("source", "target");

-- CreateIndex
CREATE INDEX "BusMessage_status_idx" ON "BusMessage"("status");

