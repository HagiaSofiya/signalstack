import {
  agentRunListResponseSchema,
  agentRunResultSchema,
  evalSuiteRunDetailSchema,
  evalSuiteRunSchema,
  datasetDetailSchema,
  type AgentRunListResponse,
  type AgentRunResult,
  type DatasetDetail,
  type EvalSuiteRun,
  type EvalSuiteRunDetail,
} from "@signalstack/schemas";

import { webEnv } from "./env";

type UploadProgressHandler = (progress: number) => void;

export function uploadDataset(
  projectId: string,
  file: File,
  onProgress: UploadProgressHandler,
): Promise<DatasetDetail> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", file, file.name);

    request.open("POST", `${webEnv.NEXT_PUBLIC_API_URL}/datasets/upload`);
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("Could not reach the SignalStack API")));
    request.addEventListener("load", () => {
      const payload = request.response as { data?: unknown; error?: string } | null;
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload?.error ?? "The dataset upload failed"));
        return;
      }

      const parsed = datasetDetailSchema.safeParse(payload?.data);
      if (!parsed.success) {
        reject(new Error("The API returned an invalid dataset response"));
        return;
      }
      resolve(parsed.data);
    });
    request.send(formData);
  });
}

export async function askDataset(datasetId: string, question: string): Promise<AgentRunResult> {
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/datasets/${datasetId}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "The agent run failed");

  const parsed = agentRunResultSchema.safeParse(payload?.data);
  if (!parsed.success) throw new Error("The API returned an invalid agent run response");
  return parsed.data;
}

export async function getDataset(datasetId: string): Promise<DatasetDetail> {
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/datasets/${datasetId}`);
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "The dataset could not be loaded");

  const parsed = datasetDetailSchema.safeParse(payload?.data);
  if (!parsed.success) throw new Error("The API returned an invalid dataset response");
  return parsed.data;
}

export async function getDatasetRuns(input: {
  datasetId: string;
  limit?: number;
  cursor?: string;
  status?: "queued" | "running" | "completed" | "failed";
}): Promise<AgentRunListResponse> {
  const query = new URLSearchParams({ limit: String(input.limit ?? 20) });
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.status) query.set("status", input.status);
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/datasets/${input.datasetId}/runs?${query.toString()}`);
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Run history could not be loaded");
  const parsed = agentRunListResponseSchema.safeParse(payload?.data);
  if (!parsed.success) throw new Error("The API returned an invalid run history response");
  return parsed.data;
}

export async function getAgentRun(runId: string, datasetId?: string): Promise<AgentRunResult> {
  const query = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/agent-runs/${runId}${query}`);
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Agent run could not be loaded");
  const parsed = agentRunResultSchema.safeParse(payload?.data);
  if (!parsed.success) throw new Error("The API returned an invalid agent run response");
  return parsed.data;
}

export async function getEvalSuiteRuns(): Promise<EvalSuiteRun[]> {
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/evals`);
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Evaluation runs could not be loaded");
  const parsed = evalSuiteRunSchema.array().safeParse(payload?.data);
  if (!parsed.success) throw new Error("The API returned invalid evaluation runs");
  return parsed.data;
}

export async function getEvalSuiteRun(evalRunId: string): Promise<EvalSuiteRunDetail> {
  const response = await fetch(`${webEnv.NEXT_PUBLIC_API_URL}/evals/${evalRunId}`);
  const payload = (await response.json().catch(() => null)) as { data?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Evaluation run could not be loaded");
  const parsed = evalSuiteRunDetailSchema.safeParse(payload?.data);
  if (!parsed.success) throw new Error("The API returned an invalid evaluation detail");
  return parsed.data;
}
