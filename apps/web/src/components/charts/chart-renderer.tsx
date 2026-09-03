"use client";

import type { ChartSpec } from "@signalstack/schemas";

import { AreaChart } from "./area-chart";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";
import { ScatterChart } from "./scatter-chart";

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  if (spec.type === "bar") return <BarChart spec={spec} />;
  if (spec.type === "line") return <LineChart spec={spec} />;
  if (spec.type === "area") return <AreaChart spec={spec} />;
  return <ScatterChart spec={spec} />;
}
