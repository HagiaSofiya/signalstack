export const chartColors = [
  "var(--primary)",
  "var(--accent-foreground)",
  "var(--foreground)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

export function formatChartValue(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "—");
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}
