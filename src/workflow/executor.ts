import { Workflow, WorkflowExecution, WorkflowNode, WorkflowConnection, NodeExecutionResult, WorkflowTrigger } from './types';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  variables: Record<string, any>;
  nodeResults: Map<string, any>;
  input: Record<string, any>;
}

type NodeExecutor = (node: WorkflowNode, context: ExecutionContext) => Promise<any>;

export class WorkflowExecutor {
  private nodeExecutors: Map<string, NodeExecutor> = new Map();
  private executionsDir: string;

  constructor(cwd?: string) {
    this.executionsDir = cwd || join(homedir(), '.enterprise-cli', 'executions');
    this.registerBuiltInExecutors();
  }

  async initialize(): Promise<void> {
    await mkdir(this.executionsDir, { recursive: true });
  }

  private registerBuiltInExecutors(): void {
    this.register('trigger', async (node, context) => {
      return { triggered: true, timestamp: new Date().toISOString() };
    });

    this.register('action', async (node, context) => {
      const config = node.config;
      const result: any = { executed: true };

      switch (config.category || node.name) {
        case 'HTTP Request':
          if (config.url) {
            try {
              const response = await fetch(config.url, {
                method: config.method || 'GET',
                headers: config.headers || {},
                body: config.body ? JSON.stringify(config.body) : undefined,
              });
              result.response = await response.text();
              result.status = response.status;
            } catch (e: any) {
              result.error = e.message;
            }
          }
          break;
        case 'Send Slack Message':
          result.message = `Slack: ${config.text} to ${config.channel}`;
          break;
        case 'Send Teams Message':
          result.message = `Teams: ${config.text}`;
          break;
        case 'Send Email':
          result.message = `Email to: ${config.to}, subject: ${config.subject}`;
          break;
        case 'Store Data':
          result.stored = true;
          break;
        case 'Create Task':
          result.taskId = `task_${Date.now()}`;
          break;
        default:
          result.message = `Executed: ${node.name}`;
      }

      return result;
    });

    this.register('condition', async (node, context) => {
      const config = node.config;
      let result = false;

      try {
        const expr = config.expression
          .replace(/\{\{([^}]+)\}\}/g, (_: string, path: string) => {
            const value = this.getNestedValue(context.variables, path.trim()) || 
                         this.getNestedValue(context.nodeResults, path.trim());
            return JSON.stringify(value);
          });
        result = eval(expr);
      } catch (e) {
        result = false;
      }

      return { condition: result, branch: result ? 'true' : 'false' };
    });

    this.register('transform', async (node, context) => {
      const config = node.config;
      const input = context.variables.input || context.variables;

      if (config.code) {
        try {
          const fn = new Function('input', 'context', `return ${config.code}`);
          return fn(input, context);
        } catch (e: any) {
          return { error: e.message };
        }
      }

      return input;
    });

    this.register('ai', async (node, context) => {
      return { 
        aiResult: 'AI analysis placeholder - requires LLM integration',
        input: context.variables,
      };
    });

    this.register('notification', async (node, context) => {
      return { notified: true };
    });
  }

  register(type: string, executor: NodeExecutor): void {
    this.nodeExecutors.set(type, executor);
  }

  async execute(workflow: Workflow, input: Record<string, any> = {}): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      input,
      output: {},
      nodeResults: {},
    };

    try {
      const context: ExecutionContext = {
        workflowId: workflow.id,
        executionId: execution.id,
        variables: { ...workflow.variables, ...input },
        nodeResults: new Map(),
        input,
      };

      const startResult = await this.executeTrigger(workflow.trigger, context);
      context.variables = { ...context.variables, ...startResult };

      execution.status = await this.executeNodes(workflow, context, execution) as any;

      execution.output = context.variables;
    } catch (e: any) {
      execution.status = 'failed';
      execution.error = e.message;
    }

    execution.completedAt = new Date().toISOString();
    await this.saveExecution(execution);

    return execution;
  }

  private async executeTrigger(trigger: WorkflowTrigger, context: ExecutionContext): Promise<any> {
    switch (trigger.type) {
      case 'schedule':
        return { triggered: true, schedule: trigger.config.expression };
      case 'webhook':
        return { triggered: true, webhookPath: trigger.config.path };
      case 'manual':
        return { triggered: true, manual: true };
      case 'email':
        return { triggered: true, email: true };
      default:
        return { triggered: true };
    }
  }

  private async executeNodes(workflow: Workflow, context: ExecutionContext, execution: WorkflowExecution): Promise<string> {
    const connectionMap = new Map<string, string[]>();
    for (const conn of workflow.connections) {
      const targets = connectionMap.get(conn.source) || [];
      targets.push(conn.target);
      connectionMap.set(conn.source, targets);
    }

    const visited = new Set<string>();
    const executeNode = async (nodeId: string): Promise<string> => {
      if (visited.has(nodeId)) return 'skipped';
      visited.add(nodeId);

      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) return 'failed';

      execution.currentNode = nodeId;
      const startTime = Date.now();

      try {
        const executor = this.nodeExecutors.get(node.type) || this.nodeExecutors.get('action');
        const result = await executor!(node, context);

        const nodeResult: NodeExecutionResult = {
          nodeId,
          status: 'success',
          input: context.variables,
          output: result,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
        };

        execution.nodeResults[nodeId] = nodeResult;
        context.nodeResults.set(nodeId, result);
        context.variables = { ...context.variables, ...result };

        const nextNodes = connectionMap.get(nodeId) || [];
        for (const nextId of nextNodes) {
          await executeNode(nextId);
        }

        return 'success';
      } catch (e: any) {
        const nodeResult: NodeExecutionResult = {
          nodeId,
          status: 'failed',
          input: context.variables,
          output: { error: e.message },
          error: e.message,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration: Date.now() - startTime,
        };
        execution.nodeResults[nodeId] = nodeResult;
        return 'failed';
      }
    };

    const triggerNode = workflow.nodes[0];
    if (triggerNode) {
      return await executeNode(triggerNode.id);
    }

    return 'completed';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private async saveExecution(execution: WorkflowExecution): Promise<void> {
    const path = join(this.executionsDir, `${execution.id}.json`);
    await writeFile(path, JSON.stringify(execution, null, 2));
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    const path = join(this.executionsDir, `${id}.json`);
    if (!existsSync(path)) return null;

    try {
      const content = await import('fs').then(fs => fs.promises.readFile(path, 'utf-8'));
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async listExecutions(workflowId?: string): Promise<WorkflowExecution[]> {
    if (!existsSync(this.executionsDir)) return [];

    const { readdirSync } = await import('fs');
    const executions: WorkflowExecution[] = [];

    try {
      const files = readdirSync(this.executionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(this.executionsDir, file), 'utf-8');
          const exec = JSON.parse(content) as WorkflowExecution;
          if (!workflowId || exec.workflowId === workflowId) {
            executions.push(exec);
          }
        }
      }
    } catch {}

    return executions.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }
}

export const workflowExecutor = new WorkflowExecutor();
