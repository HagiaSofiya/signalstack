export type EvalCliArgs = { smoke: boolean; baseline?: string };

export function parseEvalArgs(args: string[]): EvalCliArgs {
  const smoke = args.includes("--smoke");
  const baselineIndex = args.indexOf("--baseline");
  const baseline = baselineIndex >= 0 ? args[baselineIndex + 1] : undefined;
  const unexpected = args.filter((arg, index) => arg !== "--smoke" && arg !== "--baseline" && index !== baselineIndex + 1);
  if (unexpected.length || (baselineIndex >= 0 && !baseline)) {
    throw new Error("Usage: pnpm eval [--smoke] [--baseline latest|<eval-run-id>]");
  }
  return { smoke, baseline };
}

export function qualityExitCode(passed: boolean) { return passed ? 0 : 1; }
export const infrastructureExitCode = 2;
