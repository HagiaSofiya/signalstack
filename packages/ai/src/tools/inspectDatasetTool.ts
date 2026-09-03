import { getDb } from "@signalstack/db";
import { datasetInspectionSchema, type DatasetInspection } from "@signalstack/schemas";
import { z } from "zod";

import { aiEnv } from "../config.js";
import type { AgentTool, AgentToolContext } from "../index.js";
import { DatasetToolError } from "./tool-errors.js";

export { DatasetToolError };

const emptyObjectSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;
const emptyObjectInputSchema = z.object({}).strict();

export function createInspectDatasetTool(dependencies: {
  resolveDataset?: (datasetId: string) => Promise<{ storagePath: string } | null>;
  inspectPath?: (storagePath: string) => Promise<DatasetInspection>;
} = {}): AgentTool<Record<string, never>, DatasetInspection> {
  const resolveDataset = dependencies.resolveDataset ?? (async (datasetId: string) => {
    const dataset = await getDb().dataset.findUnique({ where: { id: datasetId } });
    return dataset ? { storagePath: dataset.storagePath } : null;
  });
  const inspectPath = dependencies.inspectPath ?? inspectDatasetPath;

  return {
    name: "inspect_dataset",
    description: "Inspect the schema, row count, column types, missing values, unique counts, and preview rows for the currently selected dataset.",
    parameters: emptyObjectSchema,
    async execute(_input: Record<string, never>, context: AgentToolContext) {
      if (!emptyObjectInputSchema.safeParse(_input).success) throw new DatasetToolError("inspect_dataset received invalid arguments");
      const dataset = await resolveDataset(context.datasetId);
      if (!dataset) throw new DatasetToolError("The selected dataset was not found");
      const result = await inspectPath(dataset.storagePath);
      try {
        return datasetInspectionSchema.parse(result);
      } catch {
        throw new DatasetToolError("The analysis service returned an invalid inspection result");
      }
    },
  };
}

async function inspectDatasetPath(storagePath: string): Promise<DatasetInspection> {
  let response: Response;
  try {
    response = await fetch(`${aiEnv.ANALYSIS_SERVICE_URL}/datasets/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: storagePath }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new DatasetToolError("The analysis service is unavailable");
  }

  if (!response.ok) throw new DatasetToolError("The analysis service could not inspect this dataset");

  try {
    return datasetInspectionSchema.parse(await response.json());
  } catch {
    throw new DatasetToolError("The analysis service returned an invalid inspection result");
  }
}

export const inspectDatasetTool = createInspectDatasetTool();
