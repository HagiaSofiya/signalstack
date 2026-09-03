"use client";

import type { ChartSpec } from "@signalstack/schemas";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartColors, formatChartValue } from "./chart-helpers";

export function LineChart({ spec }: { spec: ChartSpec }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsLineChart data={spec.data} margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey={spec.xKey} tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatChartValue} />
        <Tooltip formatter={(value) => formatChartValue(value)} />
        {spec.series.length > 1 ? <Legend /> : null}
        {spec.series.map((series, index) => <Line key={series.key} type="monotone" dataKey={series.key} name={series.label} stroke={chartColors[index % chartColors.length]} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
