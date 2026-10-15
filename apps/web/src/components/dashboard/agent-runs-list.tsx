import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3, LoaderCircle, MessageSquareText } from "lucide-react";
import type { AgentRun, AgentRunStatus } from "@signalstack/schemas";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusIcons = {
  queued: Clock3,
  running: LoaderCircle,
  completed: CheckCircle2,
  failed: CircleAlert,
};

const statusLabels: Record<AgentRunStatus, string> = {
  queued: "Queued",
  running: "In progress",
  completed: "Completed",
  failed: "Failed",
};

const rowClassName = "flex items-center gap-3 rounded-xl border bg-background p-3.5";

function badgeVariant(status: AgentRunStatus) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

function describe(run: AgentRun) {
  const asked = new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return run.durationMs === null ? asked : `${asked} · ${(run.durationMs / 1000).toFixed(1)} sec`;
}

export function AgentRunRow({ run }: { run: AgentRun }) {
  const StatusIcon = statusIcons[run.status];
  const content = (
    <>
      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <MessageSquareText aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{run.question}</p>
        <p className="text-xs text-muted-foreground">{describe(run)}</p>
      </div>
      <Badge variant={badgeVariant(run.status)}>
        <StatusIcon aria-hidden="true" />
        {statusLabels[run.status]}
      </Badge>
    </>
  );

  if (run.datasetId === null) return <div className={rowClassName}>{content}</div>;
  return (
    <Link href={`/datasets/${run.datasetId}/runs/${run.id}`} className={`${rowClassName} transition-colors hover:bg-secondary/40`}>
      {content}
    </Link>
  );
}

export function AgentRunsList({ runs }: { runs: AgentRun[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Recent agent runs</CardTitle>
          <CardDescription>Questions asked across your project data.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/agent-runs">View all <ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {runs.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No agent runs yet. Ask a question about a dataset to get started.
          </p>
        ) : null}
        {runs.map((run) => <AgentRunRow key={run.id} run={run} />)}
      </CardContent>
    </Card>
  );
}
