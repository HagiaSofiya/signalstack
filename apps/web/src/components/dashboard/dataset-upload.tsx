"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload, X } from "lucide-react";
import type { DatasetDetail } from "@signalstack/schemas";

import { uploadDataset } from "@/lib/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type UploadState = "idle" | "uploading" | "analyzing" | "error";

export function DatasetUpload({ projectId, onUploaded }: { projectId: string; onUploaded: (dataset: DatasetDetail) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isBusy = state === "uploading" || state === "analyzing";

  function clearSelection() {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectFile(file?: File) {
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      clearSelection();
      setError("Only CSV files are supported. Choose a file ending in .csv.");
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile || isBusy) return;
    setError(null);
    setProgress(0);
    setState("uploading");

    try {
      const dataset = await uploadDataset(projectId, selectedFile, (value) => {
        setProgress(value);
        if (value === 100) setState("analyzing");
      });
      onUploaded(dataset);
      clearSelection();
      setState("idle");
    } catch (uploadError) {
      setState("error");
      setError(uploadError instanceof Error ? uploadError.message : "The dataset upload failed. Try again.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between border-b bg-secondary/40">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Add a dataset</CardTitle>
          <CardDescription>Upload a CSV and we will map its shape for you.</CardDescription>
        </div>
        <Badge variant="outline">CSV only</Badge>
      </CardHeader>
      <CardContent className="p-6">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            selectFile(event.dataTransfer.files[0]);
          }}
          className="group flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 py-8 text-center transition-colors hover:border-primary hover:bg-secondary/40 disabled:cursor-wait disabled:opacity-60"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary transition-transform group-hover:-translate-y-0.5">
            {isBusy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
          </div>
          <p className="mt-4 text-sm font-semibold">Drop your CSV here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">We inspect the first 10 rows and infer the schema</p>
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />

        {selectedFile ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg border bg-secondary/40 p-3">
            <FileSpreadsheet aria-hidden="true" className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to inspect</p>
            </div>
            {!isBusy ? <Button type="button" variant="ghost" size="icon" onClick={clearSelection} aria-label="Remove selected file"><X aria-hidden="true" /></Button> : null}
          </div>
        ) : null}

        {selectedFile && !isBusy ? <Button className="mt-4 w-full" onClick={handleUpload}>{state === "error" ? "Try upload again" : "Upload and inspect"}</Button> : null}
        {isBusy ? (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-medium"><span>{state === "uploading" ? "Uploading dataset" : "Inspecting columns and rows"}</span><span>{progress}%</span></div>
            <Progress value={progress} />
          </div>
        ) : null}
        {error ? <Alert className="mt-4 border-destructive/30 bg-destructive/5"><AlertCircle aria-hidden="true" /><div><AlertTitle>Upload could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}
        {state === "analyzing" ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 aria-hidden="true" /> File uploaded. Finalizing inspection…</p> : null}
      </CardContent>
    </Card>
  );
}
