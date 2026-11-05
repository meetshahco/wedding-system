-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('not_invited', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('template', 'text', 'inbound');

-- CreateEnum
CREATE TYPE "MessageLogStatus" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('draft', 'scheduled', 'running', 'done', 'cancelled');

-- CreateTable
CREATE TABLE "Wedding" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coupleName1" TEXT NOT NULL,
    "coupleName2" TEXT NOT NULL,
    "weddingDate" TIMESTAMP(3) NOT NULL,
    "accentColor" TEXT NOT NULL DEFAULT '#111111',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "mapUrl" TEXT NOT NULL DEFAULT '',
    "dressCode" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLevel" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AccessLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLevelEvent" (
    "accessLevelId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "AccessLevelEvent_pkey" PRIMARY KEY ("accessLevelId","eventId")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "pax" INTEGER NOT NULL DEFAULT 1,
    "accessLevelId" TEXT,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'not_invited',
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "buttons" TEXT NOT NULL,
    "sampleValues" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT '',
    "reminderId" TEXT,
    "provider" TEXT NOT NULL DEFAULT '',
    "status" "MessageLogStatus" NOT NULL DEFAULT 'queued',
    "externalMessageId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "audienceFilter" TEXT NOT NULL,
    "variableMap" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "weddingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("weddingId","key")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wedding_slug_key" ON "Wedding"("slug");

-- CreateIndex
CREATE INDEX "Event_weddingId_idx" ON "Event"("weddingId");

-- CreateIndex
CREATE INDEX "AccessLevel_weddingId_idx" ON "AccessLevel"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessLevel_weddingId_name_key" ON "AccessLevel"("weddingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_token_key" ON "Guest"("token");

-- CreateIndex
CREATE INDEX "Guest_weddingId_idx" ON "Guest"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_weddingId_phone_key" ON "Guest"("weddingId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_weddingId_code_key" ON "Guest"("weddingId", "code");

-- CreateIndex
CREATE INDEX "MessageTemplate_weddingId_idx" ON "MessageTemplate"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_weddingId_key_key" ON "MessageTemplate"("weddingId", "key");

-- CreateIndex
CREATE INDEX "MessageLog_weddingId_idx" ON "MessageLog"("weddingId");

-- CreateIndex
CREATE INDEX "MessageLog_status_nextAttemptAt_idx" ON "MessageLog"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_weddingId_guestId_templateKey_kind_reminderId_key" ON "MessageLog"("weddingId", "guestId", "templateKey", "kind", "reminderId");

-- CreateIndex
CREATE INDEX "Reminder_weddingId_idx" ON "Reminder"("weddingId");

-- CreateIndex
CREATE INDEX "Setting_weddingId_idx" ON "Setting"("weddingId");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_action_key" ON "RateLimit"("key", "action");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLevel" ADD CONSTRAINT "AccessLevel_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLevelEvent" ADD CONSTRAINT "AccessLevelEvent_accessLevelId_fkey" FOREIGN KEY ("accessLevelId") REFERENCES "AccessLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLevelEvent" ADD CONSTRAINT "AccessLevelEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_accessLevelId_fkey" FOREIGN KEY ("accessLevelId") REFERENCES "AccessLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

