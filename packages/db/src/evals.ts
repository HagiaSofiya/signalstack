import { Prisma, type EvalCaseResult as PrismaEvalCaseResult, type EvalSuiteRun as PrismaEvalSuiteRun } from "@prisma/client";
import {
  evalCaseResultSchema,
  evalSuiteRunDetailSchema,
  evalSuiteRunSchema,
  type EvalCaseResult,
  type EvalSuiteRun,
  type EvalSuiteRunDetail,
} from "@signalstack/schemas";

import { getDb } from "./client.js";

function toSuiteRun(run: PrismaEvalSuiteRun): EvalSuiteRun {
  return evalSuiteRunSchema.parse({
    id: run.id,
    suiteId: run.suiteId,
    suiteVersion: run.suiteVersion,
    datasetVersion: run.datasetVersion,
    gitSha: run.gitSha,
    agentPromptVersion: run.agentPromptVersion,
    toolSchemaVersion: run.toolSchemaVersion,
    reasoningConfig: run.reasoningConfig,
    baselineRunId: run.baselineRunId,
    qualityPassed: run.qualityPassed,
    regressionStatus: run.regressionStatus,
    thresholdFailures: run.thresholdFailures,
    baselineComparison: run.baselineComparison,
    provider: run.provider,
    model: run.model,
    modelRole: run.modelRole,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    totalCases: run.totalCases,
    passedCases: run.passedCases,
    passRate: run.passRate,
    toolSelectionAccuracy: run.toolSelectionAccuracy,
    numericalAccuracy: run.numericalAccuracy,
    groundingRate: run.groundingRate,
    hallucinationFreeRate: run.hallucinationFreeRate,
    chartSuccessRate: run.chartSuccessRate,
    averageToolCalls: run.averageToolCalls,
    averageTokens: run.averageTokens,
    averageCost: run.averageCost,
    averageLatencyMs: run.averageLatencyMs,
    createdAt: run.createdAt.toISOString(),
  });
}

