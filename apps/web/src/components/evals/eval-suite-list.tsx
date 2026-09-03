"use client";

import { useEffect, useState } from "react";
import { FlaskConical, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import type { EvalSuiteRun } from "@signalstack/schemas";

import { getEvalSuiteRuns } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function cost(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(6)}`;
}

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function SuiteMetrics({ run }: { run: EvalSuiteRun }) {
  return <div className="grid gap-3 border-t pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
    <div><p className="text-muted-foreground">Pass rate</p><p className="mt-1 font-medium">{percent(run.passRate)} · {run.passedCases}/{run.totalCases}</p></div>
    <div><p className="text-muted-foreground">Avg tokens</p><p className="mt-1 font-medium">{run.averageTokens?.toLocaleString() ?? "—"}</p></div>
    <div><p className="text-muted-foreground">Avg cost</p><p className="mt-1 font-medium">{cost(run.averageCost)}</p></div>
    <div><p className="text-muted-foreground">Avg latency</p><p className="mt-1 font-medium">{(run.averageLatencyMs / 1_000).toFixed(1)}s</p></div>
  </div>;
}

function Comparison({ runs }: { runs: EvalSuiteRun[] }) {
  return <Card className="border-primary/20 bg-primary/[0.03]">
    <CardHeader><CardTitle>Model comparison</CardTitle><CardDescription>Compare the two selected evaluation runs without rerunning them.</CardDescription></CardHeader>
    <CardContent className="grid gap-4 md:grid-cols-2">
      {runs.map((run) => <div key={run.id} className="rounded-xl border bg-background p-4"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold">{run.model}</p><div className="flex items-center gap-2"><Badge variant="outline">{run.modelRole}</Badge><Badge variant="outline">{percent(run.passRate)}</Badge></div></div><p className="mt-1 text-xs text-muted-foreground">{run.provider} · {date(run.createdAt)}</p><Separator className="my-3" /><SuiteMetrics run={run} /></div>)}
    </CardContent>
  </Card>;
}

export function EvalSuiteList() {
  const [runs, setRuns] = useState<EvalSuiteRun[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getEvalSuiteRuns().then((value) => { if (active) setRuns(value); }).catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Evaluation runs could not be loaded"); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  function toggleSelection(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length === 2 ? [current[1]!, id] : [...current, id]);
  }

  const selectedRuns = selected.flatMap((id) => { const run = runs.find((item) => item.id === id); return run ? [run] : []; });

  return <section className="flex flex-col gap-5">
    {error ? <Alert className="border-destructive/30 bg-destructive/5"><XCircle aria-hidden="true" /><div><AlertTitle>Evaluation runs unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}
    {isLoading ? <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading evaluation history…</CardContent></Card> : null}
    {!isLoading && !error && !runs.length ? <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><FlaskConical className="text-primary" aria-hidden="true" /><p className="text-sm font-semibold">No evaluation runs yet</p><p className="max-w-lg text-sm text-muted-foreground">Run <code>pnpm eval</code> after configuring PostgreSQL, the analysis service, and an LLM provider.</p></CardContent></Card> : null}
    {selectedRuns.length === 2 ? <Comparison runs={selectedRuns} /> : null}
    {!isLoading && runs.length ? <div className="flex flex-col gap-3">{runs.map((run) => {
      const isSelected = selected.includes(run.id);
      return <Card key={run.id} className={isSelected ? "border-primary shadow-sm" : undefined}>
        <CardContent className="flex flex-col gap-4 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold">{run.model}</p><p className="mt-1 text-xs text-muted-foreground">{run.provider} · {run.modelRole} · {date(run.createdAt)}</p></div><div className="flex items-center gap-2"><Badge variant={run.qualityPassed ? "success" : "secondary"}>{percent(run.passRate)} passed</Badge><Button variant="outline" size="sm" onClick={() => toggleSelection(run.id)}>{isSelected ? "Selected" : "Compare"}</Button><Link className={buttonVariants({ size: "sm" })} href={`/evals/${run.id}`}>View run</Link></div></div><SuiteMetrics run={run} /></CardContent>
      </Card>;
    })}</div> : null}
  </section>;
}
