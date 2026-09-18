import { completeAgentRunRecord, completeEvalSuiteRun, createAgentRunRecord, createEvalSuiteRun, failAgentRunRecord, persistAgentStep, persistEvalCaseResult } from "@signalstack/db";
import {
  chartSpecSchema,
  type AgentStep,
  type EvalCase,
  type EvalCaseResult,
  type EvalFact,
  type EvalScore,
  type EvalSuiteRun,
  type EvalSuiteRunDetail,
  type EvalThresholds,
} from "@signalstack/schemas";

import { aiEnv } from "../config.js";
import { calculateEstimatedCost } from "../providers/pricing.js";
import type { LLMProvider } from "../providers/provider.js";
import { AgentExecutionError, runAgent } from "../agent/runAgent.js";
import { verifyAnswer } from "../grounding/verifyAnswer.js";
import { LLMProviderError } from "../providers/provider.js";
import { analyzeDatasetTool } from "../tools/analyzeDatasetTool.js";
import { createChart } from "../tools/createChartTool.js";
import { inspectDatasetTool } from "../tools/inspectDatasetTool.js";
import { assessRegression, type RegressionAssessment } from "./regression.js";

export type EvalGroundTruth = Map<string, EvalFact[]>;

export type EvalSuiteResult = {
  suiteRun: EvalSuiteRun;
  cases: EvalCaseResult[];
  assessment: RegressionAssessment;
};

export class EvalInfrastructureError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "EvalInfrastructureError";
  }
}

export async function runEvalSuite(input: {
  datasetId: string;
  projectId: string;
  cases: EvalCase[];
  groundTruth?: EvalGroundTruth;
  provider?: LLMProvider;
  providerName?: string;
  model?: string;
  modelRole?: "baseline" | "candidate";
  suiteId: string;
  suiteVersion: string;
  datasetVersion: string;
  gitSha?: string | null;
  agentPromptVersion: string;
  toolSchemaVersion: string;
  reasoningConfig?: string | null;
  thresholds: EvalThresholds;
  baseline?: EvalSuiteRunDetail | null;
}): Promise<EvalSuiteResult> {
  const provider = input.provider ?? (await import("../providers/index.js")).createLLMProvider();
  const providerName = input.providerName ?? aiEnv.AI_PROVIDER;
  const model = input.model ?? aiEnv.AI_MODEL;
  const startedAt = new Date();
  const suiteRun = await createEvalSuiteRun({
    suiteId: input.suiteId,
    suiteVersion: input.suiteVersion,
    datasetVersion: input.datasetVersion,
    gitSha: input.gitSha,
    agentPromptVersion: input.agentPromptVersion,
    toolSchemaVersion: input.toolSchemaVersion,
    reasoningConfig: input.reasoningConfig,
    baselineRunId: input.baseline?.id,
    provider: providerName,
    model,
    modelRole: input.modelRole ?? "candidate",
    startedAt,
    totalCases: input.cases.length,
    projectId: input.projectId,
  });
  const results: EvalCaseResult[] = [];

  for (const definition of input.cases) {
    const expectedFacts = input.groundTruth?.get(definition.id) ?? definition.expected.expectedAnswerFacts;
    const testCase: EvalCase = { ...definition, expected: { ...definition.expected, expectedAnswerFacts: expectedFacts } };
    results.push(await runCase({ suiteRunId: suiteRun.id, datasetId: input.datasetId, projectId: input.projectId, testCase, provider, providerName, model }));
  }

  const summary = summarize(results);
  const assessment = assessRegression({ current: { ...suiteRun, ...summary }, cases: results, thresholds: input.thresholds, baseline: input.baseline });
  const completedSuiteRun = await completeEvalSuiteRun({ id: suiteRun.id, ...summary, ...assessment });
  return { suiteRun: completedSuiteRun, cases: results, assessment };
}

