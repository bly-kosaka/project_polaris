/*
  Warnings:

  - Added the required column `ownerAccountId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ownerAccountId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "authProvider" TEXT NOT NULL,
    "authSubject" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_authSubject_key" ON "Account"("authSubject");

-- CreateIndex
CREATE INDEX "Project_ownerAccountId_idx" ON "Project"("ownerAccountId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
