"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronsUpDown,
  Database,
  FolderKanban,
  FlaskConical,
  LayoutDashboard,
  Settings2,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Datasets", href: "/datasets", icon: Database },
  { label: "Agent runs", href: "/agent-runs", icon: Activity },
  { label: "Evaluations", href: "/evals", icon: FlaskConical },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-full max-w-64 flex-col border-r bg-card px-4 py-5">
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">SignalStack</p>
          <p className="text-xs text-muted-foreground">AI analytics</p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-card text-xs font-semibold text-primary">
            AC
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">Acme</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Revenue workspace
            </p>
          </div>
        </div>
        <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
      </div>

      <div className="mt-8 flex flex-1 flex-col">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </p>
        <nav
          className="mt-3 flex flex-col gap-1"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <Separator className="mb-4" />
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Settings2 aria-hidden="true" />
            Settings
          </Link>
          <div className="mt-5 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              AD
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Admin</p>
              <p className="truncate text-[11px] text-muted-foreground">
                admin@acme.co
              </p>
            </div>
            <BarChart3 aria-hidden="true" className="text-muted-foreground" />
          </div>
        </div>
      </div>
    </aside>
  );
}
