import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const createProjectSchema = projectSchema.pick({ name: true, description: true }).extend({
  description: z.string().optional(),
});

export const datasetSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  filename: z.string().min(1),
  storagePath: z.string().min(1),
  rowCount: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});

export const createDatasetSchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1),
  storagePath: z.string().min(1),
  rowCount: z.number().int().nonnegative().optional(),
});

export const datasetColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  missingCount: z.number().int().nonnegative(),
  uniqueCount: z.number().int().nonnegative(),
});

export const datasetInspectionSchema = z.object({
  rowCount: z.number().int().nonnegative(),
  columnCount: z.number().int().nonnegative(),
  columns: z.array(datasetColumnSchema),
  preview: z.array(z.record(z.string(), z.unknown())).max(10),
});

export const analysisOperationSchema = z.enum([
  "summarize_column",
  "group_by",
  "aggregate",
  "compare_periods",
  "top_values",
  "correlation",
  "filter_and_aggregate",
]);

export const aggregationSchema = z.enum(["sum", "mean", "median", "min", "max", "count", "nunique"]);
export const sortDirectionSchema = z.enum(["asc", "desc"]);
export const filterOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"]);

const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

export const analysisFilterSchema = z.object({
  column: z.string().trim().min(1),
  operator: filterOperatorSchema,
  value: filterValueSchema.nullable().optional(),
});

export const analysisPeriodSchema = z.object({
  label: z.string().trim().min(1).max(80),
  start: z.string().trim().min(1),
  end: z.string().trim().min(1),
});

const filtersSchema = z.object({
  filters: z.array(analysisFilterSchema).max(50).optional(),
});

export const analysisRequestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("summarize_column"),
    parameters: z.object({ column: z.string().trim().min(1), ...filtersSchema.shape }).strict(),
  }),
  z.object({
    operation: z.literal("group_by"),
    parameters: z.object({
      groupBy: z.array(z.string().trim().min(1)).min(1).max(5),
      metric: z.string().trim().min(1),
      aggregation: aggregationSchema,
      sort: sortDirectionSchema.optional(),
      limit: z.number().int().min(1).max(100).optional(),
      ...filtersSchema.shape,
    }).strict(),
  }),
  z.object({
    operation: z.literal("aggregate"),
    parameters: z.object({ metric: z.string().trim().min(1), aggregation: aggregationSchema, ...filtersSchema.shape }).strict(),
  }),
  z.object({
    operation: z.literal("compare_periods"),
    parameters: z.object({
      dateColumn: z.string().trim().min(1),
      metric: z.string().trim().min(1),
      aggregation: aggregationSchema,
      periods: z.array(analysisPeriodSchema).length(2),
      ...filtersSchema.shape,
    }).strict(),
  }),
  z.object({
    operation: z.literal("top_values"),
    parameters: z.object({
      column: z.string().trim().min(1),
      metric: z.string().trim().min(1).optional(),
      aggregation: aggregationSchema.optional(),
      sort: sortDirectionSchema.optional(),
      limit: z.number().int().min(1).max(100).optional(),
      ...filtersSchema.shape,
    }).strict(),
  }),
  z.object({
    operation: z.literal("correlation"),
    parameters: z.object({
      column: z.string().trim().min(1),
      withColumns: z.array(z.string().trim().min(1)).min(1).max(50).optional(),
      ...filtersSchema.shape,
    }).strict(),
  }),
  z.object({
    operation: z.literal("filter_and_aggregate"),
    parameters: z.object({
      metric: z.string().trim().min(1),
      aggregation: aggregationSchema,
      groupBy: z.array(z.string().trim().min(1)).min(1).max(5).optional(),
      sort: sortDirectionSchema.optional(),
      limit: z.number().int().min(1).max(100).optional(),
      ...filtersSchema.shape,
    }).strict(),
  }),
]);

export const datasetAnalysisResultSchema = z.object({
  operation: analysisOperationSchema,
  columnsUsed: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())).max(100),
});

export const chartTypeSchema = z.enum(["line", "bar", "area", "scatter"]);

export const chartSeriesSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
}).strict();

