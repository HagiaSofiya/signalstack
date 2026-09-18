import type { AgentStep } from "@signalstack/schemas";
import { answerVerificationSchema, datasetAnalysisResultSchema } from "@signalstack/schemas";

import { Badge } from "@/components/ui/badge";

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toolSummary(step: AgentStep) {
  if (step.toolName === "inspect_dataset") return "Schema, missing values, and preview";
  const input = objectValue(step.input);
  if (step.toolName === "create_chart") {
    const chartType = typeof input?.chartType === "string" ? input.chartType : "chart";
    const title = typeof input?.title === "string" ? input.title : "validated analysis result";
    return `${chartType} chart · ${title}`;
  }
  const parameters = objectValue(input?.parameters);
  const operation = typeof input?.operation === "string" ? input.operation : null;
  if (!operation) return "Structured analysis";

  const metric = typeof parameters?.metric === "string" ? parameters.metric : "metric";
  const column = typeof parameters?.column === "string" ? parameters.column : "column";
  const aggregation = typeof parameters?.aggregation === "string" ? parameters.aggregation : "calculation";
  if (operation === "group_by") {
    const groups = Array.isArray(parameters?.groupBy) ? parameters.groupBy.join(", ") : "group";
    return `Grouped ${metric} by ${groups}`;
  }
  if (operation === "compare_periods") {
    const periods = Array.isArray(parameters?.periods) ? parameters.periods : [];
    const labels = periods.map((period) => objectValue(period)?.label).filter((label): label is string => typeof label === "string");
    return labels.length === 2 ? `Compared ${labels[0]} with ${labels[1]}` : "Compared two periods";
  }
  if (operation === "top_values") return `Top values for ${column}${parameters?.metric ? ` by ${metric}` : ""}`;
  if (operation === "correlation") return `Correlation with ${column}`;
  if (operation === "aggregate") return `Calculated ${aggregation} of ${metric}`;
  if (operation === "filter_and_aggregate") return `Aggregated ${metric} with filters`;
  return `Summarized ${column}`;
}

function verificationSummary(step: AgentStep) {
  const parsed = answerVerificationSchema.safeParse(step.output);
  if (!parsed.success) return null;
  const { status, claims, unsupportedColumns } = parsed.data;
  if (status === "not_applicable") return "No numeric claims to verify";
  const figures = `${claims.length} figure${claims.length === 1 ? "" : "s"}`;
  if (status === "verified") return claims.length ? `${figures} matched to tool results` : "Referenced columns matched the inspected schema";
  const unsupported = claims.filter((claim) => !claim.supported).length;
  const columns = unsupportedColumns.length ? ` · ${unsupportedColumns.length} unknown column${unsupportedColumns.length === 1 ? "" : "s"}` : "";
  return `${unsupported} of ${figures} not found in tool results${columns}`;
}

function verificationStatus(step: AgentStep) {
  if (step.type !== "verification") return null;
  const parsed = answerVerificationSchema.safeParse(step.output);
  return parsed.success ? parsed.data.status : null;
}

function operationLabel(step: AgentStep) {
  if (step.toolName === "inspect_dataset") return "Inspect dataset";
  if (step.toolName === "create_chart") return "Create chart";
  if (step.toolName === "analyze_dataset") {
    const parsed = datasetAnalysisResultSchema.safeParse(step.output);
    return parsed.success ? parsed.data.operation.replaceAll("_", " ") : "Analyze dataset";
  }
  if (step.type === "generate_answer") return "Generate answer";
  return step.type === "verification" ? "Verify answer" : "Agent step";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AgentStepView({ step, index }: { step: AgentStep; index: number }) {
  const completed = step.status === "completed";
  const isTool = step.toolName !== null;
  const verdict = verificationStatus(step);
  const hasStructuredOutput = (isTool || step.type === "verification") && step.output !== null;
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{index + 1}. {operationLabel(step)}</p>
        {verdict
          ? <Badge variant={verdict === "verified" ? "success" : verdict === "unsupported" ? "secondary" : "outline"}>{verdict.replace("_", " ")}</Badge>
          : <Badge variant={completed ? "success" : "secondary"}>{step.status}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{step.durationMs?.toLocaleString() ?? "—"} ms</span>
      </div>
      <p className="text-xs text-muted-foreground">{formatTimestamp(step.createdAt)}</p>
      {isTool ? <p className="text-xs text-muted-foreground">{step.toolName} · {toolSummary(step)}</p> : null}
      {step.type === "verification" ? <p className="text-xs text-muted-foreground">{verificationSummary(step) ?? "Answer verification"}</p> : null}
      {hasStructuredOutput ? (
        <details className="rounded-lg bg-secondary/50 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">View structured result</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(step.output, null, 2)}</pre>
        </details>
      ) : null}
    </li>
  );
}
