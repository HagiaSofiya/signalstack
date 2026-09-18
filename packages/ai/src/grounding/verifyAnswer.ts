import type { AnswerVerification, VerifiedClaim } from "@signalstack/schemas";

export type VerifiableStep = {
  id: string;
  toolName: string | null;
  status: string;
  output: unknown;
};

const numberPattern = /-?\b\d[\d,]*(?:\.\d+)?%?/g;
const columnPattern = /(?:column|field)\s+(?:"([^"\n]+)"|'([^'\n]+)'|`([^`\n]+)`|([A-Za-z_]\w*))/gi;

/**
 * Checks an answer against the tool results it was supposed to come from. Every numeric claim is
 * matched to the completed tool step whose output contains that value, and every referenced column
 * is matched against the inspected schema. Nothing here calls a model: the answer is only compared
 * with structured results the agent already produced.
 */
export function verifyAnswer(input: { answer: string; steps: VerifiableStep[] }): AnswerVerification {
  const completedToolSteps = input.steps.filter((step) => step.toolName !== null && step.status === "completed");
  const observed = completedToolSteps.map((step) => ({ id: step.id, values: collectNumbers(step.output) }));
  const claims: VerifiedClaim[] = extractClaims(input.answer).map((claim) => {
    const source = observed.find((step) => step.values.some((value) => withinTolerance(value, claim.value)));
    return { text: claim.text, value: claim.value, supported: source !== undefined, sourceStepId: source?.id ?? null };
  });

  const knownColumns = new Set(completedToolSteps.flatMap((step) => inspectedColumns(step.output)));
  const referenced = knownColumns.size === 0 ? [] : referencedColumns(input.answer);
  const unsupportedColumns = [...new Set(referenced.filter((column) => !knownColumns.has(column)))];

  const unsupported = claims.some((claim) => !claim.supported) || unsupportedColumns.length > 0;
  const checkedSomething = claims.length > 0 || referenced.length > 0;
  return {
    status: unsupported ? "unsupported" : checkedSomething ? "verified" : "not_applicable",
    claims,
    unsupportedColumns,
  };
}

export function extractClaims(answer: string): Array<{ text: string; value: number }> {
  return [...answer.matchAll(numberPattern)]
    // A trailing comma is sentence punctuation, not part of the number, but the pattern has to
    // allow inner commas to read grouped figures like 1,234.
    .map((match) => match[0].replace(/,+$/, ""))
    .map((text) => ({ text, value: Number(text.replaceAll(",", "").replace("%", "")) }))
    .filter((claim) => Number.isFinite(claim.value));
}

/**
 * Reads column names the answer refers to. A quoted name is taken whole so names with spaces
 * survive; an unquoted name stops at the first non-word character, so ordinary prose after the
 * name ("the column revenue has missing values") is not mistaken for part of it.
 */
export function referencedColumns(answer: string): string[] {
  return [...answer.matchAll(columnPattern)]
    .map((match) => (match[1] ?? match[2] ?? match[3] ?? match[4])?.trim())
    .filter((value): value is string => Boolean(value));
}

export function inspectedColumns(output: unknown): string[] {
  const record = asRecord(output);
  if (!record || !Array.isArray(record.columns)) return [];
  return record.columns.flatMap((column) => {
    const item = asRecord(column);
    return typeof item?.name === "string" ? [item.name] : [];
  });
}

function collectNumbers(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(collectNumbers);
  const record = asRecord(value);
  if (!record) return typeof value === "number" ? [value] : [];
  return Object.values(record).flatMap(collectNumbers);
}

function withinTolerance(observed: number, claimed: number) {
  return Math.abs(observed - claimed) <= Math.max(0.01, Math.abs(claimed) * 0.01);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
