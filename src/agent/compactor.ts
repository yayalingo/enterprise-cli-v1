import type { Message } from '../agent/types';

export enum CompactionStrategy {
  TimeBasedClear = 'time_based_clear',
  ConversationSummary = 'conversation_summary',
  SessionMemoryExtract = 'session_memory_extract',
  FullHistorySummary = 'full_history_summary',
  TruncateOldest = 'truncate_oldest',
}

export interface CompactionConfig {
  maxTokens: number;
  maxMessages: number;
  clearToolResultsAfterTurns: number;
  enableSummaryCompaction: boolean;
}

export class ContextCompactor {
  private config: CompactionConfig;
  private turnCount: number = 0;

  constructor(config?: Partial<CompactionConfig>) {
    this.config = {
      maxTokens: config?.maxTokens || 100000,
      maxMessages: config?.maxMessages || 100,
      clearToolResultsAfterTurns: config?.clearToolResultsAfterTurns || 10,
      enableSummaryCompaction: config?.enableSummaryCompaction ?? true,
    };
  }

  async compact(messages: Message[], provider?: any): Promise<Message[]> {
    this.turnCount++;
    let result = [...messages];

    result = this.applyStrategy(CompactionStrategy.TimeBasedClear, result);
    
    if (result.length > this.config.maxMessages) {
      result = this.applyStrategy(CompactionStrategy.TruncateOldest, result);
    }

    if (this.turnCount % 20 === 0 && this.config.enableSummaryCompaction && provider) {
      result = await this.applyStrategyWithLLM(CompactionStrategy.ConversationSummary, result, provider);
    }

    if (this.turnCount % 50 === 0 && this.config.enableSummaryCompaction && provider) {
      result = await this.applyStrategyWithLLM(CompactionStrategy.FullHistorySummary, result, provider);
    }

    return result;
  }

  private applyStrategy(strategy: CompactionStrategy, messages: Message[]): Message[] {
    switch (strategy) {
      case CompactionStrategy.TimeBasedClear:
        return this.clearOldToolResults(messages);
      case CompactionStrategy.TruncateOldest:
        return this.truncateOldest(messages);
      case CompactionStrategy.SessionMemoryExtract:
        return this.extractSessionMemory(messages);
      default:
        return messages;
    }
  }

  private async applyStrategyWithLLM(strategy: CompactionStrategy, messages: Message[], provider: any): Promise<Message[]> {
    switch (strategy) {
      case CompactionStrategy.ConversationSummary:
        return this.summarizeConversation(messages, provider);
      case CompactionStrategy.FullHistorySummary:
        return this.summarizeFullHistory(messages, provider);
      default:
        return messages;
    }
  }

  private clearOldToolResults(messages: Message[]): Message[] {
    if (this.turnCount % this.config.clearToolResultsAfterTurns !== 0) {
      return messages;
    }

    const result: Message[] = [];
    let toolResultCount = 0;

    for (const msg of messages) {
      if (msg.role === 'tool') {
        toolResultCount++;
        if (toolResultCount <= 5) {
          result.push(msg);
        }
      } else {
        result.push(msg);
      }
    }

    return result;
  }

  private truncateOldest(messages: Message[]): Message[] {
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    const keepCount = this.config.maxMessages - systemMessages.length;
    if (keepCount <= 0) return messages;

    return [...systemMessages, ...otherMessages.slice(-keepCount)];
  }

  private extractSessionMemory(messages: Message[]): Message[] {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const keyFacts: string[] = [];
    
    for (const msg of userMessages.slice(-5)) {
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.length > 0) {
        keyFacts.push(`User request: ${content.substring(0, 200)}`);
      }
    }

    const summary: Message = {
      role: 'system',
      content: `<session_memory>\n${keyFacts.join('\n')}\n</session_memory>`,
    };

    const systemMsgs = messages.filter(m => m.role === 'system' && !m.content.toString().includes('<session_memory>'));
    
    return [...systemMsgs, summary, ...assistantMessages.slice(-10)];
  }

  private async summarizeConversation(messages: Message[], provider: any): Promise<Message[]> {
    const recentMessages = messages.slice(-20);
    
    const summaryPrompt = `Summarize this conversation concisely, focusing on key decisions, file changes, and current state:\n\n${this.messagesToText(recentMessages)}`;

    try {
      const summaryResponse = await provider.chat([{
        role: 'user',
        content: summaryPrompt,
      }]);

      const summary = typeof summaryResponse.content === 'string' 
        ? summaryResponse.content 
        : summaryResponse.content[0]?.text || '';

      const systemMsgs = messages.filter(m => m.role === 'system');
      const latestMsgs = messages.slice(-5);

      return [
        ...systemMsgs,
        { role: 'system', content: `<conversation_summary>\n${summary}\n</conversation_summary>` },
        ...latestMsgs,
      ];
    } catch {
      return messages;
    }
  }

  private async summarizeFullHistory(messages: Message[], provider: any): Promise<Message[]> {
    const summaryPrompt = `Create a comprehensive summary of this entire session including:\n1. Files modified\n2. Tasks completed\n3. Current project state\n4. Remaining context\n\n${this.messagesToText(messages)}`;

    try {
      const summaryResponse = await provider.chat([{
        role: 'user',
        content: summaryPrompt,
      }]);

      const summary = typeof summaryResponse.content === 'string'
        ? summaryResponse.content
        : summaryResponse.content[0]?.text || '';

      const systemMsgs = messages.filter(m => m.role === 'system');

      return [
        ...systemMsgs,
        { role: 'system', content: `<full_history_summary>\n${summary}\n</full_history_summary>` },
      ];
    } catch {
      return messages;
    }
  }

  private messagesToText(messages: Message[]): string {
    return messages.map(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return `${m.role}: ${content}`;
    }).join('\n---\n');
  }

  getTurnCount(): number {
    return this.turnCount;
  }

  getConfig(): CompactionConfig {
    return { ...this.config };
  }
}
