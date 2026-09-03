import { aiEnv } from "../config.js";
import { OpenAIProvider } from "./openai.js";
import { OpenRouterProvider } from "./openrouter.js";
import type { LLMProvider } from "./provider.js";

export function createLLMProvider(): LLMProvider {
  if (aiEnv.AI_PROVIDER === "openai") return new OpenAIProvider();
  if (aiEnv.AI_PROVIDER === "openrouter") return new OpenRouterProvider();
  throw new Error(`Unsupported AI provider: ${aiEnv.AI_PROVIDER}`);
}

export { OpenAIProvider } from "./openai.js";
export { OpenRouterProvider } from "./openrouter.js";
export * from "./provider.js";
