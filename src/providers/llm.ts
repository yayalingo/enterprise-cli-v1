import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { LLMConfig, LLMResponse, LLMInterface, Message, ProviderType } from '../agent/types';

export class AnthropicProvider implements LLMInterface {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseUrl,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 1;
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const anthropicMessages = this.convertMessages(messages);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: anthropicMessages,
    });

    return this.convertResponse(response);
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        const content = msg.content as string;
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: msg.tool_use_id,
              content: content,
            }
          ]
        };
      }

      if (typeof msg.content === 'string') {
        return { role: msg.role as 'user' | 'assistant' | 'system', content: msg.content };
      }

      const blocks = (msg.content as any[]).map(block => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text };
        }
        if (block.type === 'tool_use') {
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
        }
        return block;
      });

      return { role: msg.role as 'user' | 'assistant' | 'system', content: blocks };
    });
  }

  private convertResponse(response: Anthropic.Message): LLMResponse {
    const content = response.content.map(block => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      return { type: 'text' as const, text: '' };
    });

    return {
      content,
      stop_reason: response.stop_reason as 'end_turn' | 'max_tokens' | 'stop_sequence',
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }
}

export class OpenAIProvider implements LLMInterface {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
    });
    this.model = config.model || 'gpt-4o';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 1;
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const openAIMessages = this.convertMessages(messages);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: openAIMessages,
      tools: this.getTools(),
    });

    return this.convertResponse(response);
  }

  private getTools() {
    return undefined;
  }

  private convertMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.tool_use_id,
          content: msg.content as string,
        };
      }

      if (msg.tool_calls) {
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: typeof msg.content === 'string' ? msg.content : undefined,
          tool_calls: msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        };
      }

      if (typeof msg.content === 'string') {
        return { role: msg.role as 'user' | 'assistant' | 'system', content: msg.content };
      }

      const content = (msg.content as any[])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      return { role: msg.role as 'user' | 'assistant' | 'system', content };
    });
  }

  private convertResponse(response: OpenAI.Chat.ChatCompletion): LLMResponse {
    const choice = response.choices[0];
    const message = choice.message;

    const content: any[] = [];

    if (message.content) {
      content.push({ type: 'text', text: message.content });
    }

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    return {
      content,
      stop_reason: choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason === 'length' ? 'max_tokens' : 'stop_sequence',
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };
  }
}

export class OllamaProvider implements LLMInterface {
  private baseUrl: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: LLMConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 1;
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const openAIMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      const content = (msg.content as any[])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      return { role: msg.role, content };
    });

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: openAIMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: [{ type: 'text', text: data.message?.content || '' }],
      stop_reason: data.done ? 'end_turn' : 'max_tokens',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    };
  }
}

export function createLLMProvider(config: LLMConfig): LLMInterface {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
