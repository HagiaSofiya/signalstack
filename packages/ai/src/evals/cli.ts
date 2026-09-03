import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  evalCaseSchema,
  evalFactSchema,
  evalThresholdsSchema,
  type EvalCase,
  type EvalSuiteRunDetail,
} from "@signalstack/schemas";
import { infrastructureExitCode, parseEvalArgs, qualityExitCode } from "./cli-utils.js";

const execFile = promisify(execFileCallback);
const repoRoot = resolve(process.cwd(), "../..");
const suiteFileSchema = z.object({
  suiteId: z.string().min(1),
  version: z.string().min(1),
  datasetVersion: z.string().min(1),
  cases: evalCaseSchema.array().min(1),
}).strict();
const groundTruthFileSchema = z.object({
  suiteId: z.string().min(1),
  suiteVersion: z.string().min(1),
  datasetVersion: z.string().min(1),
  cases: z.array(z.object({ caseId: z.string().min(1), expectedAnswerFacts: z.array(z.unknown()) })).min(1),
}).strict();

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function gitSha() {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return (await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).stdout.trim() || null;
  } catch {
    return null;
  }
}

async function ensureEvaluationDataset(db: ReturnType<(typeof import("@signalstack/db"))["getDb"]>) {
  const projectId = process.env.EVAL_PROJECT_ID ?? "00000000-0000-0000-0000-000000000001";
  const csvPath = resolve(repoRoot, "services/analysis/examples/signalstack-demo.csv");
  if (process.env.EVAL_DATASET_ID) {
    const existing = await db.dataset.findUnique({ where: { id: process.env.EVAL_DATASET_ID }, select: { id: true, projectId: true } });
    if (!existing) throw new Error(`EVAL_DATASET_ID was not found: ${process.env.EVAL_DATASET_ID}`);
    return existing;
  }
  await db.project.upsert({ where: { id: projectId }, update: {}, create: { id: projectId, name: "SignalStack evaluations", description: "Evaluation benchmark project" } });
  const existing = await db.dataset.findFirst({ where: { storagePath: csvPath }, select: { id: true, projectId: true } });
  return existing ?? db.dataset.create({ data: { projectId, filename: "signalstack-demo.csv", storagePath: csvPath }, select: { id: true, projectId: true } });
}

async function loadBaseline(
  baselineArg: string | undefined,
  suiteId: string,
  findLatestEvalSuiteRun: (suiteId: string) => Promise<EvalSuiteRunDetail | null>,
  findEvalSuiteRunWithCases: (id: string) => Promise<EvalSuiteRunDetail | null>,
) {
  if (!baselineArg) return null;
  if (baselineArg === "latest") return findLatestEvalSuiteRun(suiteId);
  if (!z.string().uuid().safeParse(baselineArg).success) throw new Error("Baseline must be 'latest' or a valid evaluation run ID");
  return findEvalSuiteRunWithCases(baselineArg);
}

function metricLabel(metric: string) {
  return ({ passRate: "Pass rate", toolSelectionAccuracy: "Tool selection", numericalAccuracy: "Numerical accuracy", groundingRate: "Grounding", hallucinationRate: "Hallucination rate", averageCost: "Average cost", averageToolCalls: "Average tool calls" } as Record<string, string>)[metric] ?? metric;
}

