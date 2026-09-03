import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
});

export function getDatabaseEnv() {
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}
