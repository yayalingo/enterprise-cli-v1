import type { LLMConfig, LLMResponse, LLMInterface, Message } from '../agent/types';
export declare class AnthropicProvider implements LLMInterface {
    private client;
    private model;
    private maxTokens;
    private temperature;
    constructor(config: LLMConfig);
    chat(messages: Message[]): Promise<LLMResponse>;
    private convertMessages;
    private convertResponse;
}
export declare class OpenAIProvider implements LLMInterface {
    private client;
    private model;
    private maxTokens;
    private temperature;
    constructor(config: LLMConfig);
    chat(messages: Message[]): Promise<LLMResponse>;
    private convertMessages;
    private convertResponse;
}
export declare class OllamaProvider implements LLMInterface {
    private baseUrl;
    private model;
    private maxTokens;
    private temperature;
    constructor(config: LLMConfig);
    chat(messages: Message[]): Promise<LLMResponse>;
}
export declare function createLLMProvider(config: LLMConfig): LLMInterface;
//# sourceMappingURL=llm.d.ts.map