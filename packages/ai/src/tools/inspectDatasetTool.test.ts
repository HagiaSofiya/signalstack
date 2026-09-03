import { describe, expect, it, vi } from "vitest";

import { createInspectDatasetTool, DatasetToolError } from "./inspectDatasetTool.js";

const datasetId = "11111111-1111-4111-8111-111111111111";
const context = { datasetId, signal: new AbortController().signal };

const inspection = {
  rowCount: 2,
  columnCount: 2,
  columns: [
    { name: "name", type: "string", missingCount: 0, uniqueCount: 2 },
    { name: "score", type: "number", missingCount: 1, uniqueCount: 1 },
  ],
  preview: [{ name: "Ada", score: 10 }, { name: "Grace", score: null }],
};

describe("inspect_dataset tool", () => {
  it("resolves the dataset and returns the structured inspection", async () => {
    const inspectPath = vi.fn().mockResolvedValue(inspection);
    const tool = createInspectDatasetTool({
      resolveDataset: vi.fn().mockResolvedValue({ storagePath: "/tmp/sample.csv" }),
      inspectPath,
    });

    await expect(tool.execute({}, context)).resolves.toEqual(inspection);
    expect(inspectPath).toHaveBeenCalledWith("/tmp/sample.csv");
  });

  it("rejects malformed inspection responses", async () => {
    const tool = createInspectDatasetTool({
      resolveDataset: vi.fn().mockResolvedValue({ storagePath: "/tmp/sample.csv" }),
      inspectPath: vi.fn().mockResolvedValue({ rowCount: "not-a-number" }),
    });

    await expect(tool.execute({}, context)).rejects.toBeInstanceOf(DatasetToolError);
    await expect(tool.execute({}, context)).rejects.toThrow("invalid inspection result");
  });

  it("reports a missing dataset as a tool failure", async () => {
    const tool = createInspectDatasetTool({ resolveDataset: vi.fn().mockResolvedValue(null) });

    await expect(tool.execute({}, context)).rejects.toThrow("dataset was not found");
  });
});
