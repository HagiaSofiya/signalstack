import { ArrowUpRight, CheckCircle2, Clock3, LoaderCircle, MessageSquareText } from "lucide-react";

import type { AgentRunItem } from "./dashboard-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusIcons = {
  Completed: CheckCircle2,
  "In progress": LoaderCircle,
  Queued: Clock3,
};

export function AgentRunsList({ runs }: { runs: AgentRunItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Recent agent runs</CardTitle>
          <CardDescription>Questions asked across your project data.</CardDescription>
        </div>
        <Button variant="ghost" size="sm">View all <ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {runs.map((run) => {
          const StatusIcon = statusIcons[run.status];
          return (
            <div key={run.id} className="flex items-center gap-3 rounded-xl border bg-background p-3.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <MessageSquareText aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{run.question}</p>
                <p className="text-xs text-muted-foreground">{run.time} · {run.duration}</p>
              </div>
              <Badge variant={run.status === "Completed" ? "success" : "secondary"}>
                <StatusIcon aria-hidden="true" />
                {run.status}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
