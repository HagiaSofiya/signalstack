import { findEvalSuiteRunWithCases, listEvalSuiteRuns } from "@signalstack/db";
import { Hono } from "hono";
import { z } from "zod";

const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const evalRoutes = new Hono()
  .get("/", async (c) => {
    const result = limitSchema.safeParse(c.req.query("limit") ?? 20);
    if (!result.success) return c.json({ error: result.error.flatten() }, 400);
    try {
      return c.json({ data: await listEvalSuiteRuns(result.data) });
    } catch (error) {
      console.error("Evaluation runs could not be loaded", error);
      return c.json({ error: "Evaluation runs could not be loaded" }, 503);
    }
  })
  .get("/:evalRunId", async (c) => {
    const evalRunId = c.req.param("evalRunId");
    if (!z.string().uuid().safeParse(evalRunId).success) return c.json({ error: "evalRunId must be a valid UUID" }, 400);
    try {
      const result = await findEvalSuiteRunWithCases(evalRunId);
      return result ? c.json({ data: result }) : c.json({ error: "Evaluation run not found" }, 404);
    } catch (error) {
      console.error("Evaluation run could not be loaded", error);
      return c.json({ error: "Evaluation run could not be loaded" }, 503);
    }
  });
