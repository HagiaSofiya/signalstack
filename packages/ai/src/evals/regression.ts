import type {
  EvalCaseChange,
  EvalCaseResult,
  EvalMetricComparison,
  EvalSuiteRun,
  EvalSuiteRunDetail,
  EvalThresholds,
} from "@signalstack/schemas";

export class EvalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalConfigError";
  }
}

export type RegressionAssessment = {
  qualityPassed: boolean;
  regressionStatus: "passed" | "failed" | "no-baseline";
  thresholdFailures: string[];
  baselineComparison: EvalMetricComparison[];
  regressions: EvalCaseChange[];
  improvements: EvalCaseChange[];
};

const metricDefinitions = [
  { key: "passRate", label: "Pass rate", higherIsBetter: true },
  { key: "toolSelectionAccuracy", label: "Tool selection", higherIsBetter: true },
  { key: "numericalAccuracy", label: "Numerical accuracy", higherIsBetter: true },
  { key: "groundingRate", label: "Grounding", higherIsBetter: true },
  { key: "hallucinationRate", label: "Hallucination rate", higherIsBetter: false },
  { key: "averageCost", label: "Average cost", higherIsBetter: false },
  { key: "averageToolCalls", label: "Average tool calls", higherIsBetter: false },
] as const;

export function assessRegression(input: {
  current: EvalSuiteRun;
  cases: EvalCaseResult[];
  thresholds: EvalThresholds;
  baseline?: EvalSuiteRunDetail | null;
}): RegressionAssessment {
  const failures: string[] = [];
  if (input.current.passRate < input.thresholds.minimumPassRate) failures.push(`pass rate ${asPercent(input.current.passRate)} is below ${asPercent(input.thresholds.minimumPassRate)}`);
  if (input.current.toolSelectionAccuracy < input.thresholds.minimumToolSelectionAccuracy) failures.push(`tool selection ${asPercent(input.current.toolSelectionAccuracy)} is below ${asPercent(input.thresholds.minimumToolSelectionAccuracy)}`);
  if (input.current.numericalAccuracy < input.thresholds.minimumNumericalAccuracy) failures.push(`numerical accuracy ${asPercent(input.current.numericalAccuracy)} is below ${asPercent(input.thresholds.minimumNumericalAccuracy)}`);
  if (input.current.groundingRate < input.thresholds.minimumGroundingRate) failures.push(`grounding ${asPercent(input.current.groundingRate)} is below ${asPercent(input.thresholds.minimumGroundingRate)}`);
  const hallucinationRate = 1 - input.current.hallucinationFreeRate;
  if (hallucinationRate > input.thresholds.maximumHallucinationRate) failures.push(`hallucination rate ${asPercent(hallucinationRate)} exceeds ${asPercent(input.thresholds.maximumHallucinationRate)}`);
  if (input.current.averageCost !== null && input.current.averageCost > input.thresholds.maximumAverageCost) failures.push(`average cost $${input.current.averageCost.toFixed(6)} exceeds $${input.thresholds.maximumAverageCost.toFixed(6)}`);
  if (input.current.averageToolCalls > input.thresholds.maximumAverageToolCalls) failures.push(`average tool calls ${input.current.averageToolCalls.toFixed(1)} exceeds ${input.thresholds.maximumAverageToolCalls.toFixed(1)}`);

  const regressions: EvalCaseChange[] = [];
  const improvements: EvalCaseChange[] = [];
  let baselineComparison: EvalMetricComparison[] = [];
  if (input.baseline) {
    if (input.baseline.suiteId !== input.current.suiteId || input.baseline.suiteVersion !== input.current.suiteVersion || input.baseline.datasetVersion !== input.current.datasetVersion) {
      throw new EvalConfigError("Baseline suite, suite version, and dataset version must match the current evaluation");
    }
    baselineComparison = compareMetrics(input.current, input.baseline);
    const passRateChange = baselineComparison.find((metric) => metric.metric === "passRate");
    const groundingChange = baselineComparison.find((metric) => metric.metric === "groundingRate");
    const numericalChange = baselineComparison.find((metric) => metric.metric === "numericalAccuracy");
    if (passRateChange && passRateChange.delta !== null && passRateChange.delta < -input.thresholds.maximumPassRateRegression) failures.push(`pass rate regressed ${asPercent(Math.abs(passRateChange.delta))} beyond tolerance`);
    if (groundingChange && groundingChange.delta !== null && groundingChange.delta < -input.thresholds.maximumGroundingRegression) failures.push(`grounding regressed ${asPercent(Math.abs(groundingChange.delta))} beyond tolerance`);
    if (numericalChange && numericalChange.delta !== null && numericalChange.delta < 0) failures.push(`numerical accuracy regressed ${asPercent(Math.abs(numericalChange.delta))}`);
    const previousById = new Map(input.baseline.cases.map((item) => [item.caseId, item]));
    for (const currentCase of input.cases) {
      const previous = previousById.get(currentCase.caseId);
      if (previous?.passed && !currentCase.passed) regressions.push({ caseId: currentCase.caseId, reason: currentCase.failureReason ?? "quality regression", previousPassed: true, currentPassed: false });
      if (previous && !previous.passed && currentCase.passed) improvements.push({ caseId: currentCase.caseId, reason: "case now passes", previousPassed: false, currentPassed: true });
    }
  }
  if (input.thresholds.criticalCasesMustPass) {
    const failedCritical = input.cases.filter((item) => item.critical && !item.passed);
    for (const item of failedCritical) failures.push(`critical case ${item.caseId} failed`);
  }

  return {
    qualityPassed: failures.length === 0,
    regressionStatus: input.baseline ? (failures.length === 0 ? "passed" : "failed") : (failures.length === 0 ? "no-baseline" : "failed"),
    thresholdFailures: failures,
    baselineComparison,
    regressions,
    improvements,
  };
}

export function compareMetrics(current: EvalSuiteRun, baseline: EvalSuiteRun): EvalMetricComparison[] {
  return metricDefinitions.map((definition) => {
    const currentValue = metricValue(current, definition.key);
    const baselineValue = metricValue(baseline, definition.key);
    const delta = currentValue === null || baselineValue === null ? null : currentValue - baselineValue;
    const percentDelta = delta === null || baselineValue === null || baselineValue === 0 ? null : delta / Math.abs(baselineValue);
    const tolerance = definition.key === "passRate" || definition.key === "groundingRate" ? 0.005 : 0.000001;
    const improved = delta !== null && (definition.higherIsBetter ? delta > tolerance : delta < -tolerance);
    const regressed = delta !== null && (definition.higherIsBetter ? delta < -tolerance : delta > tolerance);
    return { metric: definition.key, current: currentValue, baseline: baselineValue, delta, percentDelta, status: currentValue === null || baselineValue === null ? "unavailable" : improved ? "improved" : regressed ? "regressed" : "within-tolerance" };
  });
}

function metricValue(run: EvalSuiteRun, key: (typeof metricDefinitions)[number]["key"]): number | null {
  if (key === "hallucinationRate") return 1 - run.hallucinationFreeRate;
  return run[key];
}

function asPercent(value: number) { return `${(value * 100).toFixed(1)}%`; }