export const chartSpecSchema = z.object({
  type: chartTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  sourceStepId: z.string().uuid(),
  xKey: z.string().trim().min(1),
  series: z.array(chartSeriesSchema).min(1).max(5),
  data: z.array(z.record(z.string(), z.unknown())).min(1).max(50),
}).strict().superRefine((chart, context) => {
  const seriesKeys = new Set<string>();
  const hasKey = (key: string) => chart.data.every((row) => Object.prototype.hasOwnProperty.call(row, key));
  if (!hasKey(chart.xKey)) {
    context.addIssue({ code: "custom", path: ["xKey"], message: `xKey '${chart.xKey}' is not present in every data row` });
  }
  for (const [index, series] of chart.series.entries()) {
    if (seriesKeys.has(series.key)) {
      context.addIssue({ code: "custom", path: ["series", index, "key"], message: `Series key '${series.key}' is duplicated` });
      continue;
    }
    seriesKeys.add(series.key);
    if (!hasKey(series.key)) {
      context.addIssue({ code: "custom", path: ["series", index, "key"], message: `Series key '${series.key}' is not present in every data row` });
      continue;
    }
    if (!chart.data.every((row) => typeof row[series.key] === "number" && Number.isFinite(row[series.key]))) {
      context.addIssue({ code: "custom", path: ["series", index, "key"], message: `Series '${series.key}' must contain finite numeric values` });
    }
  }
  if (chart.type === "scatter" && !chart.data.every((row) => typeof row[chart.xKey] === "number" && Number.isFinite(row[chart.xKey]))) {
    context.addIssue({ code: "custom", path: ["xKey"], message: "Scatter chart x values must be finite numbers" });
  }
});

export const analysisEvidenceSchema = datasetAnalysisResultSchema.extend({
  stepId: z.string().uuid(),
}).pick({ stepId: true, operation: true, columnsUsed: true, rows: true });

export const agentRunStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const agentRunSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  datasetId: z.string().uuid().nullable(),
  question: z.string().min(1),
  status: agentRunStatusSchema,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  tokenUsage: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  estimatedCost: z.number().nonnegative().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});

export const agentRunObservabilitySchema = z.object({
  totalDurationMs: z.number().int().nonnegative(),
  llmDurationMs: z.number().int().nonnegative(),
  toolDurationMs: z.number().int().nonnegative(),
  toolCallCount: z.number().int().nonnegative(),
  chartCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  totalTokens: z.number().int().nonnegative().nullable(),
  estimatedCost: z.number().nonnegative().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
});

export const agentRunSummarySchema = agentRunSchema.extend({
  toolCallCount: z.number().int().nonnegative(),
  chartCount: z.number().int().nonnegative(),
  totalToolDurationMs: z.number().int().nonnegative(),
  totalLlmDurationMs: z.number().int().nonnegative(),
});

export const agentRunListResponseSchema = z.object({
  items: z.array(agentRunSummarySchema),
  nextCursor: z.string().uuid().nullable(),
  hasMore: z.boolean(),
});

export const createAgentRunSchema = z.object({
  projectId: z.string().uuid(),
  datasetId: z.string().uuid().nullable().optional(),
  question: z.string().min(1),
  model: z.string().optional(),
});

export const askDatasetSchema = z.object({
  question: z.string().trim().min(1).max(2_000),
});

export const agentStepSchema = z.object({
  id: z.string().uuid(),
  agentRunId: z.string().uuid(),
  type: z.string().min(1),
  toolName: z.string().nullable(),
  status: z.string().min(1),
  input: z.unknown().nullable(),
  output: z.unknown().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
});

export const datasetDetailSchema = datasetSchema.extend({
  inspection: datasetInspectionSchema.nullable(),
});

export const verifiedClaimSchema = z.object({
  text: z.string().min(1),
  value: z.number(),
  supported: z.boolean(),
  sourceStepId: z.string().nullable(),
});

export const answerVerificationSchema = z.object({
  status: z.enum(["verified", "unsupported", "not_applicable"]),
  claims: z.array(verifiedClaimSchema),
  unsupportedColumns: z.array(z.string()),
});

