-- CreateEnum
CREATE TYPE "UploadedAccessLogStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'DELETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RawLogDeletionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisExecutionType" AS ENUM ('ANALYZER', 'AI_EXPLANATION');

-- CreateEnum
CREATE TYPE "AnalysisExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "UploadedAccessLog" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT,
    "storageKey" TEXT NOT NULL,
    "status" "UploadedAccessLogStatus" NOT NULL DEFAULT 'UPLOADED',
    "deletionStatus" "RawLogDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UploadedAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisExecution" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" "AnalysisExecutionType" NOT NULL,
    "status" "AnalysisExecutionStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadedAccessLog_analysisId_key" ON "UploadedAccessLog"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisExecution_analysisId_type_key" ON "AnalysisExecution"("analysisId", "type");

-- AddForeignKey
ALTER TABLE "UploadedAccessLog" ADD CONSTRAINT "UploadedAccessLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisExecution" ADD CONSTRAINT "AnalysisExecution_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
