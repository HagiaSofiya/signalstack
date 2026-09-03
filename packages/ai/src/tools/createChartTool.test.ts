import { describe, expect, it, vi } from "vitest";

import { createChartTool } from "./createChartTool.js";
import { DatasetToolError } from "./tool-errors.js";

const datasetId = "11111111-1111-4111-8111-111111111111";
const sourceStepId = "22222222-2222-4222-8222-222222222222";
const context = { datasetId, agentRunId: "33333333-3333-4333-8333-333333333333", signal: new AbortController().signal };
const analysis = {
  operation: "group_by" as const,
  columnsUsed: ["channel", "revenue"],
  rows: [{ channel: "Google", revenue: 150 }, { channel: "Meta", revenue: 98 }],
};

function makeTool(output: unknown = analysis) {
  return createChartTool({
    resolveStep: vi.fn().mockResolvedValue({
      agentRunId: context.agentRunId,
      toolName: "analyze_dataset",
      status: "completed",
      output,
    }),
  });
}

describe("create_chart tool", () => {
  it("creates a grounded bar chart from a group_by result", async () => {
    const chart = await makeTool().execute({
      sourceStepId,
      chartType: "bar",
      title: "Revenue by Channel",
      xKey: "channel",
      series: [{ key: "revenue", label: "Revenue" }],
    }, context);

    expect(chart).toMatchObject({ type: "bar", sourceStepId, data: analysis.rows });
  });

  it("creates a grounded line chart from a time-series result", async () => {
    const chart = await createChartTool({
      resolveStep: vi.fn().mockResolvedValue({
        agentRunId: context.agentRunId,
        toolName: "analyze_dataset",
        status: "completed",
        output: { operation: "group_by", columnsUsed: ["month", "revenue"], rows: [{ month: "July", revenue: 10 }, { month: "August", revenue: 15 }] },
      }),
    }).execute({ sourceStepId, chartType: "line", title: "Revenue over time", xKey: "month", series: [{ key: "revenue", label: "Revenue" }] }, context);

    expect(chart.type).toBe("line");
    expect(chart.data).toHaveLength(2);
  });

  it("rejects an invalid source step", async () => {
    const tool = createChartTool({ resolveStep: vi.fn().mockResolvedValue(null) });

    await expect(tool.execute({ sourceStepId, chartType: "bar", title: "Revenue", xKey: "channel", series: [{ key: "revenue", label: "Revenue" }] }, context)).rejects.toThrow("source analysis step was not found");
  });

  it("rejects missing keys and non-numeric series values", async () => {
    const tool = makeTool({ operation: "group_by", columnsUsed: ["channel"], rows: [{ channel: "Google", revenue: "150" }] });

    await expect(tool.execute({ sourceStepId, chartType: "bar", title: "Revenue", xKey: "missing", series: [{ key: "revenue", label: "Revenue" }] }, context)).rejects.toBeInstanceOf(DatasetToolError);
  });

  it("rejects excessive data points", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({ channel: `Channel ${index}`, revenue: index }));
    const tool = makeTool({ operation: "group_by", columnsUsed: ["channel", "revenue"], rows });

    await expect(tool.execute({ sourceStepId, chartType: "bar", title: "Revenue", xKey: "channel", series: [{ key: "revenue", label: "Revenue" }] }, context)).rejects.toThrow("could not be created");
  });
});
