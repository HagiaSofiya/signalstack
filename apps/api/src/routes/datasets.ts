import { Hono } from "hono";
import { createDatasetSchema } from "@signalstack/schemas";
import { findDatasetDetail, persistDataset } from "@signalstack/db";

import { AnalysisServiceError, inspectDataset } from "../lib/analysis-client.js";
import { removeDatasetFile, saveDatasetFile } from "../lib/dataset-storage.js";
import { store } from "../lib/store.js";

const defaultProjectId = "00000000-0000-0000-0000-000000000001";

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).name === "string"
  );
}

export const datasetRoutes = new Hono()
  .get("/", (c) => c.json({ data: store.listDatasets(c.req.query("projectId")) }))
  .post("/", async (c) => {
    const parsed = createDatasetSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json({ data: store.createDataset(parsed.data) }, 201);
  })
  .patch("/:datasetId", async (c) => {
    const parsed = createDatasetSchema.omit({ projectId: true }).partial().safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const dataset = store.updateDataset(c.req.param("datasetId"), parsed.data);
    return dataset ? c.json({ data: dataset }) : c.json({ error: "Dataset not found" }, 404);
  })
  .delete("/:datasetId", (c) => {
    const deleted = store.deleteDataset(c.req.param("datasetId"));
    return deleted ? c.body(null, 204) : c.json({ error: "Dataset not found" }, 404);
  })
  .post("/upload", async (c) => {
    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.json({ error: "Invalid multipart form data" }, 400);
    }

    const file = body.file;
    if (!isUploadedFile(file)) return c.json({ error: "A CSV file is required in the file field" }, 400);
    if (!file.name.toLowerCase().endsWith(".csv")) return c.json({ error: "Only .csv files are supported" }, 415);

    const projectIdValue = body.projectId;
    const projectId = projectIdValue === undefined ? defaultProjectId : String(projectIdValue);
    const projectIdResult = createDatasetSchema.shape.projectId.safeParse(projectId);
    if (!projectIdResult.success) return c.json({ error: "projectId must be a valid UUID" }, 400);

    let storagePath: string | undefined;
    try {
      storagePath = await saveDatasetFile(file);
      const inspection = await inspectDataset(storagePath);
      const dataset = await persistDataset({
        projectId: projectIdResult.data,
        filename: file.name,
        storagePath,
        inspection,
      });

      return c.json({ data: dataset }, 201);
    } catch (error) {
      if (storagePath) await removeDatasetFile(storagePath);
      const message = error instanceof Error ? error.message : "Dataset upload failed";
      console.error("Dataset upload failed", error);
      const status = error instanceof AnalysisServiceError ? error.statusCode : 502;
      return c.json({ error: message }, status);
    }
  })
  .get("/:datasetId", async (c) => {
    const idResult = createDatasetSchema.shape.projectId.safeParse(c.req.param("datasetId"));
    if (!idResult.success) return c.json({ error: "datasetId must be a valid UUID" }, 400);
    try {
      const dataset = await findDatasetDetail(idResult.data);
      return dataset ? c.json({ data: dataset }) : c.json({ error: "Dataset not found" }, 404);
    } catch (error) {
      console.error("Dataset lookup failed", error);
      return c.json({ error: "Dataset lookup failed" }, 503);
    }
  });