function formatMetric(metric: string, value: number | null) {
  if (value === null) return "—";
  if (metric === "averageCost") return `$${value.toFixed(6)}`;
  if (metric === "averageToolCalls") return value.toFixed(1);
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(metric: string, delta: number | null) {
  if (delta === null) return "—";
  if (metric === "averageCost") return `${delta >= 0 ? "+" : ""}$${delta.toFixed(6)}`;
  if (metric === "averageToolCalls") return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
  return `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`;
}

function formatPercentDelta(delta: number | null) {
  return delta === null ? "" : ` (${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}%)`;
}

async function main(): Promise<number> {
  config({ path: resolve(process.cwd(), "../../.env") });
  config();
  const { smoke, baseline: baselineArg } = parseEvalArgs(process.argv.slice(2));
  const suite = suiteFileSchema.parse(await readJson(resolve(repoRoot, "evals/cases.json")));
  const thresholds = evalThresholdsSchema.parse(await readJson(resolve(repoRoot, "evals/thresholds.json")));
  const groundTruthPayload = groundTruthFileSchema.parse(await readJson(resolve(repoRoot, "evals/ground-truth.json")));
  if (groundTruthPayload.suiteId !== suite.suiteId || groundTruthPayload.suiteVersion !== suite.version || groundTruthPayload.datasetVersion !== suite.datasetVersion) {
    throw new Error("Ground truth suite metadata does not match cases.json");
  }
  const groundTruth = new Map(groundTruthPayload.cases.map((item) => [item.caseId, item.expectedAnswerFacts.map((fact) => evalFactSchema.parse(fact))]));
  const selectedCases = smoke ? suite.cases.filter((testCase) => testCase.smoke) : suite.cases;
  if (!selectedCases.length) throw new Error("The selected evaluation subset is empty");

  const { findEvalSuiteRunWithCases, findLatestEvalSuiteRun, getDb } = await import("@signalstack/db");
  const { createLLMProvider, runEvalSuite } = await import("../index.js");
  const db = getDb();
  try {
    const baseline = await loadBaseline(baselineArg, suite.suiteId, findLatestEvalSuiteRun, findEvalSuiteRunWithCases);
    if (baselineArg && !baseline) throw new Error(`Baseline evaluation run was not found: ${baselineArg}`);
    const dataset = await ensureEvaluationDataset(db);
    const result = await runEvalSuite({
      datasetId: dataset.id,
      projectId: dataset.projectId,
      cases: selectedCases as EvalCase[],
      groundTruth,
      provider: createLLMProvider(),
      modelRole: process.env.EVAL_MODEL_ROLE === "baseline" ? "baseline" : "candidate",
      suiteId: suite.suiteId,
      suiteVersion: suite.version,
      datasetVersion: suite.datasetVersion,
      gitSha: await gitSha(),
      agentPromptVersion: process.env.AGENT_PROMPT_VERSION ?? "v1",
      toolSchemaVersion: process.env.TOOL_SCHEMA_VERSION ?? "v1",
      reasoningConfig: process.env.AI_REASONING_EFFORT ?? null,
      thresholds,
      baseline,
    });
    const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;
    const cost = (value: number | null) => value === null ? "—" : `$${value.toFixed(6)}`;
    console.log(`\nSignalStack Evaluation\n\nSuite: ${suite.suiteId}@${suite.version}\nDataset: ${suite.datasetVersion}\nCommit: ${result.suiteRun.gitSha ?? "unavailable"}\nModel: ${result.suiteRun.model}\nCases: ${result.suiteRun.totalCases}\n\nQUALITY\n\nPass rate              ${percent(result.suiteRun.passRate)}   ${result.suiteRun.passRate >= thresholds.minimumPassRate ? "PASS" : "FAIL"}\nTool selection         ${percent(result.suiteRun.toolSelectionAccuracy)}   ${result.suiteRun.toolSelectionAccuracy >= thresholds.minimumToolSelectionAccuracy ? "PASS" : "FAIL"}\nNumerical accuracy     ${percent(result.suiteRun.numericalAccuracy)}   ${result.suiteRun.numericalAccuracy >= thresholds.minimumNumericalAccuracy ? "PASS" : "FAIL"}\nGrounding              ${percent(result.suiteRun.groundingRate)}   ${result.suiteRun.groundingRate >= thresholds.minimumGroundingRate ? "PASS" : "FAIL"}\nHallucination rate     ${percent(1 - result.suiteRun.hallucinationFreeRate)}   ${(1 - result.suiteRun.hallucinationFreeRate) <= thresholds.maximumHallucinationRate ? "PASS" : "FAIL"}\n\nEFFICIENCY\n\nAvg tool calls          ${result.suiteRun.averageToolCalls.toFixed(1)}\nAvg tokens              ${result.suiteRun.averageTokens?.toFixed(0) ?? "—"}\nAvg cost                ${cost(result.suiteRun.averageCost)}\nAvg latency             ${(result.suiteRun.averageLatencyMs / 1_000).toFixed(1)}s`);
    if (result.suiteRun.baselineComparison.length) {
      console.log("\nVS BASELINE");
      for (const metric of result.suiteRun.baselineComparison) console.log(`${metricLabel(metric.metric).padEnd(22)} ${formatMetric(metric.metric, metric.baseline)} → ${formatMetric(metric.metric, metric.current)} (${formatDelta(metric.metric, metric.delta)}${formatPercentDelta(metric.percentDelta)})   ${metric.status}`);
    }
    if (result.assessment.regressions.length) { console.log("\nREGRESSED"); for (const item of result.assessment.regressions) console.log(`${item.caseId}\nPrevious: PASS\nCurrent: FAIL\nReason: ${item.reason}\n`); }
    if (result.assessment.improvements.length) { console.log("\nFIXED"); for (const item of result.assessment.improvements) console.log(`${item.caseId}\nPrevious: FAIL\nCurrent: PASS\n`); }
    if (result.suiteRun.thresholdFailures.length) { console.log("\nFAILURES"); for (const failure of result.suiteRun.thresholdFailures) console.log(`- ${failure}`); }
    console.log(`\nResult: ${result.suiteRun.qualityPassed ? "PASS" : "FAIL"}\n`);
    return qualityExitCode(result.suiteRun.qualityPassed);
  } finally {
    await db.$disconnect().catch(() => undefined);
  }
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  console.error(`\nEvaluation infrastructure failure: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = infrastructureExitCode;
});