export const agentRunResultSchema = z.object({
  run: agentRunSchema,
  answer: z.string(),
  steps: z.array(agentStepSchema),
  totalDurationMs: z.number().int().nonnegative(),
  evidence: z.array(analysisEvidenceSchema),
  charts: z.array(chartSpecSchema).max(3),
  observability: agentRunObservabilitySchema,
  verification: answerVerificationSchema.nullable(),
  errorSummary: z.string().nullable(),
});

export const evalFactSchema = z.object({
  field: z.string().min(1),
  value: z.unknown(),
  tolerance: z.number().nonnegative().optional(),
}).strict();

export const evalExpectedSchema = z.object({
  requiredTools: z.array(z.string()),
  forbiddenTools: z.array(z.string()),
  expectedOperation: analysisOperationSchema.nullable(),
  expectedAnswerFacts: z.array(evalFactSchema),
  requiresChart: z.boolean(),
}).strict();

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  question: z.string().min(1),
  critical: z.boolean().default(false),
  smoke: z.boolean().default(false),
  expected: evalExpectedSchema,
}).strict();

export const evalThresholdsSchema = z.object({
  minimumPassRate: z.number().min(0).max(1),
  minimumToolSelectionAccuracy: z.number().min(0).max(1),
  minimumNumericalAccuracy: z.number().min(0).max(1),
  minimumGroundingRate: z.number().min(0).max(1),
  maximumHallucinationRate: z.number().min(0).max(1),
  maximumAverageCost: z.number().nonnegative(),
  maximumAverageToolCalls: z.number().nonnegative(),
  maximumPassRateRegression: z.number().min(0).max(1),
  maximumGroundingRegression: z.number().min(0).max(1),
  criticalCasesMustPass: z.boolean(),
}).strict();

export const evalMetricComparisonSchema = z.object({
  metric: z.string().min(1),
  current: z.number().nullable(),
  baseline: z.number().nullable(),
  delta: z.number().nullable(),
  percentDelta: z.number().nullable(),
  status: z.enum(["improved", "within-tolerance", "regressed", "unavailable"]),
}).strict();

export const evalCaseChangeSchema = z.object({
  caseId: z.string().min(1),
  reason: z.string().min(1),
  previousPassed: z.boolean(),
  currentPassed: z.boolean(),
}).strict();

export const evalScoreSchema = z.object({
  toolSelection: z.number().min(0).max(1),
  numericalCorrectness: z.number().min(0).max(1),
  grounding: z.number().min(0).max(1),
  hallucination: z.number().min(0).max(1),
  chartCorrectness: z.number().min(0).max(1).nullable(),
}).strict();

export const evalToolStepSchema = z.object({
  stepId: z.string().uuid(),
  toolName: z.string().min(1),
  operation: z.string().nullable(),
  status: z.string().min(1),
  durationMs: z.number().int().nonnegative().nullable(),
}).strict();

export const evalCaseMetricsSchema = z.object({
  toolCalls: z.number().int().nonnegative(),
  failedToolCalls: z.number().int().nonnegative(),
  repeatedToolCalls: z.number().int().nonnegative(),
  unnecessaryInspectCalls: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative().nullable(),
  estimatedCost: z.number().nonnegative().nullable(),
}).strict();

export const evalCaseResultSchema = z.object({
  id: z.string().uuid(),
  suiteRunId: z.string().uuid(),
  caseId: z.string().min(1),
  category: z.string().min(1),
  question: z.string().min(1),
  critical: z.boolean(),
  expected: evalExpectedSchema,
  actualToolSequence: z.array(evalToolStepSchema),
  expectedFacts: z.array(evalFactSchema),
  observedEvidence: z.array(z.unknown()),
  actualAnswer: z.string(),
  agentRunId: z.string().uuid().nullable(),
  datasetId: z.string().uuid().nullable(),
  passed: z.boolean(),
  scores: evalScoreSchema,
  metrics: evalCaseMetricsSchema,
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
}).strict();

