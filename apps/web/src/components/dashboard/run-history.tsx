"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, History, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { AgentRunSummary } from "@signalstack/schemas";

import { getDatasetRuns } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatCost(value: number | null) {
  return value === null ? "Unavailable" : `$${value.toFixed(6)}`;
}

function formatDuration(value: number | null) {
  return value === null ? "Unavailable" : value < 1_000 ? `${value} ms` : `${(value / 1_000).toFixed(1)} s`;
}

function statusVariant(status: AgentRunSummary["status"]) {
  return status === "completed" ? "success" : status === "failed" ? "secondary" : "outline";
}

export function RunHistory({ datasetId }: { datasetId: string }) {
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void getDatasetRuns({ datasetId }).then((result) => {
      if (!active) return;
      setRuns(result.items);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Run history could not be loaded");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [datasetId]);

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await getDatasetRuns({ datasetId, cursor: nextCursor });
      setRuns((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "More runs could not be loaded");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Run history">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observability</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Run history</h2><p className="mt-1 text-sm text-muted-foreground">Reopen previous answers, evidence, charts, and execution traces.</p></div>
        {runs.length ? <Badge variant="outline">{runs.length}{hasMore ? "+" : ""} runs</Badge> : null}
      </div>
      {error ? <Alert className="border-destructive/30 bg-destructive/5"><AlertTitle>Run history unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      {isLoading ? <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading previous runs…</CardContent></Card> : null}
      {!isLoading && !error && !runs.length ? <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><History className="text-primary" aria-hidden="true" /><p className="text-sm font-semibold">No runs yet</p><p className="max-w-md text-sm text-muted-foreground">Ask a question above to create the first observable analysis run for this dataset.</p></CardContent></Card> : null}
      {!isLoading && runs.length ? (
        <div className="flex flex-col gap-3">
          {runs.map((run) => (
            <Link key={run.id} href={`/datasets/${datasetId}/runs/${run.id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="transition-colors group-hover:border-primary/40">
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold leading-6">{run.question}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(run.createdAt)}</p></div><Badge variant={statusVariant(run.status)} className="capitalize">{run.status}</Badge><ArrowUpRight className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></div>
                  <div className="grid gap-3 border-t pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div><p className="text-muted-foreground">Model</p><p className="mt-1 truncate font-medium">{run.model ?? "Unavailable"}</p></div>
                    <div><p className="text-muted-foreground">Duration</p><p className="mt-1 font-medium">{formatDuration(run.durationMs)}</p></div>
                    <div><p className="text-muted-foreground">Tokens / tool calls</p><p className="mt-1 font-medium">{run.totalTokens ?? run.tokenUsage ?? "Unavailable"} · {run.toolCallCount}</p></div>
                    <div><p className="text-muted-foreground">Cost / charts</p><p className="mt-1 font-medium">{formatCost(run.estimatedCost)} · {run.chartCount}</p></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {hasMore ? <div className="flex justify-center pt-2"><Button variant="outline" onClick={(event) => { event.preventDefault(); void loadMore(); }} disabled={isLoadingMore}>{isLoadingMore ? <><LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" /> Loading</> : "Load more runs"}</Button></div> : null}
        </div>
      ) : null}
    </section>
  );
}
