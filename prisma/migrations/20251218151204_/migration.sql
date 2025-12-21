-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "affectedSystems" TEXT[],
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "tags" TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "condition" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "incidentRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "slackNotifications" BOOLEAN NOT NULL DEFAULT false,
    "webhookUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "logs_timestamp_idx" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "logs_severity_idx" ON "logs"("severity");

-- CreateIndex
CREATE INDEX "logs_source_idx" ON "logs"("source");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");

-- CreateIndex
CREATE INDEX "incidents_timestamp_idx" ON "incidents"("timestamp");
