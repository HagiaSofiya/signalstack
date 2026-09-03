import { describe, expect, it } from "vitest";
import { evalThresholdsSchema, type EvalCaseResult, type EvalSuiteRun, type EvalSuiteRunDetail } from "@signalstack/schemas";

import { assessRegression, compareMetrics, EvalConfigError } from "./regression.js";
import { infrastructureExitCode, parseEvalArgs, qualityExitCode } from "./cli-utils.js";

const thresholds = evalThresholdsSchema.parse({
  minimumPassRate: 0.9,
  minimumToolSelectionAccuracy: 0.95,
  minimumNumericalAccuracy: 1,
  minimumGroundingRate: 0.95,
  maximumHallucinationRate: 0,
  maximumAverageCost: 0.03,
  maximumAverageToolCalls: 4,
  maximumPassRateRegression: 0.05,
  maximumGroundingRegression: 0.05,
  criticalCasesMustPass: true,
});

function run(overrides: Partial<EvalSuiteRun> = {}): EvalSuiteRun {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    suiteId: "signalstack-core",
    suiteVersion: "1.0.0",
    datasetVersion: "demo-v1",
    gitSha: null,
    agentPromptVersion: "v1",
    toolSchemaVersion: "v1",
    reasoningConfig: null,
    baselineRunId: null,
    qualityPassed: true,
    regressionStatus: "no-baseline",
    thresholdFailures: [],
    baselineComparison: [],
    provider: "mock",
    model: "mock-model",
    modelRole: "candidate",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    totalCases: 2,
    passedCases: 2,
    passRate: 1,
    toolSelectionAccuracy: 1,
    numericalAccuracy: 1,
    groundingRate: 1,
    hallucinationFreeRate: 1,
    chartSuccessRate: null,
    averageToolCalls: 2,
    averageTokens: 100,
    averageCost: 0.01,
    averageLatencyMs: 1000,
    createdAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  };
}

function result(caseId: string, passed: boolean, critical = false): EvalCaseResult {
  return {
    id: `00000000-0000-0000-0000-${caseId.padEnd(12, "0").slice(0, 12)}`,
    suiteRunId: "00000000-0000-0000-0000-000000000001",
    caseId,
    category: "analysis",
    question: "Question",
    critical,
    expected: { requiredTools: [], forbiddenTools: [], expectedOperation: null, expectedAnswerFacts: [], requiresChart: false },
    actualToolSequence: [],
    expectedFacts: [],
    observedEvidence: [],
    actualAnswer: "Answer",
    agentRunId: null,
    datasetId: null,
    passed,
    scores: { toolSelection: 1, numericalCorrectness: 1, grounding: 1, hallucination: 1, chartCorrectness: null },
    metrics: { toolCalls: 1, failedToolCalls: 0, repeatedToolCalls: 0, unnecessaryInspectCalls: 0, durationMs: 10, totalTokens: 10, estimatedCost: 0.001 },
    failureReason: passed ? null : "incorrect_value",
    createdAt: "2026-01-01T00:01:00.000Z",
  };
}

function detail(runValue: EvalSuiteRun, cases: EvalCaseResult[]): EvalSuiteRunDetail { return { ...runValue, cases, regressions: [], improvements: [] }; }

describe("evaluation regression gates", () => {
  it("passes when all configured thresholds pass", () => {
    const assessment = assessRegression({ current: run(), cases: [result("critical", true, true), result("normal", true)], thresholds });
    expect(assessment.qualityPassed).toBe(true);
    expect(assessment.regressionStatus).toBe("no-baseline");
  });

  it("fails aggregate thresholds, hallucination, and cost", () => {
    const assessment = assessRegression({ current: run({ passRate: 0.8, toolSelectionAccuracy: 0.9, numericalAccuracy: 0.9, groundingRate: 0.9, hallucinationFreeRate: 0.9, averageCost: 0.04, averageToolCalls: 5 }), cases: [result("normal", true)], thresholds });
    expect(assessment.qualityPassed).toBe(false);
    expect(assessment.thresholdFailures.join(" ")).toContain("hallucination rate");
    expect(assessment.thresholdFailures.join(" ")).toContain("average cost");
  });

  it("fails a critical case even when aggregate metrics pass", () => {
    const assessment = assessRegression({ current: run(), cases: [result("critical", false, true), result("normal", true)], thresholds });
    expect(assessment.qualityPassed).toBe(false);
    expect(assessment.thresholdFailures).toContain("critical case critical failed");
  });

  it("detects regressions and newly fixed cases by case ID", () => {
    const baseline = detail(run({ id: "00000000-0000-0000-0000-000000000002" }), [result("regressed", true), result("fixed", false)]);
    const assessment = assessRegression({ current: run({ passRate: 0.5, groundingRate: 0.8 }), cases: [result("regressed", false), result("fixed", true)], thresholds, baseline });
    expect(assessment.regressions[0]?.caseId).toBe("regressed");
    expect(assessment.improvements[0]?.caseId).toBe("fixed");
    expect(assessment.qualityPassed).toBe(false);
  });

  it("reports cost regression even when it remains within the absolute cap", () => {
    const baseline = run({ averageCost: 0.01 });
    const comparison = compareMetrics(run({ averageCost: 0.02 }), baseline).find((metric) => metric.metric === "averageCost");
    expect(comparison?.status).toBe("regressed");
    expect(comparison?.percentDelta).toBe(1);
  });

  it("fails on a hallucination threshold", () => {
    const assessment = assessRegression({ current: run({ hallucinationFreeRate: 0.99 }), cases: [result("normal", true)], thresholds });
    expect(assessment.qualityPassed).toBe(false);
  });

  it("rejects malformed thresholds and mismatched suite versions", () => {
    expect(() => evalThresholdsSchema.parse({ minimumPassRate: 2 })).toThrow();
    expect(() => assessRegression({ current: run(), cases: [result("normal", true)], thresholds, baseline: detail(run({ suiteVersion: "2.0.0" }), [result("normal", true)]) })).toThrow(EvalConfigError);
  });

  it("provides CI exit codes and validates CLI arguments", () => {
    expect(qualityExitCode(true)).toBe(0);
    expect(qualityExitCode(false)).toBe(1);
    expect(infrastructureExitCode).toBe(2);
    expect(parseEvalArgs(["--smoke", "--baseline", "latest"])).toEqual({ smoke: true, baseline: "latest" });
    expect(() => parseEvalArgs(["--baseline"])).toThrow();
  });
});