async function runCase(input: {
  suiteRunId: string;
  datasetId: string;
  projectId: string;
  testCase: EvalCase;
  provider: LLMProvider;
  providerName: string;
  model: string;
}): Promise<EvalCaseResult> {
  const startedAt = performance.now();
  let agentRunId: string | null = null;
  let answer = "";
  let steps: AgentStep[] = [];
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let totalTokens: number | null = null;
  let estimatedCost: number | null = null;
  let durationMs = 0;
  let failureReason: string | null = null;

  try {
    const run = await createAgentRunRecord({
      projectId: input.projectId,
      datasetId: input.datasetId,
      question: input.testCase.question,
      provider: input.providerName,
      model: input.model,
    });
    agentRunId = run.id;
    const persisted: AgentStep[] = [];
    const result = await runAgent({
      question: input.testCase.question,
      datasetId: input.datasetId,
      provider: input.provider,
      tools: [inspectDatasetTool, analyzeDatasetTool, createChart],
      agentRunId: run.id,
      onStep: async (step) => {
        persisted.push(await persistAgentStep({ agentRunId: run.id, step }));
        steps = persisted;
      },
    });
    steps = persisted;
    answer = result.answer;
    inputTokens = result.usage.inputTokens;
    outputTokens = result.usage.outputTokens;
    totalTokens = result.usage.totalTokens;
    estimatedCost = calculateEstimatedCost({ provider: input.providerName, model: result.model, inputTokens, outputTokens });
    durationMs = result.totalDurationMs;
    await completeAgentRunRecord({ id: run.id, provider: input.providerName, model: result.model, inputTokens, outputTokens, totalTokens, estimatedCost, durationMs });
  } catch (error) {
    durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    failureReason = error instanceof Error ? error.message : "Evaluation agent run failed";
    if (agentRunId) await failAgentRunRecord(agentRunId, durationMs).catch(() => undefined);
    if (isInfrastructureError(error, steps)) throw new EvalInfrastructureError(failureReason, error);
  }

  const infrastructureStep = steps.find((step) => step.status === "failed" && step.toolName !== null && isInfrastructureMessage(step.output));
  if (infrastructureStep) {
    if (agentRunId) await failAgentRunRecord(agentRunId, durationMs).catch(() => undefined);
    throw new EvalInfrastructureError(`Evaluation tool ${infrastructureStep.toolName} failed: ${readError(infrastructureStep.output)}`);
  }

  const evaluation = scoreCase(input.testCase, steps, answer);
  const metrics = {
    toolCalls: steps.filter((step) => step.toolName !== null).length,
    failedToolCalls: steps.filter((step) => step.toolName !== null && step.status === "failed").length,
    repeatedToolCalls: repeatedToolCalls(steps),
    unnecessaryInspectCalls: unnecessaryInspectCalls(steps),
    durationMs,
    totalTokens,
    estimatedCost,
  };
  const reason = evaluation.passed ? failureReason : [failureReason, ...evaluation.reasons].filter(Boolean).join("; ") || "Evaluation criteria were not met";

  return persistEvalCaseResult({
    suiteRunId: input.suiteRunId,
    caseId: input.testCase.id,
    category: input.testCase.category,
    question: input.testCase.question,
    expected: input.testCase.expected,
    actualToolSequence: steps.filter((step) => step.toolName !== null).map((step) => ({
      stepId: step.id,
      toolName: step.toolName,
      operation: operationFromStep(step),
      status: step.status,
      durationMs: step.durationMs,
    })),
    expectedFacts: input.testCase.expected.expectedAnswerFacts,
    observedEvidence: steps.filter((step) => step.toolName === "analyze_dataset" && step.status === "completed").map((step) => step.output),
    actualAnswer: answer,
    critical: input.testCase.critical,
    agentRunId,
    datasetId: input.datasetId,
    passed: evaluation.passed && failureReason === null,
    scores: evaluation.scores,
    metrics,
    failureReason: reason,
  });
}

function isInfrastructureError(error: unknown, steps: AgentStep[]) {
  if (error instanceof LLMProviderError) return true;
  if (error instanceof AgentExecutionError && error.cause instanceof LLMProviderError) return true;
  return steps.some((step) => step.status === "failed" && step.toolName !== null && isInfrastructureMessage(step.output));
}

function isInfrastructureMessage(value: unknown) {
  const message = readError(value).toLowerCase();
  return message.includes("analysis service is unavailable") || message.includes("could not inspect this dataset") || message.includes("returned an invalid inspection") || message.includes("selected dataset was not found");
}

function readError(value: unknown) {
  const record = asRecord(value);
  return typeof record?.error === "string" ? record.error : "unknown error";
}

