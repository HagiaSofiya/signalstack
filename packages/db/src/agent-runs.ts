import { Prisma, type AgentRun as PrismaAgentRun, type AgentStep as PrismaAgentStep } from "@prisma/client";
import {
  agentRunListResponseSchema,
  agentRunSchema,
  agentRunSummarySchema,
  agentStepSchema,
  type AgentRun,
  type AgentRunListResponse,
  type AgentRunSummary,
  type AgentStep,
} from "@signalstack/schemas";

import { getDb } from "./client.js";

type PersistedAgentStep = {
  id?: string;
  type: string;
  toolName: string | null;
  status: string;
  input: unknown;
  output: unknown;
  durationMs: number;
};

function toAgentRun(run: PrismaAgentRun): AgentRun {
  return agentRunSchema.parse({
    id: run.id,
    projectId: run.projectId,
    datasetId: run.datasetId,
    question: run.question,
    status: run.status,
    provider: run.provider,
    model: run.model,
    tokenUsage: run.tokenUsage,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    totalTokens: run.totalTokens,
    estimatedCost: run.estimatedCost === null ? null : Number(run.estimatedCost),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    createdAt: run.createdAt.toISOString(),
  });
}

function toAgentStep(step: PrismaAgentStep): AgentStep {
  return agentStepSchema.parse({
    id: step.id,
    agentRunId: step.agentRunId,
    type: step.type,
    toolName: step.toolName,
    status: step.status,
    input: step.input,
    output: step.output,
    durationMs: step.durationMs,
    createdAt: step.createdAt.toISOString(),
  });
}

export async function createAgentRunRecord(input: {
  projectId: string;
  datasetId: string;
  question: string;
  provider: string;
  model: string;
  startedAt?: Date;
}): Promise<AgentRun> {
  const run = await getDb().agentRun.create({
    data: {
      projectId: input.projectId,
      datasetId: input.datasetId,
      question: input.question,
      provider: input.provider,
      model: input.model,
      startedAt: input.startedAt ?? new Date(),
      status: "running",
    },
  });
  return toAgentRun(run);
}

export async function persistAgentStep(input: {
  agentRunId: string;
  step: PersistedAgentStep;
}): Promise<AgentStep> {
  const step = await getDb().agentStep.create({
    data: {
      ...(input.step.id ? { id: input.step.id } : {}),
      agentRunId: input.agentRunId,
      type: input.step.type,
      toolName: input.step.toolName,
      status: input.step.status,
      input: toJsonInput(input.step.input),
      output: toJsonInput(input.step.output),
      durationMs: input.step.durationMs,
    },
  });
  return toAgentStep(step);
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined || value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export async function completeAgentRunRecord(input: {
  id: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  durationMs: number;
}): Promise<AgentRun> {
  const run = await getDb().agentRun.update({
    where: { id: input.id },
    data: {
      status: "completed",
      provider: input.provider,
      model: input.model,
      tokenUsage: input.totalTokens,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      estimatedCost: input.estimatedCost,
      completedAt: new Date(),
      durationMs: input.durationMs,
    },
  });
  return toAgentRun(run);
}

export async function failAgentRunRecord(id: string, durationMs?: number): Promise<AgentRun> {
  const run = await getDb().agentRun.update({
    where: { id },
    data: { status: "failed", completedAt: new Date(), ...(durationMs === undefined ? {} : { durationMs }) },
  });
  return toAgentRun(run);
}

export async function listAgentRunSummaries(input: {
  datasetId: string;
  limit: number;
  cursor?: string;
  status?: "queued" | "running" | "completed" | "failed";
}): Promise<AgentRunListResponse> {
  const runs = await getDb().agentRun.findMany({
    where: { datasetId: input.datasetId, ...(input.status ? { status: input.status } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    include: { steps: { select: { type: true, toolName: true, durationMs: true, status: true } } },
  });
  const hasMore = runs.length > input.limit;
  const visibleRuns = hasMore ? runs.slice(0, input.limit) : runs;
  const items = visibleRuns.map((run) => toAgentRunSummary(run, run.steps));
  return agentRunListResponseSchema.parse({
    items,
    hasMore,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  });
}

function toAgentRunSummary(
  run: PrismaAgentRun,
  steps: Array<{ type: string; toolName: string | null; durationMs: number | null; status: string }>,
): AgentRunSummary {
  const toolSteps = steps.filter((step) => step.toolName !== null);
  const llmSteps = steps.filter((step) => step.type === "generate_answer");
  return agentRunSummarySchema.parse({
    ...toAgentRun(run),
    toolCallCount: toolSteps.length,
    chartCount: steps.filter((step) => step.toolName === "create_chart" && step.status === "completed").length,
    totalToolDurationMs: sumDurations(toolSteps),
    totalLlmDurationMs: sumDurations(llmSteps),
  });
}

function sumDurations(steps: Array<{ durationMs: number | null }>) {
  return steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
}

export async function findAgentRunWithSteps(id: string): Promise<{ run: AgentRun; steps: AgentStep[] } | null> {
  const result = await getDb().agentRun.findUnique({
    where: { id },
    include: { steps: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  if (!result) return null;
  return { run: toAgentRun(result), steps: result.steps.map(toAgentStep) };
}
