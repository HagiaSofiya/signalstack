"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, MessageSquareText, Sparkles } from "lucide-react";
import type { AgentRunResult } from "@signalstack/schemas";

import { askDataset } from "@/lib/api-client";
import { AgentRunDetail } from "@/components/dashboard/agent-run-detail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const exampleQuestions = [
  "Which category generates the most revenue?",
  "Show the top five customers by spend",
  "How did July compare with August?",
  "What metrics appear related to conversions?",
];

export function AskDataPanel({ datasetId }: { datasetId: string }) {
  const [question, setQuestion] = useState("What columns are in this dataset and which ones have missing data?");
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await askDataset(datasetId, question.trim()));
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "The agent run failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Ask your data">
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="border-b bg-primary/[0.04]">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles aria-hidden="true" /></div>
            <div className="flex flex-col gap-1.5"><CardTitle>Ask your data</CardTitle><CardDescription>Ask a question and the agent will inspect this dataset before answering.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dataset-question">Your question</Label>
              <Textarea id="dataset-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Which columns contain missing values?" disabled={isLoading} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Try an example</p>
              <div className="flex flex-wrap gap-2">
                {exampleQuestions.map((example) => <Button key={example} type="button" variant="outline" size="sm" onClick={() => setQuestion(example)} disabled={isLoading}>{example}</Button>)}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquareText aria-hidden="true" /> The agent can inspect and calculate from this dataset.</p>
              <Button type="submit" disabled={isLoading || !question.trim()}>{isLoading ? <><LoaderCircle data-icon="inline-start" aria-hidden="true" className="animate-spin" /> Running agent</> : <><Sparkles data-icon="inline-start" aria-hidden="true" /> Ask your data</>}</Button>
            </div>
          </form>
          {error ? <Alert className="mt-5 border-destructive/30 bg-destructive/5"><div><AlertTitle>Agent run could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}
        </CardContent>
      </Card>
      {result ? <AgentRunDetail result={result} /> : null}
    </section>
  );
}
