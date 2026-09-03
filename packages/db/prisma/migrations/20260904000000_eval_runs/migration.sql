CREATE TABLE "EvalSuiteRun" (
    "id" UUID NOT NULL,
    "suiteId" TEXT NOT NULL,
    "suiteVersion" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "gitSha" TEXT,
    "agentPromptVersion" TEXT NOT NULL,
    "toolSchemaVersion" TEXT NOT NULL,
    "reasoningConfig" TEXT,
    "baselineRunId" UUID,
    "qualityPassed" BOOLEAN NOT NULL DEFAULT false,
    "regressionStatus" TEXT NOT NULL DEFAULT 'no-baseline',
    "thresholdFailures" JSONB NOT NULL,
    "baselineComparison" JSONB NOT NULL,
    "regressions" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelRole" TEXT NOT NULL DEFAULT 'candidate',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "totalCases" INTEGER NOT NULL,
    "passedCases" INTEGER NOT NULL,
    "passRate" DOUBLE PRECISION NOT NULL,
    "toolSelectionAccuracy" DOUBLE PRECISION NOT NULL,
    "numericalAccuracy" DOUBLE PRECISION NOT NULL,
    "groundingRate" DOUBLE PRECISION NOT NULL,
    "hallucinationFreeRate" DOUBLE PRECISION NOT NULL,
    "chartSuccessRate" DOUBLE PRECISION,
    "averageToolCalls" DOUBLE PRECISION NOT NULL,
    "averageTokens" DOUBLE PRECISION,
    "averageCost" DOUBLE PRECISION,
    "averageLatencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID,
    CONSTRAINT "EvalSuiteRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvalCaseResult" (
    "id" UUID NOT NULL,
    "suiteRunId" UUID NOT NULL,
    "caseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expected" JSONB NOT NULL,
    "actualToolSequence" JSONB NOT NULL,
    "expectedFacts" JSONB NOT NULL,
    "observedEvidence" JSONB NOT NULL,
    "actualAnswer" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "agentRunId" UUID,
    "datasetId" UUID,
    "passed" BOOLEAN NOT NULL,
    "scores" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvalCaseResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvalCaseResult_suiteRunId_caseId_key" ON "EvalCaseResult"("suiteRunId", "caseId");
CREATE INDEX "EvalSuiteRun_createdAt_idx" ON "EvalSuiteRun"("createdAt");
CREATE INDEX "EvalSuiteRun_model_createdAt_idx" ON "EvalSuiteRun"("model", "createdAt");
CREATE INDEX "EvalCaseResult_suiteRunId_createdAt_idx" ON "EvalCaseResult"("suiteRunId", "createdAt");
CREATE INDEX "EvalCaseResult_agentRunId_idx" ON "EvalCaseResult"("agentRunId");
CREATE INDEX "EvalCaseResult_datasetId_idx" ON "EvalCaseResult"("datasetId");

ALTER TABLE "EvalSuiteRun" ADD CONSTRAINT "EvalSuiteRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvalCaseResult" ADD CONSTRAINT "EvalCaseResult_suiteRunId_fkey" FOREIGN KEY ("suiteRunId") REFERENCES "EvalSuiteRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvalCaseResult" ADD CONSTRAINT "EvalCaseResult_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvalCaseResult" ADD CONSTRAINT "EvalCaseResult_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
