import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
  aiEnv: {
    AI_MODEL: "openai/gpt-4o-mini",
    OPENROUTER_API_KEY: "test-openrouter-key",
  },
}));

import { OpenRouterProvider } from "./openrouter.js";

describe("OpenRouterProvider", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends chat-completions messages and parses tool calls", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "gen-1",
          model: "openai/gpt-4o-mini",
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call-1",
                    type: "function",
                    function: { name: "inspect_dataset", arguments: "{}" },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
        }),
        { status: 200 },
      ),
    );

    const result = await new OpenRouterProvider().generate({
      instructions: "Follow the data rules.",
      input: [{ role: "user", content: "Inspect this dataset." }],
      tools: [
        {
          type: "function",
          name: "inspect_dataset",
          description: "Inspect the dataset.",
          parameters: { type: "object", properties: {} },
          strict: true,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: {
          authorization: "Bearer test-openrouter-key",
          "content-type": "application/json",
        },
      }),
    );
    const request = JSON.parse(
      fetchMock.mock.calls[0]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(request.messages).toEqual([
      { role: "system", content: "Follow the data rules." },
      { role: "user", content: "Inspect this dataset." },
    ]);
    expect(request.tools).toEqual([
      {
        type: "function",
        function: {
          name: "inspect_dataset",
          description: "Inspect the dataset.",
          parameters: { type: "object", properties: {} },
          strict: true,
        },
      },
    ]);
    expect(result).toMatchObject({
      id: "gen-1",
      model: "openai/gpt-4o-mini",
      text: "",
      toolCalls: [{ callId: "call-1", name: "inspect_dataset", arguments: {} }],
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
    });
  });

  it("translates the agent's tool output into a chat tool message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "gen-2",
          model: "openai/gpt-4o-mini",
          choices: [
            {
              message: { role: "assistant", content: "The dataset is ready." },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await new OpenRouterProvider().generate({
      instructions: "Follow the data rules.",
      input: [
        { role: "user", content: "Inspect this dataset." },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "inspect_dataset", arguments: "{}" },
            },
          ],
        },
        {
          type: "function_call_output",
          call_id: "call-1",
          output: JSON.stringify({ columns: [] }),
        },
      ],
      tools: [],
    });

    const request = JSON.parse(
      fetchMock.mock.calls[0]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(request.messages).toEqual([
      { role: "system", content: "Follow the data rules." },
      { role: "user", content: "Inspect this dataset." },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "inspect_dataset", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call-1",
        content: JSON.stringify({ columns: [] }),
      },
    ]);
  });
});
