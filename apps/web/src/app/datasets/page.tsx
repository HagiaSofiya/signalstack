"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Database, LoaderCircle, Sparkles } from "lucide-react";
import type { DatasetDetail } from "@signalstack/schemas";

import { DatasetRow } from "@/components/dashboard/dataset-list";
import { DEMO_PROJECT_ID } from "@/components/dashboard/dashboard-data";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDatasets } from "@/lib/api-client";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listDatasets(DEMO_PROJECT_ID)
      .then((value) => {
        if (active) setDatasets(value);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Datasets could not be loaded");
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
          <div><p className="text-xs font-medium text-muted-foreground">Projects / Acme</p><p className="mt-0.5 text-sm font-semibold">Datasets</p></div>
        </header>
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Database aria-hidden="true" /></div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Datasets</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Every file connected to this project. Open one to inspect its columns and ask the agent a question about it.</p>
            </div>
          </div>

          {error ? <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle aria-hidden="true" /><div><AlertTitle>Datasets could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}
          {!datasets && !error ? <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading datasets…</CardContent></Card> : null}
          {datasets ? (
            <Card>
              <CardHeader>
                <CardTitle>All datasets</CardTitle>
                <CardDescription>{datasets.length === 1 ? "1 dataset" : `${datasets.length} datasets`} in this project.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {datasets.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No datasets yet. Upload a CSV from the project overview to get started.
                  </p>
                ) : null}
                {datasets.map((dataset) => <DatasetRow key={dataset.id} dataset={dataset} />)}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
