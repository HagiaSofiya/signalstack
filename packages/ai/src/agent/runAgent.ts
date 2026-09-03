import { randomUUID } from "node:crypto";

import type { AgentTool } from "../index.js";
import type { LLMProvider, ProviderResponse, ProviderToolDefinition, ProviderUsage } from "../providers/provider.js";

export const DATA_ASSISTANT_INSTRUCTIONS = `You are a data analysis assistant working with a user-provided dataset.

Use inspect_dataset when you need to understand available columns, types, missing values, or preview rows.
Use analyze_dataset when you need to calculate something from the data.
Use create_chart only when a visualization materially improves the answer. Choose line for change over time, bar for category comparisons, area for time-series magnitude, and scatter for numeric relationships. A chart must reference the sourceStepId from a completed analyze_dataset result; never recreate or invent chart data.
Never invent columns, values, statistics, or observations.
Only make numerical claims supported by tool results.
If a tool returns an error, use the error details to correct the request or clearly say that additional analysis is required.
Explain calculations in plain language and keep answers concise.
Do not expose private model reasoning or hidden chain-of-thought.`;

export type AgentExecutionStep = {
  id: string;
  type: "tool" | "generate_answer";
  toolName: string | null;
  status: "completed" | "failed";
  input: unknown;
  output: unknown;
  durationMs: number;
};

export type AgentResult = {
  answer: string;
  steps: AgentExecutionStep[];
  usage: ProviderUsage;
  model: string;
  totalDurationMs: number;
};

export class AgentExecutionError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "AgentExecutionError";
  }
}

export async function runAgent(options: {
  question: string;
  datasetId: string;
  provider: LLMProvider;
  tools: AgentTool[];
  maxToolCalls?: number;
  maxCharts?: number;
  agentRunId?: string;
  signal?: AbortSignal;
  onStep?: (step: AgentExecutionStep) => Promise<void> | void;
}): Promise<AgentResult> {
  const startedAt = performance.now();
  const steps: AgentExecutionStep[] = [];
  const maxToolCalls = options.maxToolCalls ?? 6;
  const maxCharts = options.maxCharts ?? 3;
  if (!Number.isInteger(maxToolCalls) || maxToolCalls < 1) throw new AgentExecutionError("maxToolCalls must be a positive integer");
  if (!Number.isInteger(maxCharts) || maxCharts < 1) throw new AgentExecutionError("maxCharts must be a positive integer");

  const toolDefinitions: ProviderToolDefinition[] = options.tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: tool.strict ?? true,
  }));
  let input: unknown[] = [{ role: "user", content: options.question }];
  let response: ProviderResponse;
  let usage: ProviderUsage = { inputTokens: null, outputTokens: null, totalTokens: null };
  let toolCallsUsed = 0;

  while (true) {
    const generationStartedAt = performance.now();
    try {
      response = await options.provider.generate({
        instructions: DATA_ASSISTANT_INSTRUCTIONS,
        input,
        tools: toolDefinitions,
        signal: options.signal,
      });
      usage = combineUsage(usage, response.usage);
    } catch (error) {
      await emitStep(options, steps, {
        id: randomUUID(),
        type: "generate_answer",
        toolName: null,
        status: "failed",
        input: { phase: toolCallsUsed === 0 ? "initial" : "follow_up" },
        output: errorPayload(error),
        durationMs: elapsed(generationStartedAt),
      });
      throw new AgentExecutionError(publicError(error), error);
    }

    if (response.toolCalls.length === 0) {
      await emitAnswerStep(options, steps, response.text, generationStartedAt);
      return {
        answer: response.text.trim(),
        steps,
        usage,
        model: response.model,
        totalDurationMs: elapsed(startedAt),
      };
    }

    if (toolCallsUsed + response.toolCalls.length > maxToolCalls) {
      await emitStep(options, steps, {
        id: randomUUID(),
        type: "generate_answer",
        toolName: null,
        status: "failed",
        input: { phase: "tool_limit", maxToolCalls },
        output: { error: `The agent exceeded the limit of ${maxToolCalls} tool calls` },
        durationMs: elapsed(generationStartedAt),
      });
      throw new AgentExecutionError(`The agent exceeded the limit of ${maxToolCalls} tool calls`);
    }

    input = [...input, ...response.outputItems];
    for (const toolCall of response.toolCalls) {
      toolCallsUsed += 1;
      const tool = options.tools.find((candidate) => candidate.name === toolCall.name);
      const toolStartedAt = performance.now();

      if (!tool) {
        const failure = { error: `The model requested an unavailable tool: ${toolCall.name}` };
        await emitStep(options, steps, {
          id: randomUUID(),
          type: "tool",
          toolName: toolCall.name,
          status: "failed",
          input: toolCall.arguments,
          output: failure,
          durationMs: elapsed(toolStartedAt),
        });
        input.push({ type: "function_call_output", call_id: toolCall.callId, output: JSON.stringify(failure) });
        continue;
      }

      const createdCharts = steps.filter((step) => step.toolName === "create_chart" && step.status === "completed").length;
      if (tool.name === "create_chart" && createdCharts >= maxCharts) {
        const failure = { error: `The agent reached the limit of ${maxCharts} charts per run` };
        await emitStep(options, steps, {
          id: randomUUID(),
          type: "tool",
          toolName: tool.name,
          status: "failed",
          input: toolCall.arguments,
          output: failure,
          durationMs: elapsed(toolStartedAt),
        });
        input.push({ type: "function_call_output", call_id: toolCall.callId, output: JSON.stringify(failure) });
        continue;
      }

      try {
        const output = await tool.execute(toolCall.arguments, {
          datasetId: options.datasetId,
          agentRunId: options.agentRunId,
          signal: options.signal ?? new AbortController().signal,
        });
        const stepId = randomUUID();
        await emitStep(options, steps, {
          id: stepId,
          type: "tool",
          toolName: tool.name,
          status: "completed",
          input: toolCall.arguments,
          output,
          durationMs: elapsed(toolStartedAt),
        });
        input.push({ type: "function_call_output", call_id: toolCall.callId, output: JSON.stringify(modelToolOutput(tool.name, output, stepId)) });
      } catch (error) {
        const failure = errorPayload(error);
        await emitStep(options, steps, {
          id: randomUUID(),
          type: "tool",
          toolName: tool.name,
          status: "failed",
          input: toolCall.arguments,
          output: failure,
          durationMs: elapsed(toolStartedAt),
        });
        input.push({ type: "function_call_output", call_id: toolCall.callId, output: JSON.stringify(failure) });
      }
    }
  }
}

