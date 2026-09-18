import { describe, expect, it } from "vitest";

import { referencedColumns, verifyAnswer, type VerifiableStep } from "./verifyAnswer.js";

const analysisStepId = "11111111-1111-4111-8111-111111111111";
const secondStepId = "22222222-2222-4222-8222-222222222222";
const inspectStepId = "33333333-3333-4333-8333-333333333333";

function analysisStep(id: string, output: unknown, status = "completed"): VerifiableStep {
  return { id, toolName: "analyze_dataset", status, output };
}

function inspectStep(columns: string[]): VerifiableStep {
  return { id: inspectStepId, toolName: "inspect_dataset", status: "completed", output: { columns: columns.map((name) => ({ name })) } };
}

describe("verifyAnswer", () => {
  it("traces each figure back to the tool step that produced it", () => {
    const verification = verifyAnswer({
      answer: "Search generated 42 in revenue from 7 orders.",
      steps: [
        analysisStep(analysisStepId, { rows: [{ channel: "Search", revenue: 42 }] }),
        analysisStep(secondStepId, { rows: [{ orders: 7 }] }),
      ],
    });

    expect(verification.status).toBe("verified");
    expect(verification.claims).toEqual([
      { text: "42", value: 42, supported: true, sourceStepId: analysisStepId },
      { text: "7", value: 7, supported: true, sourceStepId: secondStepId },
    ]);
  });

  it("flags a figure that appears in no tool result", () => {
    const verification = verifyAnswer({
      answer: "Revenue was 999.",
      steps: [analysisStep(analysisStepId, { rows: [{ revenue: 42 }] })],
    });

    expect(verification.status).toBe("unsupported");
    expect(verification.claims).toEqual([{ text: "999", value: 999, supported: false, sourceStepId: null }]);
  });

  it("reads comma-grouped numbers and percentages", () => {
    const verification = verifyAnswer({
      answer: "Revenue reached 1,234.50, which is 12.5% higher.",
      steps: [analysisStep(analysisStepId, { rows: [{ total: 1234.5, changePercent: 12.5 }] })],
    });

    expect(verification.status).toBe("verified");
    expect(verification.claims.map((claim) => claim.text)).toEqual(["1,234.50", "12.5%"]);
  });

  it("ignores values returned by a failed tool step", () => {
    const verification = verifyAnswer({
      answer: "Revenue was 42.",
      steps: [analysisStep(analysisStepId, { rows: [{ revenue: 42 }] }, "failed")],
    });

    expect(verification.status).toBe("unsupported");
    expect(verification.claims[0]?.supported).toBe(false);
  });

  it("flags a column that is absent from the inspected schema", () => {
    const verification = verifyAnswer({
      answer: "The column margin has missing values.",
      steps: [inspectStep(["revenue", "channel"])],
    });

    expect(verification.status).toBe("unsupported");
    expect(verification.unsupportedColumns).toEqual(["margin"]);
  });

  it("does not judge columns when no schema was inspected", () => {
    const verification = verifyAnswer({
      answer: "The column margin is high.",
      steps: [analysisStep(analysisStepId, { rows: [] })],
    });

    expect(verification.status).toBe("not_applicable");
    expect(verification.unsupportedColumns).toEqual([]);
  });

  it("reports nothing to verify when the answer makes no checkable claim", () => {
    const verification = verifyAnswer({
      answer: "The dataset looks internally consistent.",
      steps: [inspectStep(["revenue"])],
    });

    expect(verification.status).toBe("not_applicable");
    expect(verification.claims).toEqual([]);
  });
});

describe("referencedColumns", () => {
  it("stops an unquoted name at the first non-word character", () => {
    expect(referencedColumns("The column revenue has missing values.")).toEqual(["revenue"]);
  });

  it("keeps a quoted name with spaces intact", () => {
    expect(referencedColumns('The column "unit price" is numeric.')).toEqual(["unit price"]);
  });
});
