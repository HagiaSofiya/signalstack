export type AgentStatus = "queued" | "running" | "completed" | "failed";

export { aiEnv } from "./config.js";

export interface AgentRun {
  id: string;
  projectId: string;
  datasetId: string | null;
  question: string;
  status: AgentStatus;
  provider: string | null;
  model: string | null;
  tokenUsage: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface AgentStep {
  id: string;
  agentRunId: string;
  type: string;
  toolName: string | null;
  status: string;
  input: unknown;
  output: unknown;
  durationMs: number | null;
  createdAt: Date;
}

export interface AgentToolContext {
  datasetId: string;
  agentRunId?: string;
  signal: AbortSignal;
}

export interface AgentTool<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
  execute(input: Input, context: AgentToolContext): Promise<Output>;
}

export {
  AgentExecutionError,
  runAgent,
  DATA_ASSISTANT_INSTRUCTIONS,
} from "./agent/runAgent.js";
export type { AgentExecutionStep, AgentResult } from "./agent/runAgent.js";
export { verifyAnswer } from "./grounding/verifyAnswer.js";
export type { VerifiableStep } from "./grounding/verifyAnswer.js";
export {
  createInspectDatasetTool,
  inspectDatasetTool,
} from "./tools/inspectDatasetTool.js";
export {
  createAnalyzeDatasetTool,
  analyzeDatasetTool,
} from "./tools/analyzeDatasetTool.js";
export type { AnalyzeDatasetInput } from "./tools/analyzeDatasetTool.js";
export { createChartTool, createChart } from "./tools/createChartTool.js";
export type { CreateChartInput } from "./tools/createChartTool.js";
export { DatasetToolError } from "./tools/tool-errors.js";
export {
  createLLMProvider,
  OpenAIProvider,
  OpenRouterProvider,
} from "./providers/index.js";
export { LLMProviderError } from "./providers/provider.js";
export { calculateEstimatedCost, modelPricing } from "./providers/pricing.js";
export { EvalInfrastructureError, runEvalSuite } from "./evals/runEvalSuite.js";
export type { EvalGroundTruth, EvalSuiteResult } from "./evals/runEvalSuite.js";
export type {
  LLMProvider,
  ProviderResponse,
  ProviderToolCall,
  ProviderToolDefinition,
  ProviderUsage,
} from "./providers/provider.js";
