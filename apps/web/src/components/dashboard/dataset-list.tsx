import { ArrowUpRight, FileSpreadsheet } from "lucide-react";

import type { DatasetItem } from "./dashboard-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DatasetList({ datasets }: { datasets: DatasetItem[] }) {
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
        {datasets.map((dataset) => (
          <div key={dataset.id} className="flex items-center gap-3 rounded-xl border bg-background p-3.5 transition-colors hover:bg-secondary/40">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <FileSpreadsheet aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{dataset.filename}</p>
              <p className="text-xs text-muted-foreground">{dataset.rows} · {dataset.updated}</p>
            </div>
            <Badge variant="outline">{dataset.kind}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
