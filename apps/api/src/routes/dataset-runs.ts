import { getDb, listAgentRunSummaries } from "@signalstack/db";
import { agentRunStatusSchema } from "@signalstack/schemas";
import { Hono } from "hono";
import { z } from "zod";

const runListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
  status: agentRunStatusSchema.optional(),
});

export const datasetRunRoutes = new Hono().get("/:datasetId/runs", async (c) => {
  const datasetId = c.req.param("datasetId");
  if (!z.string().uuid().safeParse(datasetId).success) return c.json({ error: "datasetId must be a valid UUID" }, 400);
  const query = runListQuerySchema.safeParse(c.req.query());
  if (!query.success) return c.json({ error: query.error.flatten() }, 400);

  try {
    const dataset = await getDb().dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
    if (!dataset) return c.json({ error: "Dataset not found" }, 404);
    const data = await listAgentRunSummaries({ datasetId, ...query.data });
    return c.json({ data });
  } catch (error) {
    console.error("Dataset run history could not be loaded", error);
    return c.json({ error: "Dataset run history could not be loaded" }, 503);
  }
});
