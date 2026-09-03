"use client";

import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import type { DatasetDetail } from "@signalstack/schemas";

import { DatasetDetailView } from "@/components/dashboard/dataset-detail-view";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { getDataset } from "@/lib/api-client";

export default function DatasetDetailPage() {
  const params = useParams<{ datasetId: string }>();
  const datasetId = params.datasetId;
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    void getDataset(datasetId)
      .then((value) => {
        if (active) setDataset(value);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "The dataset could not be loaded");
      });
    return () => {
      active = false;
    };
  }, [datasetId]);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:block"><AppSidebar /></div>
      <main className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b bg-card px-6 py-4 lg:px-10">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles aria-hidden="true" /></div>
          <div><p className="text-xs font-medium text-muted-foreground">Datasets / Detail</p><p className="mt-0.5 text-sm font-semibold">Dataset workspace</p></div>
        </header>
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
          {error ? <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle aria-hidden="true" /><div><AlertTitle>Dataset could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}
          {!dataset && !error ? <Card><CardContent className="flex items-center gap-3 p-8 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading dataset inspection…</CardContent></Card> : null}
          {dataset ? <DatasetDetailView dataset={dataset} /> : null}
        </div>
      </main>
    </div>
  );
}
