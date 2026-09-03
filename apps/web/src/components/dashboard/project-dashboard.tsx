"use client";

import { Activity, Database, FileStack, Plus, Sparkles } from "lucide-react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AgentRunsList } from "@/components/dashboard/agent-runs-list";
import { DatasetDetailView } from "@/components/dashboard/dataset-detail-view";
import { DatasetUpload } from "@/components/dashboard/dataset-upload";
import { DatasetList } from "@/components/dashboard/dataset-list";
import {
  DEMO_PROJECT_ID,
  recentAgentRuns,
  recentDatasets,
} from "@/components/dashboard/dashboard-data";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { DatasetDetail } from "@signalstack/schemas";
import { useState } from "react";

export function ProjectDashboard() {
  const [uploadedDataset, setUploadedDataset] = useState<DatasetDetail | null>(
    null,
  );

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:block">
        <AppSidebar />
      </div>
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b bg-card px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Sparkles aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Projects / Acme
              </p>
              <p className="mt-0.5 text-sm font-semibold">Revenue workspace</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Plus data-icon="inline-start" aria-hidden="true" /> New project
          </Button>
        </header>

        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
          <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <span className="size-2 rounded-full bg-primary" /> Active
                project
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Acme revenue
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Understand what is moving your business. Upload a dataset, then
                let your agent turn it into a clear next step.
              </p>
            </div>
            <Button size="lg">
              <Sparkles data-icon="inline-start" aria-hidden="true" /> Ask your
              data
            </Button>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Datasets"
              value="12"
              detail="3 added this month"
              icon={Database}
            />
            <StatCard
              label="Rows analyzed"
              value="84.2k"
              detail="Across all datasets"
              icon={FileStack}
            />
            <StatCard
              label="Agent runs"
              value="28"
              detail="91% completed"
              icon={Activity}
            />
          </div>

          <Separator />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <DatasetUpload
              projectId={DEMO_PROJECT_ID}
              onUploaded={setUploadedDataset}
            />
            <div className="flex flex-col justify-between rounded-2xl bg-primary p-7 text-primary-foreground shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <Sparkles aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-xl font-semibold tracking-tight">
                    Your data, in focus.
                  </h2>
                  <p className="max-w-sm text-sm leading-6 text-primary-foreground/75">
                    The agent will inspect your files, explain the important
                    patterns, and show its work as it goes.
                  </p>
                </div>
              </div>
              <div className="mt-10 flex items-center gap-2 text-xs font-medium text-primary-foreground/75">
                <span className="size-2 rounded-full bg-primary-foreground" />{" "}
                Agent workspace ready
              </div>
            </div>
          </div>

          {uploadedDataset ? (
            <DatasetDetailView dataset={uploadedDataset} />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <DatasetList datasets={recentDatasets} />
            <AgentRunsList runs={recentAgentRuns} />
          </div>
        </div>
      </main>
    </div>
  );
}
