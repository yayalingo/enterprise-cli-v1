export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostEntry {
  model: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: string;
}

export class CostTracker {
  private usage: TokenUsage[] = [];
  private costs: CostEntry[] = [];
  private sessionStart: Date;

  private pricePerMillion: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
    'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },
    'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'gpt-4': { input: 30.0, output: 60.0 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'qwen': { input: 0.5, output: 0.5 },
    'default': { input: 1.0, output: 1.0 },
  };

  constructor() {
    this.sessionStart = new Date();
  }

  track(model: string, promptTokens: number, completionTokens: number): void {
    const totalTokens = promptTokens + completionTokens;
    
    this.usage.push({ promptTokens, completionTokens, totalTokens });

    const prices = this.pricePerMillion[model] || this.pricePerMillion['default'];
    const inputCost = (promptTokens / 1_000_000) * prices.input;
    const outputCost = (completionTokens / 1_000_000) * prices.output;
    const totalCost = inputCost + outputCost;

    this.costs.push({
      model,
      inputCost,
      outputCost,
      totalCost,
      timestamp: new Date().toISOString(),
    });
  }

  getTotalUsage(): TokenUsage {
    return this.usage.reduce(
      (acc, u) => ({
        promptTokens: acc.promptTokens + u.promptTokens,
        completionTokens: acc.completionTokens + u.completionTokens,
        totalTokens: acc.totalTokens + u.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  getTotalCost(): number {
    return this.costs.reduce((acc, c) => acc + c.totalCost, 0);
  }

  getSessionCost(): { total: number; byModel: Map<string, number> } {
    const byModel = new Map<string, number>();
    
    for (const cost of this.costs) {
      const current = byModel.get(cost.model) || 0;
      byModel.set(cost.model, current + cost.totalCost);
    }

    return {
      total: this.getTotalCost(),
      byModel,
    };
  }

  getSessionDuration(): number {
    return Date.now() - this.sessionStart.getTime();
  }

  getFormattedSummary(): string {
    const usage = this.getTotalUsage();
    const cost = this.getSessionCost();
    const duration = this.getSessionDuration();

    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    let summary = `Session Stats:
- Duration: ${minutes}m ${seconds}s
- Prompt tokens: ${usage.promptTokens.toLocaleString()}
- Completion tokens: ${usage.completionTokens.toLocaleString()}
- Total tokens: ${usage.totalTokens.toLocaleString()}
- Total cost: $${cost.total.toFixed(4)}`;

    if (cost.byModel.size > 1) {
      summary += '\nBy model:';
      for (const [model, modelCost] of cost.byModel) {
        summary += `\n  - ${model}: $${modelCost.toFixed(4)}`;
      }
    }

    return summary;
  }

  estimateNextCall(model: string, promptTokens: number): number {
    const prices = this.pricePerMillion[model] || this.pricePerMillion['default'];
    return (promptTokens / 1_000_000) * prices.input;
  }
}
