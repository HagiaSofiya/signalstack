import { z } from "zod";

import { aiEnv } from "../config.js";
import {
  LLMProviderError,
  type GenerateInput,
  type LLMProvider,
  type ProviderResponse,
  type ProviderToolCall,
} from "./provider.js";

const responseSchema = z.object({
  id: z.string(),
  model: z.string().optional(),
  output: z.array(z.unknown()),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  }).nullable().optional(),
});

const functionCallSchema = z.object({
  type: z.literal("function_call"),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

const messageSchema = z.object({
  type: z.literal("message"),
  content: z.array(z.unknown()),
});

const outputTextSchema = z.object({ type: z.literal("output_text"), text: z.string() });

export class OpenAIProvider implements LLMProvider {
  async generate(input: GenerateInput): Promise<ProviderResponse> {
    if (!aiEnv.OPENAI_API_KEY) throw new LLMProviderError("OPENAI_API_KEY is not configured", 503);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${aiEnv.OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: aiEnv.AI_MODEL,
          instructions: input.instructions,
          input: input.input,
          tools: input.tools,
          store: false,
        }),
        signal: input.signal ?? AbortSignal.timeout(60_000),
      });
    } catch {
      throw new LLMProviderError("The LLM provider is unavailable", 503);
    }

    if (!response.ok) {
      throw new LLMProviderError("The LLM provider returned an error", response.status >= 500 ? 503 : 502);
    }

    let payload: z.infer<typeof responseSchema>;
    try {
      payload = responseSchema.parse(await response.json());
    } catch {
      throw new LLMProviderError("The LLM provider returned a malformed response", 502);
    }

    const toolCalls: ProviderToolCall[] = [];
    const textParts: string[] = [];
    for (const item of payload.output) {
      const functionCall = functionCallSchema.safeParse(item);
      if (functionCall.success) {
        let parsedArguments: unknown;
        try {
          parsedArguments = JSON.parse(functionCall.data.arguments) as unknown;
        } catch {
          throw new LLMProviderError("The LLM provider returned malformed tool arguments", 502);
        }
        toolCalls.push({
          callId: functionCall.data.call_id,
          name: functionCall.data.name,
          arguments: parsedArguments,
        });
        continue;
      }

      const message = messageSchema.safeParse(item);
      if (!message.success) continue;
      for (const content of message.data.content) {
        const outputText = outputTextSchema.safeParse(content);
        if (outputText.success) textParts.push(outputText.data.text);
      }
    }

    return {
      id: payload.id,
      model: payload.model ?? aiEnv.AI_MODEL,
      text: textParts.join("\n").trim(),
      toolCalls,
      outputItems: payload.output,
      usage: {
        inputTokens: payload.usage?.input_tokens ?? null,
        outputTokens: payload.usage?.output_tokens ?? null,
        totalTokens: payload.usage?.total_tokens ?? null,
      },
    };
  }
}
