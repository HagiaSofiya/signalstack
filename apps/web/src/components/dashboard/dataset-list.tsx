import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet } from "lucide-react";
import type { DatasetDetail } from "@signalstack/schemas";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function describe(dataset: DatasetDetail) {
  const rows = dataset.rowCount === null ? "Not inspected" : `${dataset.rowCount.toLocaleString()} rows`;
  const added = new Date(dataset.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${rows} · Added ${added}`;
}

export function DatasetList({ datasets }: { datasets: DatasetDetail[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Recent datasets</CardTitle>
          <CardDescription>The latest files added to this project.</CardDescription>
        </div>
        <Button variant="ghost" size="sm">View all <ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {datasets.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No datasets yet. Upload a CSV to get started.
          </p>
        ) : null}
        {datasets.map((dataset) => (
          <Link key={dataset.id} href={`/datasets/${dataset.id}`} className="flex items-center gap-3 rounded-xl border bg-background p-3.5 transition-colors hover:bg-secondary/40">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <FileSpreadsheet aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{dataset.filename}</p>
              <p className="text-xs text-muted-foreground">{describe(dataset)}</p>
            </div>
            <Badge variant="outline">CSV</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
