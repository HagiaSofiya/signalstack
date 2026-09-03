import { describe, expect, it, vi } from "vitest";

import { createAnalyzeDatasetTool, type AnalyzeDatasetInput } from "./analyzeDatasetTool.js";
import { DatasetToolError } from "./tool-errors.js";

const datasetId = "11111111-1111-4111-8111-111111111111";
const result = {
  operation: "group_by" as const,
  columnsUsed: ["channel", "revenue"],
  rows: [{ channel: "Google", revenue: 150 }],
};

const input: AnalyzeDatasetInput = {
  operation: "group_by",
  parameters: { groupBy: ["channel"], metric: "revenue", aggregation: "sum", sort: "desc", limit: 5 },
};
const context = { datasetId, signal: new AbortController().signal };

describe("analyze_dataset tool", () => {
  it("validates the structured request and returns the analysis result", async () => {
    const analyzePath = vi.fn().mockResolvedValue(result);
    const tool = createAnalyzeDatasetTool({
      resolveDataset: vi.fn().mockResolvedValue({ storagePath: "/tmp/sales.csv" }),
      analyzePath,
    });

    await expect(tool.execute(input, context)).resolves.toEqual(result);
    expect(analyzePath).toHaveBeenCalledWith("/tmp/sales.csv", expect.objectContaining({ operation: "group_by" }));
  });

  it("rejects malformed analysis results", async () => {
    const tool = createAnalyzeDatasetTool({
      resolveDataset: vi.fn().mockResolvedValue({ storagePath: "/tmp/sales.csv" }),
      analyzePath: vi.fn().mockResolvedValue({ operation: "group_by", rows: "not-an-array" }),
    });

    await expect(tool.execute(input, context)).rejects.toBeInstanceOf(DatasetToolError);
  });

  it("preserves structured service errors for agent recovery", async () => {
    const tool = createAnalyzeDatasetTool({
      resolveDataset: vi.fn().mockResolvedValue({ storagePath: "/tmp/sales.csv" }),
      analyzePath: vi.fn().mockRejectedValue(new DatasetToolError("Column 'sales_total' does not exist", {
        availableColumns: ["date", "revenue"],
      })),
    });

    await expect(tool.execute(input, context)).rejects.toMatchObject({
      message: "Column 'sales_total' does not exist",
      details: { availableColumns: ["date", "revenue"] },
    });
  });
});
