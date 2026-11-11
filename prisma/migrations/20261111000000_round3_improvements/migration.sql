-- Round 3 Improvements Migration
-- 1. User model for authentication & RBAC
-- 2. VaultItemVersion for rule versioning
-- 3. vaultSnapshot on AuditRun for audit lineage
-- 4. ruleVer on VaultItem for version tracking

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'creator',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "VaultItemVersion" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "extra" TEXT,
    "active" BOOLEAN NOT NULL,
    "editedBy" TEXT NOT NULL DEFAULT 'Dev Kapoor',
    "editNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultItemVersion_vaultItemId_idx" ON "VaultItemVersion"("vaultItemId");

-- AddForeignKey
ALTER TABLE "VaultItemVersion" ADD CONSTRAINT "VaultItemVersion_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add ruleVer to VaultItem
ALTER TABLE "VaultItem" ADD COLUMN "ruleVer" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: add vaultSnapshot to AuditRun
ALTER TABLE "AuditRun" ADD COLUMN "vaultSnapshot" TEXT;

-- Preserve the actual visual asset and metadata in every historical version.
ALTER TABLE "DraftVersion" ADD COLUMN "imageData" TEXT;
ALTER TABLE "DraftVersion" ADD COLUMN "imageMeta" TEXT;

CREATE UNIQUE INDEX "VaultItemVersion_vaultItemId_version_key" ON "VaultItemVersion"("vaultItemId", "version");
CREATE UNIQUE INDEX "DraftVersion_draftId_version_key" ON "DraftVersion"("draftId", "version");