function scoreCase(testCase: EvalCase, steps: AgentStep[], answer: string): { passed: boolean; scores: EvalScore; reasons: string[] } {
  const toolSteps = steps.filter((step) => step.toolName !== null);
  const completedToolSteps = toolSteps.filter((step) => step.status === "completed");
  const requiredTools = testCase.expected.requiredTools.every((tool) => completedToolSteps.some((step) => step.toolName === tool));
  const forbiddenTools = testCase.expected.forbiddenTools.every((tool) => !toolSteps.some((step) => step.toolName === tool));
  const expectedOperation = testCase.expected.expectedOperation === null || completedToolSteps.some((step) => step.toolName === "analyze_dataset" && operationFromStep(step) === testCase.expected.expectedOperation);
  const toolSelection = requiredTools && forbiddenTools && expectedOperation ? 1 : 0;

  const expectedFacts = testCase.expected.expectedAnswerFacts;
  // Facts must come from a tool result. Searching every step would also search the verification
  // step, whose claims carry values read back out of the answer itself.
  const numericalCorrectness = expectedFacts.length === 0 || expectedFacts.every((expected) => completedToolSteps.some((step) => factFound(step.output, expected))) ? 1 : 0;
  const verification = verifyAnswer({ answer, steps });
  const unsupportedNumbers = verification.claims.some((claim) => !claim.supported);
  const grounding = numericalCorrectness && !unsupportedNumbers ? 1 : 0;
  const unsupportedColumns = testCase.category === "recovery" ? [] : verification.unsupportedColumns;
  const hallucination = unsupportedColumns.length === 0 && !unsupportedNumbers ? 1 : 0;

  let chartCorrectness: number | null = null;
  if (testCase.expected.requiresChart) {
    const analysisIds = new Set(completedToolSteps.filter((step) => step.toolName === "analyze_dataset").map((step) => step.id));
    const charts = completedToolSteps.filter((step) => step.toolName === "create_chart");
    chartCorrectness = charts.length > 0 && charts.every((step) => {
      const parsed = chartSpecSchema.safeParse(step.output);
      return parsed.success && analysisIds.has(parsed.data.sourceStepId) && parsed.data.data.every((row) => parsed.data.series.every((series) => typeof row[series.key] === "number" && Object.prototype.hasOwnProperty.call(row, parsed.data.xKey)));
    }) ? 1 : 0;
  }

  const scores: EvalScore = { toolSelection, numericalCorrectness, grounding, hallucination, chartCorrectness };
  const reasons = [
    toolSelection ? null : "tool selection did not match expected behavior",
    numericalCorrectness ? null : "expected deterministic facts were not present in tool outputs",
    grounding ? null : "answer claims could not be mapped to tool outputs",
    hallucination ? null : "answer referenced unsupported claims or columns",
    chartCorrectness === null || chartCorrectness === 1 ? null : "required chart was missing or not grounded",
  ];
  return { passed: Object.values(scores).every((score) => score === null || score === 1), scores, reasons: reasons.filter((reason): reason is string => reason !== null) };
}

function operationFromStep(step: AgentStep): string | null {
  const output = asRecord(step.output);
  return typeof output?.operation === "string" ? output.operation : null;
}

function factFound(output: unknown, expected: EvalFact): boolean {
  return findFieldValues(output, expected.field).some((value) => matches(value, expected.value, expected.tolerance));
}

function findFieldValues(value: unknown, field: string): unknown[] {
  if (Array.isArray(value)) return value.flatMap((item) => findFieldValues(item, field));
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([key, child]) => [ ...(key === field ? [child] : []), ...findFieldValues(child, field) ]);
}

function matches(actual: unknown, expected: unknown, tolerance = 0) {
  if (typeof actual === "number" && typeof expected === "number") return Math.abs(actual - expected) <= Math.max(tolerance, Math.abs(expected) * 0.01);
  return actual === expected || String(actual) === String(expected);
}

function repeatedToolCalls(steps: AgentStep[]) {
  const signatures = steps.filter((step) => step.toolName !== null).map((step) => `${step.toolName}:${JSON.stringify(step.input)}`);
  return signatures.length - new Set(signatures).size;
}

function unnecessaryInspectCalls(steps: AgentStep[]) {
  let seenCompletedInspect = false;
  return steps.filter((step) => {
    if (step.toolName !== "inspect_dataset") return false;
    const unnecessary = seenCompletedInspect;
    if (step.status === "completed") seenCompletedInspect = true;
    return unnecessary;
  }).length;
}

function summarize(results: EvalCaseResult[]) {
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const scores = (key: keyof EvalScore) => {
    const values = results.map((result) => result.scores[key]).filter((value): value is number => value !== null);
    return values.length ? average(values) : 0;
  };
  const chartValues = results.map((result) => result.scores.chartCorrectness).filter((value): value is number => value !== null);
  const tokens = results.map((result) => result.metrics.totalTokens).filter((value): value is number => value !== null);
  const costs = results.map((result) => result.metrics.estimatedCost).filter((value): value is number => value !== null);
  return {
    passedCases: results.filter((result) => result.passed).length,
    passRate: results.length ? results.filter((result) => result.passed).length / results.length : 0,
    toolSelectionAccuracy: scores("toolSelection"),
    numericalAccuracy: scores("numericalCorrectness"),
    groundingRate: scores("grounding"),
    hallucinationFreeRate: scores("hallucination"),
    chartSuccessRate: chartValues.length ? average(chartValues) : null,
    averageToolCalls: average(results.map((result) => result.metrics.toolCalls)),
    averageTokens: tokens.length ? average(tokens) : null,
    averageCost: costs.length ? average(costs) : null,
    averageLatencyMs: Math.round(average(results.map((result) => result.metrics.durationMs))),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
