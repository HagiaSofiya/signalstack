import { getDb } from "@signalstack/db";
import {
  analysisRequestSchema,
  datasetAnalysisResultSchema,
  type AnalysisRequest,
  type DatasetAnalysisResult,
} from "@signalstack/schemas";
import { z } from "zod";

import { aiEnv } from "../config.js";
import type { AgentTool, AgentToolContext } from "../index.js";
import { DatasetToolError } from "./tool-errors.js";

const analyzeDatasetParameters = {
  type: "object",
  properties: {
    column: { type: "string", description: "A column to summarize, rank, or use as the correlation target." },
    withColumns: { type: "array", items: { type: "string" }, description: "Optional numeric columns to compare with the correlation target." },
    metric: { type: "string", description: "The numeric or countable measure to calculate." },
    groupBy: { type: "array", items: { type: "string" }, description: "Columns that define result groups." },
    aggregation: { type: "string", enum: ["sum", "mean", "median", "min", "max", "count", "nunique"] },
    filters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          column: { type: "string" },
          operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"] },
          value: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
              { type: "array", items: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] } },
            ],
          },
        },
        required: ["column", "operator"],
        additionalProperties: false,
      },
    },
    dateColumn: { type: "string", description: "Date column for period comparisons." },
    periods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          start: { type: "string", description: "Inclusive date." },
          end: { type: "string", description: "Inclusive date." },
        },
        required: ["label", "start", "end"],
        additionalProperties: false,
      },
      minItems: 2,
      maxItems: 2,
    },
    sort: { type: "string", enum: ["asc", "desc"] },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  },
  additionalProperties: false,
} as const;

const analyzeDatasetInputSchema = z.object({
  operation: z.enum([
    "summarize_column",
    "group_by",
    "aggregate",
    "compare_periods",
    "top_values",
    "correlation",
    "filter_and_aggregate",
  ]),
  parameters: z.record(z.string(), z.unknown()),
}).strict();

export type AnalyzeDatasetInput = z.infer<typeof analyzeDatasetInputSchema>;

export function createAnalyzeDatasetTool(dependencies: {
  resolveDataset?: (datasetId: string) => Promise<{ storagePath: string } | null>;
  analyzePath?: (storagePath: string, request: AnalysisRequest) => Promise<DatasetAnalysisResult>;
} = {}): AgentTool<AnalyzeDatasetInput, DatasetAnalysisResult> {
  const resolveDataset = dependencies.resolveDataset ?? (async (datasetId: string) => {
    const dataset = await getDb().dataset.findUnique({ where: { id: datasetId } });
    return dataset ? { storagePath: dataset.storagePath } : null;
  });
  const analyzePath = dependencies.analyzePath ?? analyzeDatasetPath;

  return {
    name: "analyze_dataset",
    description: "Run a safe, structured analysis operation on the selected dataset. Use this for calculations, grouped metrics, rankings, comparisons, filters, and correlations. Never provide Python code.",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["summarize_column", "group_by", "aggregate", "compare_periods", "top_values", "correlation", "filter_and_aggregate"] },
        parameters: analyzeDatasetParameters,
      },
      required: ["operation", "parameters"],
      additionalProperties: false,
    },
    strict: false,
    async execute(input: AnalyzeDatasetInput, context: AgentToolContext) {
      const inputResult = analyzeDatasetInputSchema.safeParse(input);
      if (!inputResult.success) throw new DatasetToolError("analyze_dataset received invalid arguments", { validation: inputResult.error.flatten() });
      const request = analysisRequestSchema.safeParse({
        filePath: "internal",
        operation: inputResult.data.operation,
        parameters: inputResult.data.parameters,
      });
      if (!request.success) throw new DatasetToolError("analyze_dataset parameters were invalid", { validation: request.error.flatten() });

      const dataset = await resolveDataset(context.datasetId);
      if (!dataset) throw new DatasetToolError("The selected dataset was not found");
      try {
        return datasetAnalysisResultSchema.parse(await analyzePath(dataset.storagePath, request.data));
      } catch (error) {
        if (error instanceof DatasetToolError) throw error;
        throw new DatasetToolError("The analysis service returned an invalid analysis result");
      }
    },
  };
}

async function analyzeDatasetPath(storagePath: string, request: AnalysisRequest): Promise<DatasetAnalysisResult> {
  let response: Response;
  try {
    response = await fetch(`${aiEnv.ANALYSIS_SERVICE_URL}/datasets/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: storagePath, operation: request.operation, parameters: request.parameters }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new DatasetToolError("The analysis service is unavailable");
  }

  if (!response.ok) {
    const details = await response.json().catch(() => null) as { detail?: unknown } | null;
    const detail = details?.detail;
    if (typeof detail === "object" && detail !== null) {
      const detailRecord = detail as Record<string, unknown>;
      const message = typeof detailRecord.error === "string" ? detailRecord.error : "The analysis service rejected the request";
      throw new DatasetToolError(message, detailRecord);
    }
    throw new DatasetToolError(typeof detail === "string" ? detail : "The analysis service rejected the request");
  }

  try {
    return datasetAnalysisResultSchema.parse(await response.json());
  } catch {
    throw new DatasetToolError("The analysis service returned an invalid analysis result");
  }
}

export const analyzeDatasetTool = createAnalyzeDatasetTool();
