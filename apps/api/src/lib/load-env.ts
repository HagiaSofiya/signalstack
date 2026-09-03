import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

const localEnvPath = path.resolve(process.cwd(), ".env");
const workspaceEnvPath = path.resolve(process.cwd(), "../../.env");

config({ path: existsSync(localEnvPath) ? localEnvPath : workspaceEnvPath });
