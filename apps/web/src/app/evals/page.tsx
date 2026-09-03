import { FlaskConical, Sparkles } from "lucide-react";

import { EvalSuiteList } from "@/components/evals/eval-suite-list";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function EvalsPage() {
  return <div className="flex min-h-screen bg-background"><div className="hidden shrink-0 lg:block"><AppSidebar /></div><main className="min-w-0 flex-1"><header className="flex items-center gap-3 border-b bg-card px-6 py-4 lg:px-10"><div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles aria-hidden="true" /></div><div><p className="text-xs font-medium text-muted-foreground">Internal tools</p><p className="mt-0.5 text-sm font-semibold">Agent evaluations</p></div></header><div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10"><div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><FlaskConical aria-hidden="true" /></div><div><h1 className="text-3xl font-semibold tracking-tight">Evaluation suite</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Measure tool selection, deterministic correctness, grounding, hallucination resistance, and chart behavior across real agent runs.</p></div></div><EvalSuiteList /></div></main></div>;
}
