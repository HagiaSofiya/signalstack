"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, LoaderCircle, Sparkles } from "lucide-react";
import type { ProjectAgentRuns } from "@signalstack/schemas";

import { AgentRunRow } from "@/components/dashboard/agent-runs-list";
import { DEMO_PROJECT_ID } from "@/components/dashboard/dashboard-data";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectRuns } from "@/lib/api-client";

const RUN_LIMIT = 50;

function describe(runs: ProjectAgentRuns) {
  const shown = runs.items.length === runs.total ? `${runs.total} run${runs.total === 1 ? "" : "s"}` : `The ${runs.items.length} most recent of ${runs.total} runs`;
  return `${shown} · ${runs.completedCount} completed.`;
}

export default function AgentRunsPage() {
  const [runs, setRuns] = useState<ProjectAgentRuns | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getProjectRuns(DEMO_PROJECT_ID, RUN_LIMIT)
      .then((value) => {
        if (active) setRuns(value);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Agent runs could not be loaded");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:block"><AppSidebar /></div>
      <main className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b bg-card px-6 py-4 lg:px-10">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles aria-hidden="true" /></div>
          <div><p className="text-xs font-medium text-muted-foreground">Projects / Acme</p><p className="mt-0.5 text-sm font-semibold">Agent runs</p></div>
        </header>
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Activity aria-hidden="true" /></div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Agent runs</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Every question asked across this project&apos;s datasets. Open a run to read the answer and the tool steps behind it.</p>
            </div>
          </div>

          {error ? <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle aria-hidden="true" /><div><AlertTitle>Agent runs could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}
          {!runs && !error ? <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading agent runs…</CardContent></Card> : null}
          {runs ? (
            <Card>
              <CardHeader>
                <CardTitle>All agent runs</CardTitle>
                <CardDescription>{describe(runs)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {runs.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No agent runs yet. Ask a question about a dataset to get started.
                  </p>
                ) : null}
                {runs.items.map((run) => <AgentRunRow key={run.id} run={run} />)}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