export const evalSuiteRunSchema = z.object({
  id: z.string().uuid(),
  suiteId: z.string().min(1),
  suiteVersion: z.string().min(1),
  datasetVersion: z.string().min(1),
  gitSha: z.string().nullable(),
  agentPromptVersion: z.string().min(1),
  toolSchemaVersion: z.string().min(1),
  reasoningConfig: z.string().nullable(),
  baselineRunId: z.string().uuid().nullable(),
  qualityPassed: z.boolean(),
  regressionStatus: z.enum(["passed", "failed", "no-baseline"]),
  thresholdFailures: z.array(z.string()),
  baselineComparison: z.array(evalMetricComparisonSchema),
  provider: z.string(),
  model: z.string(),
  modelRole: z.enum(["baseline", "candidate"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  totalCases: z.number().int().nonnegative(),
  passedCases: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(1),
  toolSelectionAccuracy: z.number().min(0).max(1),
  numericalAccuracy: z.number().min(0).max(1),
  groundingRate: z.number().min(0).max(1),
  hallucinationFreeRate: z.number().min(0).max(1),
  chartSuccessRate: z.number().min(0).max(1).nullable(),
  averageToolCalls: z.number().nonnegative(),
  averageTokens: z.number().nonnegative().nullable(),
  averageCost: z.number().nonnegative().nullable(),
  averageLatencyMs: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
}).strict();

export const evalSuiteRunDetailSchema = evalSuiteRunSchema.extend({
  cases: z.array(evalCaseResultSchema),
  regressions: z.array(evalCaseChangeSchema),
  improvements: z.array(evalCaseChangeSchema),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});

export type Project = z.infer<typeof projectSchema>;
export type User = z.infer<typeof userSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;
export type DatasetColumn = z.infer<typeof datasetColumnSchema>;
export type DatasetInspection = z.infer<typeof datasetInspectionSchema>;
export type AnalysisOperation = z.infer<typeof analysisOperationSchema>;
export type Aggregation = z.infer<typeof aggregationSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
export type FilterOperator = z.infer<typeof filterOperatorSchema>;
export type AnalysisFilter = z.infer<typeof analysisFilterSchema>;
export type AnalysisPeriod = z.infer<typeof analysisPeriodSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type DatasetAnalysisResult = z.infer<typeof datasetAnalysisResultSchema>;
export type AnalysisEvidence = z.infer<typeof analysisEvidenceSchema>;
export type ChartType = z.infer<typeof chartTypeSchema>;
export type ChartSeries = z.infer<typeof chartSeriesSchema>;
export type ChartSpec = z.infer<typeof chartSpecSchema>;
export type DatasetDetail = z.infer<typeof datasetDetailSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentRunObservability = z.infer<typeof agentRunObservabilitySchema>;
export type AgentRunSummary = z.infer<typeof agentRunSummarySchema>;
export type AgentRunListResponse = z.infer<typeof agentRunListResponseSchema>;
export type CreateAgentRunInput = z.infer<typeof createAgentRunSchema>;
export type AskDatasetInput = z.infer<typeof askDatasetSchema>;
export type AgentStep = z.infer<typeof agentStepSchema>;
export type AgentRunResult = z.infer<typeof agentRunResultSchema>;
export type VerifiedClaim = z.infer<typeof verifiedClaimSchema>;
export type AnswerVerification = z.infer<typeof answerVerificationSchema>;
export type EvalFact = z.infer<typeof evalFactSchema>;
export type EvalExpected = z.infer<typeof evalExpectedSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalThresholds = z.infer<typeof evalThresholdsSchema>;
export type EvalMetricComparison = z.infer<typeof evalMetricComparisonSchema>;
export type EvalCaseChange = z.infer<typeof evalCaseChangeSchema>;
export type EvalScore = z.infer<typeof evalScoreSchema>;
export type EvalToolStep = z.infer<typeof evalToolStepSchema>;
export type EvalCaseMetrics = z.infer<typeof evalCaseMetricsSchema>;
export type EvalCaseResult = z.infer<typeof evalCaseResultSchema>;
export type EvalSuiteRun = z.infer<typeof evalSuiteRunSchema>;
export type EvalSuiteRunDetail = z.infer<typeof evalSuiteRunDetailSchema>;