async function emitAnswerStep(
  options: { onStep?: (step: AgentExecutionStep) => Promise<void> | void },
  steps: AgentExecutionStep[],
  text: string,
  startedAt: number,
) {
  const hasAnswer = text.trim().length > 0;
  await emitStep(options, steps, {
    id: randomUUID(),
    type: "generate_answer",
    toolName: null,
    status: hasAnswer ? "completed" : "failed",
    input: { phase: "final" },
    output: hasAnswer ? { answer: text } : { error: "The model returned an empty answer" },
    durationMs: elapsed(startedAt),
  });
  if (!hasAnswer) throw new AgentExecutionError("The model returned an empty answer");
}

async function emitStep(
  options: { onStep?: (step: AgentExecutionStep) => Promise<void> | void },
  steps: AgentExecutionStep[],
  step: AgentExecutionStep,
) {
  steps.push(step);
  await options.onStep?.(step);
}

function elapsed(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function publicError(error: unknown) {
  return error instanceof Error ? error.message : "The agent workflow failed";
}

function errorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof Error && "details" in error && typeof error.details === "object" && error.details !== null) {
    return { ...(error.details as Record<string, unknown>), error: error.message };
  }
  return { error: publicError(error) };
}

function modelToolOutput(toolName: string, output: unknown, stepId: string): unknown {
  if (toolName !== "analyze_dataset" || typeof output !== "object" || output === null || Array.isArray(output)) return output;
  return { ...(output as Record<string, unknown>), sourceStepId: stepId };
}

function combineUsage(first: ProviderUsage, second: ProviderUsage): ProviderUsage {
  return {
    inputTokens: addNullable(first.inputTokens, second.inputTokens),
    outputTokens: addNullable(first.outputTokens, second.outputTokens),
    totalTokens: addNullable(first.totalTokens, second.totalTokens),
  };
}

function addNullable(first: number | null, second: number | null): number | null {
  if (first === null) return second;
  if (second === null) return first;
  return first + second;
}
