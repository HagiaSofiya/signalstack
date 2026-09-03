import { z } from "zod";

const aiEnvSchema = z.object({
  AI_PROVIDER: z.enum(["openai", "openrouter"]).default("openai"),
  AI_MODEL: z.string().min(1).default("gpt-5.6"),
  OPENAI_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  OPENROUTER_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  ANALYSIS_SERVICE_URL: z.string().url().default("http://localhost:8000"),
});

export const aiEnv = aiEnvSchema.parse({
  AI_PROVIDER: process.env.AI_PROVIDER,
  AI_MODEL: process.env.AI_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  ANALYSIS_SERVICE_URL: process.env.ANALYSIS_SERVICE_URL,
});
