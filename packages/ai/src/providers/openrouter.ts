import { z } from "zod";

import { aiEnv } from "../config.js";
import {
  LLMProviderError,
  type GenerateInput,
  type LLMProvider,
  type ProviderResponse,
  type ProviderToolCall,
} from "./provider.js";

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const responseSchema = z.object({
  id: z.string(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal("assistant").optional(),
          content: z
            .union([z.string(), z.array(z.unknown()), z.null()])
            .optional(),
          tool_calls: z.array(toolCallSchema).optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .nullable()
    .optional(),
});

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export class OpenRouterProvider implements LLMProvider {
  async generate(input: GenerateInput): Promise<ProviderResponse> {
    if (!aiEnv.OPENROUTER_API_KEY)
      throw new LLMProviderError("OPENROUTER_API_KEY is not configured", 503);

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${aiEnv.OPENROUTER_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: aiEnv.AI_MODEL,
          messages: toChatMessages(input.instructions, input.input),
          tools: input.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              strict: tool.strict,
            },
          })),
        }),
        signal: input.signal ?? AbortSignal.timeout(60_000),
      });
    } catch {
      throw new LLMProviderError("The LLM provider is unavailable", 503);
    }

    if (!response.ok) {
      throw new LLMProviderError(
        "The LLM provider returned an error",
        response.status >= 500 ? 503 : 502,
      );
    }

    let payload: z.infer<typeof responseSchema>;
    try {
      payload = responseSchema.parse(await response.json());
    } catch {
      throw new LLMProviderError(
        "The LLM provider returned a malformed response",
        502,
      );
    }

    const message = payload.choices[0]?.message;
    if (!message)
      throw new LLMProviderError(
        "The LLM provider returned a malformed response",
        502,
      );
    const toolCalls: ProviderToolCall[] = [];
    for (const toolCall of message.tool_calls ?? []) {
      let parsedArguments: unknown;
      try {
        parsedArguments = JSON.parse(toolCall.function.arguments) as unknown;
      } catch {
        throw new LLMProviderError(
          "The LLM provider returned malformed tool arguments",
          502,
        );
      }
      toolCalls.push({
        callId: toolCall.id,
        name: toolCall.function.name,
        arguments: parsedArguments,
      });
    }

    return {
      id: payload.id,
      model: payload.model ?? aiEnv.AI_MODEL,
      text: messageContentToText(message.content),
      toolCalls,
      outputItems: [message],
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: payload.usage?.completion_tokens ?? null,
        totalTokens: payload.usage?.total_tokens ?? null,
      },
    };
  }
}

function toChatMessages(instructions: string, input: unknown[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: instructions }];
  for (const item of input) {
    if (isChatMessage(item)) {
      messages.push(item);
      continue;
    }

    if (isFunctionCallOutput(item)) {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id,
        content: item.output,
      });
    }
  }
  return messages;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const role = (value as { role?: unknown }).role;
  return (
    role === "user" ||
    role === "assistant" ||
    role === "system" ||
    role === "tool"
  );
}

function isFunctionCallOutput(
  value: unknown,
): value is { type: "function_call_output"; call_id: string; output: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const candidate = value as {
    type?: unknown;
    call_id?: unknown;
    output?: unknown;
  };
  return (
    candidate.type === "function_call_output" &&
    typeof candidate.call_id === "string" &&
    typeof candidate.output === "string"
  );
}

function messageContentToText(
  content: string | unknown[] | null | undefined,
): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part !== "object" || part === null) return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}
