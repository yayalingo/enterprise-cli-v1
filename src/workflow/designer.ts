import { Workflow, WorkflowNode, WorkflowConnection, WorkflowTrigger, createWorkflow, createNode } from './types';
import { NodeFactory, nodeFactory } from './factory';
import { DocumentIngestion } from './docs';

export interface WorkflowDesignRequest {
  description: string;
  context?: string;
  documents?: string[];
}

export interface WorkflowDesignResult {
  workflow: Workflow;
  suggestions: string[];
  missingNodes: string[];
  confidence: number;
}

export class WorkflowDesigner {
  private nodeFactory: NodeFactory;
  private docIngestion: DocumentIngestion;

  constructor() {
    this.nodeFactory = nodeFactory;
    this.docIngestion = new DocumentIngestion();
  }

  async design(request: WorkflowDesignRequest): Promise<WorkflowDesignResult> {
    const { description, context, documents } = request;
    
    const nodes: WorkflowNode[] = [];
    const connections: WorkflowConnection[] = [];
    const suggestions: string[] = [];
    const missingNodes: string[] = [];

    const trigger = this.detectTrigger(description);
    const workflow = createWorkflow(this.extractName(description), trigger);

    const steps = this.parseDescription(description);
    let prevNodeId: string | null = null;

    for (const step of steps) {
      const matchedNodes = this.nodeFactory.createFromDescription(step.text);
      
      if (matchedNodes.length === 0) {
        missingNodes.push(step.text);
        const node = createNode('action', step.text, { description: step.text });
        nodes.push(node);
      } else {
        const best = matchedNodes[0];
        const node = this.nodeFactory.createNodeInstance(best, step.config);
        nodes.push(node);
        suggestions.push(`Added "${best.name}" for "${step.text}"`);
      }

      if (prevNodeId) {
        connections.push({
          id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          source: prevNodeId,
          target: nodes[nodes.length - 1].id,
        });
      }

      prevNodeId = nodes[nodes.length - 1].id;
    }

    workflow.nodes = nodes;
    workflow.connections = connections;

    if (context) {
      suggestions.push(...this.addContextSuggestions(context));
    }

    const confidence = Math.min(1, (steps.length - missingNodes.length) / steps.length);

    return {
      workflow,
      suggestions,
      missingNodes,
      confidence,
    };
  }

  private detectTrigger(description: string): WorkflowTrigger {
    const lower = description.toLowerCase();
    
    if (lower.includes('daily') || lower.includes('every morning') || lower.includes('schedule')) {
      return { type: 'schedule', config: { expression: '0 9 * * *' } };
    }
    if (lower.includes('when') || lower.includes('receive') || lower.includes('new')) {
      return { type: 'webhook', config: { path: '/webhook/' + Date.now() } };
    }
    if (lower.includes('manual') || lower.includes('click') || lower.includes('button')) {
      return { type: 'manual', config: {} };
    }

    return { type: 'manual', config: {} };
  }

  private extractName(description: string): string {
    const firstSentence = description.split(/[.!?]/)[0].trim();
    return firstSentence.length > 50 ? firstSentence.substring(0, 50) + '...' : firstSentence;
  }

  private parseDescription(description: string): Array<{ text: string; config: Record<string, any> }> {
    const steps: Array<{ text: string; config: Record<string, any> }> = [];
    
    const separators = [
      /then\s+/i,
      /and\s+then\s+/i,
      /next\s+/i,
      /after\s+that\s+/i,
      /,\s+then\s+/i,
      /step\s+\d+[:\.]/i,
      /\d+[\.\)]\s+/i,
    ];

    let parts = [description];
    for (const sep of separators) {
      const newParts: string[] = [];
      for (const part of parts) {
        newParts.push(...part.split(sep));
      }
      parts = newParts;
    }

    parts = parts.filter(p => p.trim().length > 5);

    for (const part of parts) {
      const text = part.trim();
      if (text.length < 3) continue;

      const config: Record<string, any> = {};
      
      if (text.includes('email')) {
        config.channel = 'email';
      } else if (text.includes('slack')) {
        config.channel = 'slack';
      } else if (text.includes('teams')) {
        config.channel = 'teams';
      }

      const timeMatch = text.match(/(\d+)\s*(hour|minute|day)/i);
      if (timeMatch) {
        const value = parseInt(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        config.duration = unit.includes('hour') ? value * 3600 : unit.includes('minute') ? value * 60 : value * 86400;
      }

      steps.push({ text, config });
    }

    return steps.length > 0 ? steps : [{ text: description, config: {} }];
  }

  private addContextSuggestions(context: string): string[] {
    const suggestions: string[] = [];
    const lower = context.toLowerCase();

    if (lower.includes('urgent') || lower.includes('critical')) {
      suggestions.push('Consider adding high-priority notification for critical items');
    }
    if (lower.includes('review')) {
      suggestions.push('Add human approval step before taking action');
    }
    if (lower.includes('tune') || lower.includes('whitelist')) {
      suggestions.push('Add learning node to track false positives');
    }

    return suggestions;
  }

  getAvailableNodes() {
    return this.nodeFactory.getAll();
  }

  getCategories() {
    return this.nodeFactory.getCategories();
  }
}

export const workflowDesigner = new WorkflowDesigner();
