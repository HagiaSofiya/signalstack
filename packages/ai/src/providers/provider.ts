export type JsonSchema = Record<string, unknown>;

export interface ProviderToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
  strict: boolean;
}

export interface ProviderToolCall {
  callId: string;
  name: string;
  arguments: unknown;
}

export interface ProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ProviderResponse {
  id: string;
  model: string;
  text: string;
  toolCalls: ProviderToolCall[];
  outputItems: unknown[];
  usage: ProviderUsage;
}

export interface GenerateInput {
  instructions: string;
  input: unknown[];
  tools: ProviderToolDefinition[];
  signal?: AbortSignal;
}

export interface LLMProvider {
  generate(input: GenerateInput): Promise<ProviderResponse>;
}

export class LLMProviderError extends Error {
  constructor(message: string, readonly statusCode: number = 502) {
    super(message);
    this.name = "LLMProviderError";
  }
}
