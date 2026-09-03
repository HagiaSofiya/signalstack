import { Hono } from "hono";
import { createAgentRunSchema, agentRunStatusSchema } from "@signalstack/schemas";
import { z } from "zod";

import { findAgentRunWithSteps } from "@signalstack/db";
import { store } from "../lib/store.js";
import { reconstructAgentRunResult } from "../lib/agent-run-result.js";

export const agentRunRoutes = new Hono()
  .get("/", (c) => c.json({ data: store.listAgentRuns(c.req.query("projectId")) }))
  .post("/", async (c) => {
    const parsed = createAgentRunSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json({ data: store.createAgentRun(parsed.data) }, 201);
  })
  .get("/:agentRunId/steps", async (c) => {
    const agentRunId = c.req.param("agentRunId");
    if (!z.string().uuid().safeParse(agentRunId).success) return c.json({ error: "agentRunId must be a valid UUID" }, 400);
    try {
      const persisted = await findAgentRunWithSteps(agentRunId);
      if (persisted) return c.json({ data: persisted.steps });
    } catch (error) {
      console.error("Agent steps could not be loaded", error);
      return c.json({ error: "Agent steps could not be loaded" }, 503);
    }
    return c.json({ data: store.listAgentSteps(agentRunId) });
  })
  .get("/:agentRunId", async (c) => {
    const agentRunId = c.req.param("agentRunId");
    if (!z.string().uuid().safeParse(agentRunId).success) return c.json({ error: "agentRunId must be a valid UUID" }, 400);
    const datasetId = c.req.query("datasetId");
    if (datasetId !== undefined && !z.string().uuid().safeParse(datasetId).success) return c.json({ error: "datasetId must be a valid UUID" }, 400);
    const projectId = c.req.query("projectId");
    if (projectId !== undefined && !z.string().uuid().safeParse(projectId).success) return c.json({ error: "projectId must be a valid UUID" }, 400);
    try {
      const persisted = await findAgentRunWithSteps(agentRunId);
      if (persisted) {
        if (datasetId !== undefined && persisted.run.datasetId !== datasetId) return c.json({ error: "Agent run not found" }, 404);
        if (projectId !== undefined && persisted.run.projectId !== projectId) return c.json({ error: "Agent run not found" }, 404);
        return c.json({ data: reconstructAgentRunResult(persisted) });
      }
    } catch (error) {
      console.error("Agent run could not be loaded", error);
      return c.json({ error: "Agent run could not be loaded" }, 503);
    }
    return c.json({ error: "Agent run not found" }, 404);
  })
  .patch("/:agentRunId", async (c) => {
    const parsed = z.object({
      model: z.string().nullable().optional(),
      status: agentRunStatusSchema.optional(),
      tokenUsage: z.number().int().nonnegative().nullable().optional(),
      estimatedCost: z.number().nonnegative().nullable().optional(),
    }).safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const run = store.updateAgentRun(c.req.param("agentRunId"), parsed.data);
    return run ? c.json({ data: run }) : c.json({ error: "Agent run not found" }, 404);
  })
  .delete("/:agentRunId", (c) => {
    const deleted = store.deleteAgentRun(c.req.param("agentRunId"));
    return deleted ? c.body(null, 204) : c.json({ error: "Agent run not found" }, 404);
  });
