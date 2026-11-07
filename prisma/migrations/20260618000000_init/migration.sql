CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "extra" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageData" TEXT,
    "imageMeta" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DraftVersion" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DraftVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditRun" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "pillarSummaries" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "suppressed" INTEGER NOT NULL DEFAULT 0,
    "redactedPreview" TEXT,
    "aiLedger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingAction" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "note" TEXT,
    "appliedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FindingAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "draftId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VaultItem_clauseId_key" ON "VaultItem"("clauseId");
CREATE INDEX "DraftVersion_draftId_idx" ON "DraftVersion"("draftId");
CREATE INDEX "AuditRun_draftId_idx" ON "AuditRun"("draftId");
CREATE INDEX "FindingAction_auditId_idx" ON "FindingAction"("auditId");
CREATE INDEX "Comment_draftId_idx" ON "Comment"("draftId");

ALTER TABLE "DraftVersion"
    ADD CONSTRAINT "DraftVersion_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "Draft"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingAction"
    ADD CONSTRAINT "FindingAction_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "AuditRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "Draft"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
