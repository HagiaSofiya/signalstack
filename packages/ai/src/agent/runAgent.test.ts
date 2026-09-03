import { describe, expect, it, vi } from "vitest";

import type { AgentTool } from "../index.js";
import { runAgent } from "./runAgent.js";

const datasetId = "11111111-1111-4111-8111-111111111111";
const toolResult = { rowCount: 2, columnCount: 1, columns: [], preview: [] };

function usage(totalTokens: number) {
  return { inputTokens: totalTokens - 1, outputTokens: 1, totalTokens };
}

function makeTool(execute: AgentTool["execute"]): AgentTool {
  return {
    name: "inspect_dataset",
    description: "Inspect the selected dataset",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    execute,
  };
}

describe("runAgent", () => {
  it("executes the tool, persists visible steps through the callback, and generates an answer", async () => {
    const provider = {
      generate: vi.fn()
        .mockResolvedValueOnce({
          id: "response-1",
          model: "test-model",
          text: "",
          toolCalls: [{ callId: "call-1", name: "inspect_dataset", arguments: {} }],
          outputItems: [{ type: "function_call", call_id: "call-1", name: "inspect_dataset", arguments: "{}" }],
          usage: usage(10),
        })
        .mockResolvedValueOnce({
          id: "response-2",
          model: "test-model",
          text: "The dataset has two rows.",
          toolCalls: [],
          outputItems: [],
          usage: usage(20),
        }),
    };
    const execute = vi.fn().mockResolvedValue(toolResult);
    const persistedSteps: string[] = [];
    const persistedIds: string[] = [];

    const result = await runAgent({
      question: "How many rows are there?",
      datasetId,
      provider,
      tools: [makeTool(execute)],
      onStep: (step) => { persistedSteps.push(`${step.type}:${step.status}`); persistedIds.push(step.id); },
    });

    expect(result.answer).toBe("The dataset has two rows.");
    expect(result.steps.map((step) => step.type)).toEqual(["tool", "generate_answer"]);
    expect(persistedSteps).toEqual(["tool:completed", "generate_answer:completed"]);
    expect(execute).toHaveBeenCalledWith({}, expect.objectContaining({ datasetId }));
    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(persistedIds.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
    expect(provider.generate.mock.calls[1]?.[0].input).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "function_call_output", call_id: "call-1" }),
    ]));
    expect(result.usage.totalTokens).toBe(30);
  });

  it("marks a failed tool execution and lets the model recover", async () => {
    const provider = {
      generate: vi.fn()
        .mockResolvedValueOnce({
          id: "response-1",
          model: "test-model",
          text: "",
          toolCalls: [{ callId: "call-1", name: "inspect_dataset", arguments: {} }],
          outputItems: [],
          usage: usage(10),
        })
        .mockResolvedValueOnce({
          id: "response-2",
          model: "test-model",
          text: "I could not inspect the dataset, so I cannot make a factual claim.",
          toolCalls: [],
          outputItems: [],
          usage: usage(10),
        }),
    };
    const steps: Array<{ type: string; status: string; output: unknown }> = [];

    const result = await runAgent({
      question: "Inspect the data",
      datasetId,
      provider,
      tools: [makeTool(vi.fn().mockRejectedValue(new Error("analysis service unavailable")))],
      onStep: (step) => { steps.push(step); },
    });

    expect(result.answer).toContain("cannot make a factual claim");
    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ type: "tool", status: "failed" });
  });

  it("stops when the maximum tool-call limit is reached", async () => {
    const provider = {
      generate: vi.fn().mockResolvedValue({
        id: "response-loop",
        model: "test-model",
        text: "",
        toolCalls: [{ callId: "call-loop", name: "inspect_dataset", arguments: {} }],
        outputItems: [],
        usage: usage(1),
      }),
    };

    await expect(runAgent({
      question: "Keep checking",
      datasetId,
      provider,
      tools: [makeTool(vi.fn().mockResolvedValue(toolResult))],
      maxToolCalls: 2,
    })).rejects.toThrow("limit of 2 tool calls");
    expect(provider.generate).toHaveBeenCalledTimes(3);
  });

  it("still completes with a textual answer when chart creation fails", async () => {
    const provider = {
      generate: vi.fn()
        .mockResolvedValueOnce({
          id: "response-chart-1",
          model: "test-model",
          text: "",
          toolCalls: [{ callId: "call-chart-1", name: "create_chart", arguments: { sourceStepId: "22222222-2222-4222-8222-222222222222" } }],
          outputItems: [],
          usage: usage(5),
        })
        .mockResolvedValueOnce({
          id: "response-chart-2",
          model: "test-model",
          text: "The text answer is still available.",
          toolCalls: [],
          outputItems: [],
          usage: usage(5),
        }),
    };
    const chartTool: AgentTool = {
      name: "create_chart",
      description: "Create a chart",
      parameters: { type: "object" },
      execute: vi.fn().mockRejectedValue(new Error("source analysis step was not found")),
    };

    const result = await runAgent({ question: "Chart revenue", datasetId, provider, tools: [chartTool] });

    expect(result.answer).toBe("The text answer is still available.");
    expect(result.steps[0]).toMatchObject({ toolName: "create_chart", status: "failed" });
  });

  it("emits a persistable chart step with a stable source reference", async () => {
    const provider = {
      generate: vi.fn()
        .mockResolvedValueOnce({
          id: "response-chart-persist-1",
          model: "test-model",
          text: "",
          toolCalls: [{ callId: "call-chart-persist-1", name: "create_chart", arguments: { sourceStepId: "22222222-2222-4222-8222-222222222222" } }],
          outputItems: [],
          usage: usage(5),
        })
        .mockResolvedValueOnce({
          id: "response-chart-persist-2",
          model: "test-model",
          text: "Here is the chart.",
          toolCalls: [],
          outputItems: [],
          usage: usage(5),
        }),
    };
    const persisted: Array<{ id: string; toolName: string | null; input: unknown }> = [];
    const chartTool: AgentTool = {
      name: "create_chart",
      description: "Create a chart",
      parameters: { type: "object" },
      execute: vi.fn().mockResolvedValue({ type: "bar", sourceStepId: "22222222-2222-4222-8222-222222222222" }),
    };

    await runAgent({
      question: "Chart revenue",
      datasetId,
      provider,
      tools: [chartTool],
      onStep: (step) => { if (step.toolName) persisted.push({ id: step.id, toolName: step.toolName, input: step.input }); },
    });

    expect(persisted[0]).toMatchObject({ toolName: "create_chart", input: { sourceStepId: "22222222-2222-4222-8222-222222222222" } });
    expect(persisted[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
