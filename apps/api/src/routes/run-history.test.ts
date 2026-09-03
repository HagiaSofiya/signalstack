import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  listAgentRunSummaries: vi.fn(),
  findAgentRunWithSteps: vi.fn(),
  listEvalSuiteRuns: vi.fn(),
  findEvalSuiteRunWithCases: vi.fn(),
}));

vi.mock("@signalstack/db", () => mocks);

import { agentRunRoutes } from "./agent-runs.js";
import { datasetRunRoutes } from "./dataset-runs.js";
import { evalRoutes } from "./evals.js";

const datasetId = "11111111-1111-4111-8111-111111111111";
const otherDatasetId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const analysisStepId = "44444444-4444-4444-8444-444444444444";
const chartStepId = "55555555-5555-4555-8555-555555555555";
const createdAt = "2026-09-03T12:00:00.000Z";

const run = {
  id: runId,
  projectId: "66666666-6666-4666-8666-666666666666",
  datasetId,
  question: "Show revenue by channel",
  status: "completed" as const,
  provider: "openai",
  model: "gpt-4o-mini",
  tokenUsage: 30,
  inputTokens: 20,
  outputTokens: 10,
  totalTokens: 30,
  estimatedCost: 0.000012,
  startedAt: createdAt,
  completedAt: "2026-09-03T12:00:01.000Z",
  durationMs: 1_000,
  createdAt,
};

const steps = [
  {
    id: analysisStepId,
    agentRunId: runId,
    type: "tool",
    toolName: "analyze_dataset",
    status: "completed",
    input: { operation: "group_by" },
    output: { operation: "group_by", columnsUsed: ["channel", "revenue"], rows: [{ channel: "Search", revenue: 42 }] },
    durationMs: 400,
    createdAt,
  },
  {
    id: chartStepId,
    agentRunId: runId,
    type: "tool",
    toolName: "create_chart",
    status: "completed",
    input: { sourceStepId: analysisStepId },
    output: { type: "bar", title: "Revenue by channel", sourceStepId: analysisStepId, xKey: "channel", series: [{ key: "revenue", label: "Revenue" }], data: [{ channel: "Search", revenue: 42 }] },
    durationMs: 100,
    createdAt: "2026-09-03T12:00:00.500Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    agentRunId: runId,
    type: "generate_answer",
    toolName: null,
    status: "completed",
    input: { phase: "final" },
    output: { answer: "Search generated $42." },
    durationMs: 500,
    createdAt: "2026-09-03T12:00:00.900Z",
  },
];

describe("run history routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes cursor pagination and status filters to the dataset run repository", async () => {
    mocks.getDb.mockReturnValue({ dataset: { findUnique: vi.fn().mockResolvedValue({ id: datasetId }) } });
    mocks.listAgentRunSummaries.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

    const response = await datasetRunRoutes.request(`/${datasetId}/runs?limit=10&cursor=${runId}&status=completed`);

    expect(response.status).toBe(200);
    expect(mocks.listAgentRunSummaries).toHaveBeenCalledWith({ datasetId, limit: 10, cursor: runId, status: "completed" });
  });

  it("reconstructs ordered steps, evidence, and charts from persisted records", async () => {
    mocks.findAgentRunWithSteps.mockResolvedValue({ run, steps });

    const response = await agentRunRoutes.request(`/${runId}?datasetId=${datasetId}`);
    const payload = await response.json() as { data: { answer: string; steps: Array<{ id: string }>; charts: unknown[]; evidence: unknown[] } };

    expect(response.status).toBe(200);
    expect(payload.data.answer).toBe("Search generated $42.");
    expect(payload.data.steps.map((step) => step.id)).toEqual([analysisStepId, chartStepId, steps[2]?.id]);
    expect(payload.data.evidence).toHaveLength(1);
    expect(payload.data.charts).toHaveLength(1);
  });

  it("does not disclose a run through the wrong dataset context", async () => {
    mocks.findAgentRunWithSteps.mockResolvedValue({ run, steps });

    const response = await agentRunRoutes.request(`/${runId}?datasetId=${otherDatasetId}`);

    expect(response.status).toBe(404);
  });

  it("returns a safe 404 for an unknown dataset", async () => {
    mocks.getDb.mockReturnValue({ dataset: { findUnique: vi.fn().mockResolvedValue(null) } });

    const response = await datasetRunRoutes.request(`/${datasetId}/runs`);

    expect(response.status).toBe(404);
  });

  it("lists and opens persisted evaluation suite runs", async () => {
    mocks.listEvalSuiteRuns.mockResolvedValue([]);
    mocks.findEvalSuiteRunWithCases.mockResolvedValue({ id: runId, cases: [] });

    const listResponse = await evalRoutes.request("/?limit=5");
    const detailResponse = await evalRoutes.request(`/${runId}`);

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(mocks.listEvalSuiteRuns).toHaveBeenCalledWith(5);
    expect(mocks.findEvalSuiteRunWithCases).toHaveBeenCalledWith(runId);
  });
});
