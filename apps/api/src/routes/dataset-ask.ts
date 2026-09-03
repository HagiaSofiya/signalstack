import { getDb, completeAgentRunRecord, createAgentRunRecord, failAgentRunRecord, persistAgentStep } from "@signalstack/db";
import {
  AgentExecutionError,
  analyzeDatasetTool,
  aiEnv,
  calculateEstimatedCost,
  createChart,
  createLLMProvider,
  inspectDatasetTool,
  LLMProviderError,
  runAgent,
} from "@signalstack/ai";
import { askDatasetSchema, type AgentStep } from "@signalstack/schemas";
import { Hono } from "hono";
import { z } from "zod";

import { reconstructAgentRunResult } from "../lib/agent-run-result.js";

export const datasetAskRoutes = new Hono().post("/:datasetId/ask", async (c) => {
  const datasetIdResult = z.string().uuid().safeParse(c.req.param("datasetId"));
  if (!datasetIdResult.success) return c.json({ error: "datasetId must be a valid UUID" }, 400);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const questionResult = askDatasetSchema.safeParse(body);
  if (!questionResult.success) return c.json({ error: questionResult.error.flatten() }, 400);

  try {
    const dataset = await getDb().dataset.findUnique({ where: { id: datasetIdResult.data } });
    if (!dataset) return c.json({ error: "Dataset not found" }, 404);

    const run = await createAgentRunRecord({
      projectId: dataset.projectId,
      datasetId: dataset.id,
      question: questionResult.data.question,
      provider: aiEnv.AI_PROVIDER,
      model: aiEnv.AI_MODEL,
    });
    const persistedSteps: AgentStep[] = [];

    try {
      const result = await runAgent({
        question: questionResult.data.question,
        datasetId: dataset.id,
        provider: createLLMProvider(),
        tools: [inspectDatasetTool, analyzeDatasetTool, createChart],
        agentRunId: run.id,
        onStep: async (step) => {
          persistedSteps.push(await persistAgentStep({ agentRunId: run.id, step }));
        },
      });
      const completedRun = await completeAgentRunRecord({
        id: run.id,
        provider: aiEnv.AI_PROVIDER,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        estimatedCost: calculateEstimatedCost({
          provider: aiEnv.AI_PROVIDER,
          model: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        }),
        durationMs: result.totalDurationMs,
      });
      return c.json({ data: reconstructAgentRunResult({ run: completedRun, steps: persistedSteps, fallbackAnswer: result.answer }) });
    } catch (error) {
      const durationMs = run.startedAt ? Math.max(0, Date.now() - new Date(run.startedAt).getTime()) : undefined;
      await failAgentRunRecord(run.id, durationMs).catch((persistenceError) => console.error("Failed to mark agent run failed", persistenceError));
      const message = error instanceof Error ? error.message : "The agent run failed";
      const cause = error instanceof AgentExecutionError ? error.cause : undefined;
      const providerStatus = cause instanceof LLMProviderError
        ? cause.statusCode
        : 502;
      const status: 502 | 503 = providerStatus === 503 ? 503 : 502;
      return c.json({ error: message, runId: run.id, steps: persistedSteps }, status);
    }
  } catch (error) {
    console.error("Agent run could not start", error);
    return c.json({ error: "The agent run could not be started" }, 503);
  }
});
