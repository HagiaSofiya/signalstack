import { getDb } from "@signalstack/db";
import {
  chartSpecSchema,
  datasetAnalysisResultSchema,
  type ChartSpec,
} from "@signalstack/schemas";
import { z } from "zod";

import type { AgentTool, AgentToolContext } from "../index.js";
import { DatasetToolError } from "./tool-errors.js";

const chartTypeSchema = z.enum(["line", "bar", "area", "scatter"]);
const chartSeriesInputSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
}).strict();
const createChartInputSchema = z.object({
  sourceStepId: z.string().uuid(),
  chartType: chartTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  xKey: z.string().trim().min(1),
  series: z.array(chartSeriesInputSchema).min(1).max(5),
}).strict();

const createChartParameters = {
  type: "object",
  properties: {
    sourceStepId: { type: "string", description: "The AgentStep ID of a completed analyze_dataset result." },
    chartType: { type: "string", enum: ["line", "bar", "area", "scatter"] },
    title: { type: "string", description: "A concise chart title." },
    description: { type: "string", description: "Optional one-sentence description of the chart." },
    xKey: { type: "string", description: "A key present in the source analysis rows." },
    series: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "A numeric key present in the source analysis rows." },
          label: { type: "string" },
        },
        required: ["key", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["sourceStepId", "chartType", "title", "xKey", "series"],
  additionalProperties: false,
} as const;

export type CreateChartInput = z.infer<typeof createChartInputSchema>;

type SourceAnalysisStep = {
  agentRunId: string;
  toolName: string | null;
  status: string;
  output: unknown;
};

export function createChartTool(dependencies: {
  resolveStep?: (stepId: string) => Promise<SourceAnalysisStep | null>;
} = {}): AgentTool<CreateChartInput, ChartSpec> {
  const resolveStep = dependencies.resolveStep ?? (async (stepId: string) => {
    const step = await getDb().agentStep.findUnique({
      where: { id: stepId },
      select: { agentRunId: true, toolName: true, status: true, output: true },
    });
    return step;
  });

  return {
    name: "create_chart",
    description: "Create a chart from a completed analyze_dataset AgentStep. Use only sourceStepId and keys from that structured result; never provide or invent raw chart data.",
    parameters: createChartParameters,
    strict: false,
    async execute(input: CreateChartInput, context: AgentToolContext) {
      const parsedInput = createChartInputSchema.safeParse(input);
      if (!parsedInput.success) {
        throw new DatasetToolError("create_chart received invalid arguments", { validation: parsedInput.error.flatten() });
      }

      let sourceStep: SourceAnalysisStep | null;
      try {
        sourceStep = await resolveStep(parsedInput.data.sourceStepId);
      } catch {
        throw new DatasetToolError("The source analysis step could not be loaded");
      }
      if (!sourceStep) throw new DatasetToolError("The source analysis step was not found");
      if (context.agentRunId && sourceStep.agentRunId !== context.agentRunId) {
        throw new DatasetToolError("The source analysis step does not belong to this agent run");
      }
      if (sourceStep.toolName !== "analyze_dataset" || sourceStep.status !== "completed") {
        throw new DatasetToolError("The source step does not contain a completed analysis result");
      }

      const analysis = datasetAnalysisResultSchema.safeParse(sourceStep.output);
      if (!analysis.success) throw new DatasetToolError("The source analysis step does not contain usable structured data");

      const chart = chartSpecSchema.safeParse({
        type: parsedInput.data.chartType,
        title: parsedInput.data.title,
        description: parsedInput.data.description,
        sourceStepId: parsedInput.data.sourceStepId,
        xKey: parsedInput.data.xKey,
        series: parsedInput.data.series,
        data: analysis.data.rows,
      });
      if (!chart.success) {
        throw new DatasetToolError("The requested chart could not be created from the analysis result", {
          validation: chart.error.flatten(),
        });
      }
      return chart.data;
    },
  };
}

export const createChart = createChartTool();
