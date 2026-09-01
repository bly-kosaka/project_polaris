-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnalysisLifecycleStatus" AS ENUM ('CREATED', 'UPLOADED', 'ANALYZING', 'ANALYZER_RESULT_READY', 'EXPLAINING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalyzerExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AIExecutionStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "KnownInformationMatchType" AS ENUM ('EXACT', 'PREFIX');

-- CreateEnum
CREATE TYPE "KnownInformationTarget" AS ENUM ('PATH');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "primaryUrl" TEXT,
    "hostname" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "AnalysisLifecycleStatus" NOT NULL DEFAULT 'CREATED',
    "analyzerStatus" "AnalyzerExecutionStatus",
    "aiStatus" "AIExecutionStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "originalFileName" TEXT,
    "fileSizeBytes" INTEGER,
    "detectedLogFormat" TEXT,
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "totalLineCount" INTEGER,
    "totalRequestCount" INTEGER,
    "observationSetVersion" TEXT,
    "analyzerConfigurationVersion" TEXT,
    "knownInformationDatasetVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationSetRecord" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationSetRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectKnownInformation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "target" "KnownInformationTarget" NOT NULL DEFAULT 'PATH',
    "matchType" "KnownInformationMatchType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectKnownInformation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Analysis_projectId_idx" ON "Analysis"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservationSetRecord_analysisId_key" ON "ObservationSetRecord"("analysisId");

-- CreateIndex
CREATE INDEX "ProjectKnownInformation_projectId_enabled_idx" ON "ProjectKnownInformation"("projectId", "enabled");

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationSetRecord" ADD CONSTRAINT "ObservationSetRecord_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectKnownInformation" ADD CONSTRAINT "ProjectKnownInformation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
