import { AlertTriangle, ListTree } from "lucide-react";
import dynamic from "next/dynamic";
import type { AgentRunResult, AnalysisEvidence } from "@signalstack/schemas";

import { AgentStepView } from "@/components/dashboard/agent-step-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const ChartRenderer = dynamic(() => import("@/components/charts/chart-renderer").then((module) => module.ChartRenderer), {
  ssr: false,
  loading: () => <div className="flex h-80 items-center justify-center rounded-xl bg-secondary/30 text-sm text-muted-foreground">Loading chart…</div>,
});

function evidenceLabel(evidence: AnalysisEvidence) {
  return evidence.operation.replaceAll("_", " ");
}

function formatDuration(value: number | null) {
  return value === null ? "Unavailable" : value < 1_000 ? `${value.toLocaleString()} ms` : `${(value / 1_000).toFixed(1)} s`;
}

function formatTokens(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString();
}

function formatCost(value: number | null) {
  return value === null ? "Unavailable" : `$${value.toFixed(6)}`;
}

function statusVariant(status: AgentRunResult["run"]["status"]) {
  return status === "completed" ? "success" : status === "failed" ? "secondary" : "outline";
}

export function AgentRunDetail({ result }: { result: AgentRunResult }) {
  const { observability } = result;
  const statusLabel = result.run.status === "completed" ? "completed" : result.run.status;

  return (
    <Card className="border-primary/20 bg-card shadow-md">
      <CardHeader>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-primary"><ListTree aria-hidden="true" /> Agent run <Badge variant={statusVariant(result.run.status)} className="capitalize">{statusLabel}</Badge></div>
          <CardTitle>Answer</CardTitle>
          <CardDescription className="text-sm leading-6 text-foreground">{result.answer}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {result.errorSummary ? <Alert className="border-destructive/30 bg-destructive/5"><AlertTriangle aria-hidden="true" /><div><AlertTitle>Run failed</AlertTitle><AlertDescription>{result.errorSummary}</AlertDescription></div></Alert> : null}
        <div className="grid gap-3 rounded-xl bg-secondary/50 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-muted-foreground">Model / provider</p><p className="mt-1 font-medium">{observability.model ?? "Unavailable"} · {observability.provider ?? "Unavailable"}</p></div>
          <div><p className="text-muted-foreground">Total duration</p><p className="mt-1 font-medium">{formatDuration(observability.totalDurationMs)}</p></div>
          <div><p className="text-muted-foreground">LLM / tool duration</p><p className="mt-1 font-medium">{formatDuration(observability.llmDurationMs)} · {formatDuration(observability.toolDurationMs)}</p></div>
          <div><p className="text-muted-foreground">Tool calls / charts</p><p className="mt-1 font-medium">{observability.toolCallCount} · {observability.chartCount}</p></div>
          <div><p className="text-muted-foreground">Input tokens</p><p className="mt-1 font-medium">{formatTokens(observability.inputTokens)}</p></div>
          <div><p className="text-muted-foreground">Output tokens</p><p className="mt-1 font-medium">{formatTokens(observability.outputTokens)}</p></div>
          <div><p className="text-muted-foreground">Total tokens</p><p className="mt-1 font-medium">{formatTokens(observability.totalTokens)}</p></div>
          <div><p className="text-muted-foreground">Estimated cost</p><p className="mt-1 font-medium">{formatCost(observability.estimatedCost)}</p></div>
        </div>
        <Separator />
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Run timeline</p>
          <ol className="flex flex-col gap-3" aria-label="Agent run timeline">
            <li className="rounded-xl border border-dashed bg-secondary/20 p-4">
              <p className="text-sm font-semibold">User question</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.run.question}</p>
            </li>
            {result.steps.map((step, index) => <AgentStepView key={`${step.type}-${index}`} step={step} index={index + 1} />)}
          </ol>
        </div>
        {result.charts.length ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Visual analysis</p>
            <div className="grid gap-4 xl:grid-cols-2">
              {result.charts.map((chart) => (
                <Card key={chart.sourceStepId} className="overflow-hidden border-primary/15">
                  <CardHeader className="border-b bg-secondary/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><CardTitle>{chart.title}</CardTitle>{chart.description ? <CardDescription className="mt-1">{chart.description}</CardDescription> : null}</div>
                      <Badge variant="outline" className="shrink-0 capitalize">{chart.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ChartRenderer spec={chart} />
                    <p className="mt-2 text-xs text-muted-foreground">Source analysis step {chart.sourceStepId.slice(0, 8)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
        {result.evidence.length ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidence from analysis</p>
            {result.evidence.map((evidence) => (
              <div key={evidence.stepId} className="rounded-xl border bg-secondary/30 p-4">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold capitalize">{evidenceLabel(evidence)}</p><Badge variant="outline">step {evidence.stepId.slice(0, 8)}</Badge></div>
                <div className="mt-3 flex flex-col gap-2">
                  {evidence.rows.map((row, index) => <div key={index} className="grid gap-2 rounded-lg bg-background p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">{Object.entries(row).map(([key, value]) => <div key={key}><p className="text-muted-foreground">{key}</p><p className="mt-0.5 font-medium">{value === null || value === undefined ? "—" : String(value)}</p></div>)}</div>)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
