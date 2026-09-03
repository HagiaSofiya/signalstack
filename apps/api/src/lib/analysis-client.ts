import { datasetInspectionSchema, type DatasetInspection } from "@signalstack/schemas";

import { apiEnv } from "./env.js";

export class AnalysisServiceError extends Error {
  constructor(message: string, readonly statusCode: 422 | 503) {
    super(message);
    this.name = "AnalysisServiceError";
  }
}

export async function inspectDataset(storagePath: string): Promise<DatasetInspection> {
  let response: Response;
  try {
    response = await fetch(`${apiEnv.ANALYSIS_SERVICE_URL}/datasets/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: storagePath }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AnalysisServiceError("The analysis service is unavailable", 503);
  }

  if (!response.ok) {
    const errorText = await response.text();
    const statusCode = response.status === 422 ? 422 : 503;
    throw new AnalysisServiceError(
      `The analysis service rejected the dataset${errorText ? `: ${errorText}` : ""}`,
      statusCode,
    );
  }

  return datasetInspectionSchema.parse(await response.json());
}
