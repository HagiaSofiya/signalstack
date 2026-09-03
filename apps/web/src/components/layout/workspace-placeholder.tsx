import { AppSidebar } from "@/components/layout/app-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspacePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:block"><AppSidebar /></div>
      <main className="min-w-0 flex-1">
        <header className="border-b bg-card px-6 py-5 lg:px-10"><p className="text-sm font-semibold">{title}</p></header>
        <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
          <Card>
            <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">This workspace is scaffolded and ready for the next product slice.</p></CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
