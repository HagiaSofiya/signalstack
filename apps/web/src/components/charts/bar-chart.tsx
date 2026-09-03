"use client";

import type { ChartSpec } from "@signalstack/schemas";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartColors, formatChartValue } from "./chart-helpers";

export function BarChart({ spec }: { spec: ChartSpec }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsBarChart data={spec.data} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey={spec.xKey} tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatChartValue} />
        <Tooltip formatter={(value) => formatChartValue(value)} />
        {spec.series.length > 1 ? <Legend /> : null}
        {spec.series.map((series, index) => <Bar key={series.key} dataKey={series.key} name={series.label} fill={chartColors[index % chartColors.length]} radius={[6, 6, 0, 0]} />)}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
