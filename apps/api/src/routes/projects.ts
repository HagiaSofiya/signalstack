import { Hono } from "hono";
import { createProjectSchema } from "@signalstack/schemas";

import { store } from "../lib/store.js";

export const projectRoutes = new Hono()
  .get("/", (c) => c.json({ data: store.listProjects() }))
  .post("/", async (c) => {
    const parsed = createProjectSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json({ data: store.createProject(parsed.data) }, 201);
  })
  .get("/:projectId", (c) => {
    const project = store.getProject(c.req.param("projectId"));
    return project ? c.json({ data: project }) : c.json({ error: "Project not found" }, 404);
  })
  .patch("/:projectId", async (c) => {
    const parsed = createProjectSchema.partial().safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const project = store.updateProject(c.req.param("projectId"), parsed.data);
    return project ? c.json({ data: project }) : c.json({ error: "Project not found" }, 404);
  })
  .delete("/:projectId", (c) => {
    const deleted = store.deleteProject(c.req.param("projectId"));
    return deleted ? c.body(null, 204) : c.json({ error: "Project not found" }, 404);
  });
