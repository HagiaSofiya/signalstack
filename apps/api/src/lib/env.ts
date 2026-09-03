import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  ANALYSIS_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  DATA_STORAGE_DIR: z.string().min(1).optional(),
});

export const apiEnv = envSchema.parse({
  API_PORT: process.env.API_PORT,
  API_CORS_ORIGIN: process.env.API_CORS_ORIGIN,
  ANALYSIS_SERVICE_URL: process.env.ANALYSIS_SERVICE_URL,
  DATA_STORAGE_DIR: process.env.DATA_STORAGE_DIR,
});
