"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = exports.OpenAIProvider = exports.AnthropicProvider = void 0;
exports.createLLMProvider = createLLMProvider;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const openai_1 = __importDefault(require("openai"));
class AnthropicProvider {
    client;
    model;
    maxTokens;
    temperature;
    constructor(config) {
        this.client = new sdk_1.default({
            apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
            baseURL: config.baseUrl,
        });
        this.model = config.model || 'claude-sonnet-4-20250514';
        this.maxTokens = config.maxTokens || 4096;
        this.temperature = config.temperature || 1;
    }
    async chat(messages) {
        const anthropicMessages = this.convertMessages(messages);
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            messages: anthropicMessages,
        });
        return this.convertResponse(response);
    }
    convertMessages(messages) {
        return messages.map(msg => {
            if (msg.role === 'tool') {
                const content = typeof msg.content === 'string' ? msg.content : '';
                return {
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: msg.tool_use_id || '',
                            content: content,
                        }
                    ]
                };
            }
            if (typeof msg.content === 'string') {
                return { role: msg.role, content: msg.content };
            }
            const blocks = msg.content.map((block) => {
                if (block.type === 'text') {
                    return { type: 'text', text: block.text };
                }
                if (block.type === 'tool_use') {
                    return {
                        type: 'tool_use',
                        id: block.id,
                        name: block.name,
                        input: block.input,
                    };
                }
                return block;
            });
            return { role: msg.role, content: blocks };
        });
    }
    convertResponse(response) {
        const content = response.content.map((block) => {
            if (block.type === 'text') {
                return { type: 'text', text: block.text };
            }
            if (block.type === 'tool_use') {
                return {
                    type: 'tool_use',
                    id: block.id,
                    name: block.name,
                    input: block.input,
                };
            }
            return { type: 'text', text: '' };
        });
        return {
            content,
            stop_reason: response.stop_reason,
            usage: {
                input_tokens: response.usage?.input_tokens || 0,
                output_tokens: response.usage?.output_tokens || 0,
            },
        };
    }
}
exports.AnthropicProvider = AnthropicProvider;
class OpenAIProvider {
    client;
    model;
    maxTokens;
    temperature;
    tools = [];
    constructor(config) {
        this.client = new openai_1.default({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            baseURL: config.baseUrl || 'https://api.openai.com/v1',
        });
        this.model = config.model || 'gpt-4o';
        this.maxTokens = config.maxTokens || 4096;
        this.temperature = config.temperature || 1;
    }
    setTools(toolDefs) {
        this.tools = toolDefs;
    }
    async chat(messages) {
        const openAIMessages = this.convertMessages(messages);
        const response = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            messages: openAIMessages,
            tools: this.tools.length > 0 ? this.tools : undefined,
        });
        return this.convertResponse(response);
    }
    convertMessages(messages) {
        return messages.map(msg => {
            if (msg.role === 'tool') {
                return {
                    role: 'tool',
                    tool_call_id: msg.tool_use_id || '',
                    content: typeof msg.content === 'string' ? msg.content : '',
                };
            }
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                return {
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : '',
                    tool_calls: msg.tool_calls.map((tc) => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.input),
                        },
                    })),
                };
            }
            if (typeof msg.content === 'string') {
                return { role: msg.role, content: msg.content };
            }
            const content = msg.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('\n');
            return { role: msg.role, content };
        });
    }
    convertResponse(response) {
        const choice = response.choices[0];
        const message = choice.message;
        const content = [];
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
exports.OpenAIProvider = OpenAIProvider;
class OllamaProvider {
    baseUrl;
    model;
    maxTokens;
    temperature;
    constructor(config) {
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'llama3';
        this.maxTokens = config.maxTokens || 4096;
        this.temperature = config.temperature || 1;
    }
    async chat(messages) {
        const msgs = messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { role: msg.role, content: msg.content };
            }
            const content = msg.content
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
                messages: msgs,
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
exports.OllamaProvider = OllamaProvider;
function createLLMProvider(config) {
    switch (config.provider) {
        case 'anthropic':
            return new AnthropicProvider(config);
        case 'openai':
        case 'custom':
            return new OpenAIProvider(config);
        case 'ollama':
            return new OllamaProvider(config);
        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}
//# sourceMappingURL=llm.js.map