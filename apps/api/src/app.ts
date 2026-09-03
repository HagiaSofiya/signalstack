import { cors } from "hono/cors";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { apiEnv } from "./lib/env.js";
import { agentRunRoutes } from "./routes/agent-runs.js";
import { datasetRoutes } from "./routes/datasets.js";
import { healthRoutes } from "./routes/health.js";
import { projectRoutes } from "./routes/projects.js";
import { datasetAskRoutes } from "./routes/dataset-ask.js";
import { datasetRunRoutes } from "./routes/dataset-runs.js";
import { evalRoutes } from "./routes/evals.js";

export const app = new Hono().use("*", logger()).use(
  "*",
  cors({ origin: apiEnv.API_CORS_ORIGIN }),
);

app.route("/health", healthRoutes);
app.route("/projects", projectRoutes);
app.route("/datasets", datasetRoutes);
app.route("/datasets", datasetAskRoutes);
app.route("/datasets", datasetRunRoutes);
app.route("/agent-runs", agentRunRoutes);
app.route("/evals", evalRoutes);

app.notFound((c) => c.json({ error: "Route not found" }, 404));
