import { listProjectAgentRuns } from "@signalstack/db";
import { Hono } from "hono";
import { z } from "zod";

const projectRunQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(5) });

export const projectRunRoutes = new Hono().get("/:projectId/runs", async (c) => {
  const projectId = c.req.param("projectId");
  if (!z.string().uuid().safeParse(projectId).success) return c.json({ error: "projectId must be a valid UUID" }, 400);
  const query = projectRunQuerySchema.safeParse(c.req.query());
  if (!query.success) return c.json({ error: query.error.flatten() }, 400);

  try {
    return c.json({ data: await listProjectAgentRuns({ projectId, limit: query.data.limit }) });
  } catch (error) {
    console.error("Project run history could not be loaded", error);
    return c.json({ error: "Project run history could not be loaded" }, 503);
  }
});
