"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AgentRunResult } from "@signalstack/schemas";

import { AgentRunDetail } from "@/components/dashboard/agent-run-detail";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAgentRun } from "@/lib/api-client";

export default function HistoricalAgentRunPage() {
  const params = useParams<{ datasetId: string; runId: string }>();
  const datasetId = params.datasetId;
  const runId = params.runId;
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    void getAgentRun(runId, datasetId).then((nextResult) => {
      if (active) setResult(nextResult);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Agent run could not be loaded");
    });
    return () => { active = false; };
  }, [datasetId, runId]);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:block"><AppSidebar /></div>
      <main className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b bg-card px-6 py-4 lg:px-10">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles aria-hidden="true" /></div>
          <div><p className="text-xs font-medium text-muted-foreground">Datasets / Run history</p><p className="mt-0.5 text-sm font-semibold">Agent run detail</p></div>
        </header>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10 lg:py-10">
          <Link href={`/datasets/${datasetId}`} className={`${buttonVariants({ variant: "ghost" })} -ml-3 w-fit`}><ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back to dataset</Link>
          {error ? <Alert className="border-destructive/30 bg-destructive/5"><AlertTitle>Run unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          {!error && !result ? <Card><CardContent className="flex items-center gap-3 p-10 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading historical run…</CardContent></Card> : null}
          {result ? <AgentRunDetail result={result} /> : null}
        </div>
      </main>
    </div>
  );
}