function toCaseResult(result: PrismaEvalCaseResult): EvalCaseResult {
  return evalCaseResultSchema.parse({
    id: result.id,
    suiteRunId: result.suiteRunId,
    caseId: result.caseId,
    category: result.category,
    question: result.question,
    expected: result.expected,
    actualToolSequence: result.actualToolSequence,
    expectedFacts: result.expectedFacts,
    observedEvidence: result.observedEvidence,
    actualAnswer: result.actualAnswer,
    critical: result.critical,
    agentRunId: result.agentRunId,
    datasetId: result.datasetId,
    passed: result.passed,
    scores: result.scores,
    metrics: result.metrics,
    failureReason: result.failureReason,
    createdAt: result.createdAt.toISOString(),
  });
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createEvalSuiteRun(input: {
  suiteId: string;
  suiteVersion: string;
  datasetVersion: string;
  gitSha?: string | null;
  agentPromptVersion: string;
  toolSchemaVersion: string;
  reasoningConfig?: string | null;
  baselineRunId?: string | null;
  provider: string;
  model: string;
  modelRole: "baseline" | "candidate";
  startedAt: Date;
  totalCases: number;
  projectId?: string;
}): Promise<EvalSuiteRun> {
  const run = await getDb().evalSuiteRun.create({
    data: {
      suiteId: input.suiteId,
      suiteVersion: input.suiteVersion,
      datasetVersion: input.datasetVersion,
      gitSha: input.gitSha ?? null,
      agentPromptVersion: input.agentPromptVersion,
      toolSchemaVersion: input.toolSchemaVersion,
      reasoningConfig: input.reasoningConfig ?? null,
      baselineRunId: input.baselineRunId ?? null,
      qualityPassed: false,
      regressionStatus: "no-baseline",
      thresholdFailures: [],
      baselineComparison: [],
      regressions: [],
      improvements: [],
      provider: input.provider,
      model: input.model,
      modelRole: input.modelRole,
      startedAt: input.startedAt,
      totalCases: input.totalCases,
      passedCases: 0,
      passRate: 0,
      toolSelectionAccuracy: 0,
      numericalAccuracy: 0,
      groundingRate: 0,
      hallucinationFreeRate: 0,
      chartSuccessRate: null,
      averageToolCalls: 0,
      averageTokens: null,
      averageCost: null,
      averageLatencyMs: 0,
      ...(input.projectId ? { projectId: input.projectId } : {}),
    },
  });
  return toSuiteRun(run);
}

export async function persistEvalCaseResult(input: {
  suiteRunId: string;
  caseId: string;
  category: string;
  question: string;
  expected: unknown;
  actualToolSequence: unknown;
  expectedFacts: unknown;
  observedEvidence: unknown;
  actualAnswer: string;
  critical: boolean;
  agentRunId: string | null;
  datasetId: string | null;
  passed: boolean;
  scores: unknown;
  metrics: unknown;
  failureReason: string | null;
}): Promise<EvalCaseResult> {
  const result = await getDb().evalCaseResult.create({
    data: {
      suiteRunId: input.suiteRunId,
      caseId: input.caseId,
      category: input.category,
      question: input.question,
      expected: json(input.expected),
      actualToolSequence: json(input.actualToolSequence),
      expectedFacts: json(input.expectedFacts),
      observedEvidence: json(input.observedEvidence),
      actualAnswer: input.actualAnswer,
      critical: input.critical,
      agentRunId: input.agentRunId,
      datasetId: input.datasetId,
      passed: input.passed,
      scores: json(input.scores),
      metrics: json(input.metrics),
      failureReason: input.failureReason,
    },
  });
  return toCaseResult(result);
}

export async function completeEvalSuiteRun(input: {
  id: string;
  passedCases: number;
  passRate: number;
  toolSelectionAccuracy: number;
  numericalAccuracy: number;
  groundingRate: number;
  hallucinationFreeRate: number;
  chartSuccessRate: number | null;
  averageToolCalls: number;
  averageTokens: number | null;
  averageCost: number | null;
  averageLatencyMs: number;
  qualityPassed: boolean;
  regressionStatus: "passed" | "failed" | "no-baseline";
  thresholdFailures: string[];
  baselineComparison: unknown[];
  regressions: unknown[];
  improvements: unknown[];
  completedAt?: Date;
}): Promise<EvalSuiteRun> {
  const run = await getDb().evalSuiteRun.update({
    where: { id: input.id },
    data: {
      passedCases: input.passedCases,
      passRate: input.passRate,
      toolSelectionAccuracy: input.toolSelectionAccuracy,
      numericalAccuracy: input.numericalAccuracy,
      groundingRate: input.groundingRate,
      hallucinationFreeRate: input.hallucinationFreeRate,
      chartSuccessRate: input.chartSuccessRate,
      averageToolCalls: input.averageToolCalls,
      averageTokens: input.averageTokens,
      averageCost: input.averageCost,
      averageLatencyMs: input.averageLatencyMs,
      qualityPassed: input.qualityPassed,
      regressionStatus: input.regressionStatus,
      thresholdFailures: json(input.thresholdFailures),
      baselineComparison: json(input.baselineComparison),
      regressions: json(input.regressions),
      improvements: json(input.improvements),
      completedAt: input.completedAt ?? new Date(),
    },
  });
  return toSuiteRun(run);
}

export async function listEvalSuiteRuns(limit = 20): Promise<EvalSuiteRun[]> {
  const runs = await getDb().evalSuiteRun.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit });
  return runs.map(toSuiteRun);
}

export async function findLatestEvalSuiteRun(suiteId: string): Promise<EvalSuiteRunDetail | null> {
  const latest = await getDb().evalSuiteRun.findFirst({ where: { suiteId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
  return latest ? findEvalSuiteRunWithCases(latest.id) : null;
}

export async function findEvalSuiteRunWithCases(id: string): Promise<EvalSuiteRunDetail | null> {
  const result = await getDb().evalSuiteRun.findUnique({
    where: { id },
    include: { cases: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  if (!result) return null;
  return evalSuiteRunDetailSchema.parse({
    ...toSuiteRun(result),
    cases: result.cases.map(toCaseResult),
    regressions: result.regressions,
    improvements: result.improvements,
  });
}
