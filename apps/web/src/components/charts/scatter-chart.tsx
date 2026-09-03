"use client";

import type { ChartSpec } from "@signalstack/schemas";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartColors, formatChartValue } from "./chart-helpers";

export function ScatterChart({ spec }: { spec: ChartSpec }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsScatterChart margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
        <XAxis dataKey="x" name={spec.xKey} type="number" tickLine={false} axisLine={false} tickFormatter={formatChartValue} />
        <YAxis dataKey="y" name={spec.series[0]?.label ?? "Value"} type="number" tickLine={false} axisLine={false} tickFormatter={formatChartValue} />
        <Tooltip cursor={{ strokeDasharray: "4 4" }} formatter={(value) => formatChartValue(value)} />
        {spec.series.map((series, index) => (
          <Scatter key={series.key} name={series.label} fill={chartColors[index % chartColors.length]} data={spec.data.map((row) => ({ x: row[spec.xKey], y: row[series.key] }))} />
        ))}
      </RechartsScatterChart>
    </ResponsiveContainer>
  );
}
