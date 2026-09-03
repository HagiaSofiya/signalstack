"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { EvalSuiteDetail } from "@/components/evals/eval-suite-detail";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getEvalSuiteRun } from "@/lib/api-client";

export default function EvalRunPage() {
  const params = useParams<{ evalRunId: string }>();
  const [run, setRun] = useState<Awaited<ReturnType<typeof getEvalSuiteRun>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getEvalSuiteRun(params.evalRunId).then((value) => { if (active) setRun(value); }).catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Evaluation run could not be loaded"); });
    return () => { active = false; };
  }, [params.evalRunId]);

  return <div className="flex min-h-screen bg-background"><div className="hidden shrink-0 lg:block"><AppSidebar /></div><main className="min-w-0 flex-1"><header className="flex items-center gap-3 border-b bg-card px-6 py-4 lg:px-10"><div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles aria-hidden="true" /></div><div><p className="text-xs font-medium text-muted-foreground">Internal tools / Evaluations</p><p className="mt-0.5 text-sm font-semibold">Evaluation run detail</p></div></header><div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10 lg:py-10"><Link href="/evals" className={`${buttonVariants({ variant: "ghost" })} -ml-3 w-fit`}><ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back to evaluations</Link>{error ? <Alert className="border-destructive/30 bg-destructive/5"><AlertTitle>Evaluation unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}{!error && !run ? <Card><CardContent className="flex items-center gap-3 p-10 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading evaluation run…</CardContent></Card> : null}{run ? <EvalSuiteDetail run={run} /> : null}</div></main></div>;
}
