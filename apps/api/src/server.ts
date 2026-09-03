import "./lib/load-env.js";

import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { apiEnv } from "./lib/env.js";

serve({ fetch: app.fetch, port: apiEnv.API_PORT });
console.log(`SignalStack API listening on http://localhost:${apiEnv.API_PORT}`);
