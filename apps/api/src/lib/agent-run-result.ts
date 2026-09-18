import {
  agentRunResultSchema,
  answerVerificationSchema,
  datasetAnalysisResultSchema,
  chartSpecSchema,
  type AgentRun,
  type AgentRunResult,
  type AgentStep,
} from "@signalstack/schemas";

export function reconstructAgentRunResult(input: {
  run: AgentRun;
  steps: AgentStep[];
  fallbackAnswer?: string;
}): AgentRunResult {
  const finalStep = [...input.steps].reverse().find((step) => step.type === "generate_answer" && step.status === "completed");
  const finalOutput = asRecord(finalStep?.output);
  const answer = typeof finalOutput?.answer === "string" ? finalOutput.answer : input.fallbackAnswer ?? "This run did not produce a final answer.";
  const toolSteps = input.steps.filter((step) => step.toolName !== null);
  const llmSteps = input.steps.filter((step) => step.type === "generate_answer");
  const totalDurationMs = input.run.durationMs ?? sumDurations(input.steps);
  const evidence = input.steps.flatMap((step) => {
    if (step.status !== "completed" || step.toolName !== "analyze_dataset") return [];
    const analysis = datasetAnalysisResultSchema.safeParse(step.output);
    return analysis.success ? [{ stepId: step.id, ...analysis.data }] : [];
  });
  const charts = input.steps.flatMap((step) => {
    if (step.status !== "completed" || step.toolName !== "create_chart") return [];
    const chart = chartSpecSchema.safeParse(step.output);
    return chart.success ? [chart.data] : [];
  });
  const verificationStep = [...input.steps].reverse().find((step) => step.type === "verification" && step.status === "completed");
  const verification = answerVerificationSchema.safeParse(verificationStep?.output);
  const errorSummary = input.run.status === "failed" ? findSafeError(input.steps) ?? "This agent run failed before it completed." : null;

  return agentRunResultSchema.parse({
    run: input.run,
    answer,
    steps: input.steps,
    totalDurationMs,
    evidence,
    charts,
    verification: verification.success ? verification.data : null,
    observability: {
      totalDurationMs,
      llmDurationMs: sumDurations(llmSteps),
      toolDurationMs: sumDurations(toolSteps),
      toolCallCount: toolSteps.length,
      chartCount: charts.length,
      inputTokens: input.run.inputTokens,
      outputTokens: input.run.outputTokens,
      totalTokens: input.run.totalTokens ?? input.run.tokenUsage,
      estimatedCost: input.run.estimatedCost,
      provider: input.run.provider,
      model: input.run.model,
    },
    errorSummary,
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function findSafeError(steps: AgentStep[]) {
  for (const step of steps) {
    if (step.status !== "failed") continue;
    const error = asRecord(step.output)?.error;
    if (typeof error === "string" && error.length < 500) return error;
  }
  return null;
}

function sumDurations(steps: Array<{ durationMs: number | null }>) {
  return steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
}
