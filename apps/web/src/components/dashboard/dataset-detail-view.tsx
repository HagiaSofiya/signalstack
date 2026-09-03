import { CheckCircle2, Database, FileSpreadsheet, Rows3 } from "lucide-react";
import Link from "next/link";
import type { DatasetDetail } from "@signalstack/schemas";

import { AskDataPanel } from "@/components/dashboard/ask-data-panel";
import { RunHistory } from "@/components/dashboard/run-history";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DatasetDetailView({ dataset }: { dataset: DatasetDetail }) {
  const inspection = dataset.inspection;
  if (!inspection) return null;

  return (
    <section className="flex flex-col gap-5" aria-label="Dataset inspection result">
      <Alert className="border-accent bg-accent/50">
        <CheckCircle2 aria-hidden="true" />
        <div><AlertTitle>Dataset successfully uploaded</AlertTitle><AlertDescription>{dataset.filename} is ready to explore. The analysis service found {inspection.rowCount.toLocaleString()} rows across {inspection.columnCount} columns. <Link href={`/datasets/${dataset.id}`} className="font-medium text-primary underline-offset-4 hover:underline">Open full detail view</Link></AlertDescription></div>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-5"><FileSpreadsheet aria-hidden="true" className="text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Filename</p><p className="truncate text-sm font-semibold">{dataset.filename}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><Rows3 aria-hidden="true" className="text-primary" /><div><p className="text-xs text-muted-foreground">Rows</p><p className="text-sm font-semibold">{inspection.rowCount.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><Database aria-hidden="true" className="text-primary" /><div><p className="text-xs text-muted-foreground">Columns</p><p className="text-sm font-semibold">{inspection.columnCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-5"><CheckCircle2 aria-hidden="true" className="text-primary" /><div><p className="text-xs text-muted-foreground">Uploaded</p><p className="text-sm font-semibold">{formatDate(dataset.createdAt)}</p></div></CardContent></Card>
      </div>

      <AskDataPanel datasetId={dataset.id} />
      <RunHistory datasetId={dataset.id} />

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader><CardTitle>Schema</CardTitle><CardDescription>Inferred from the uploaded values.</CardDescription></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Column</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Missing</TableHead><TableHead className="text-right">Unique</TableHead></TableRow></TableHeader>
              <TableBody>
                {inspection.columns.map((column) => (
                  <TableRow key={column.name}><TableCell className="max-w-32 truncate font-medium">{column.name}</TableCell><TableCell><Badge variant="secondary">{column.type}</Badge></TableCell><TableCell className="text-right text-muted-foreground">{column.missingCount.toLocaleString()}</TableCell><TableCell className="text-right text-muted-foreground">{column.uniqueCount.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>First 10 rows</CardTitle><CardDescription>A quick look at the data that will be available to the agent.</CardDescription></CardHeader>
          <CardContent className="p-0">
            {inspection.preview.length ? (
              <Table>
                <TableHeader><TableRow>{inspection.columns.map((column) => <TableHead key={column.name} className="whitespace-nowrap">{column.name}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{inspection.preview.map((row, index) => <TableRow key={index}>{inspection.columns.map((column) => <TableCell key={column.name} className="max-w-48 truncate whitespace-nowrap">{formatValue(row[column.name])}</TableCell>)}</TableRow>)}</TableBody>
              </Table>
            ) : <div className="p-6 text-sm text-muted-foreground">This CSV has headers but no data rows.</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
