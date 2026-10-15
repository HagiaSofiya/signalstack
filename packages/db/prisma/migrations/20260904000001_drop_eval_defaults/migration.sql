-- AlterTable
ALTER TABLE "EvalCaseResult" ALTER COLUMN "critical" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EvalSuiteRun" ALTER COLUMN "qualityPassed" DROP DEFAULT,
ALTER COLUMN "regressionStatus" DROP DEFAULT,
ALTER COLUMN "modelRole" DROP DEFAULT;
