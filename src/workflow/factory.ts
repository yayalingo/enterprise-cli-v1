import { NodeDefinition, NodeType, createNode, SchemaProperty } from './types';

export interface NodeDescriptor {
  type: NodeType;
  category: string;
  keywords: string[];
  name: string;
  description: string;
  inputSchema: Record<string, SchemaProperty>;
  defaultConfig: Record<string, any>;
}

export class NodeFactory {
  private nodeDescriptors: NodeDescriptor[] = [];

  constructor() {
    this.registerBuiltInNodes();
  }

  private registerBuiltInNodes(): void {
    // Triggers
    this.register({
      type: 'trigger',
      category: 'Schedule',
      keywords: ['schedule', 'cron', 'timer', 'daily', 'hourly', 'repeat', 'recurring'],
      name: 'Schedule Trigger',
      description: 'Run workflow on a schedule (cron expression or interval)',
      inputSchema: {
        expression: { type: 'string', description: 'Cron expression (e.g., 0 9 * * * for 9am daily)', required: true },
        timezone: { type: 'string', description: 'Timezone (default: UTC)', default: 'UTC' },
      },
      defaultConfig: { expression: '0 9 * * *', timezone: 'UTC' },
    });

    this.register({
      type: 'trigger',
      category: 'Webhook',
      keywords: ['webhook', 'http', 'api', 'request', 'trigger'],
      name: 'Webhook Trigger',
      description: 'Start workflow when HTTP request is received',
      inputSchema: {
        path: { type: 'string', description: 'Webhook path', required: true },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT'], default: 'POST' },
        auth: { type: 'string', description: 'Authentication type (none, basic, bearer)' },
      },
      defaultConfig: { path: '/webhook', method: 'POST', auth: 'none' },
    });

    this.register({
      type: 'trigger',
      category: 'Email',
      keywords: ['email', 'gmail', 'mail', 'inbox', 'receive'],
      name: 'Email Trigger',
      description: 'Trigger on new email received',
      inputSchema: {
        provider: { type: 'string', enum: ['gmail', 'imap'], default: 'gmail' },
        filter: { type: 'string', description: 'Filter query (e.g., from:alert@company.com)' },
        interval: { type: 'number', description: 'Check interval in seconds', default: 60 },
      },
      defaultConfig: { provider: 'gmail', interval: 60 },
    });

    this.register({
      type: 'trigger',
      category: 'Manual',
      keywords: ['manual', 'button', 'click', 'user', 'trigger'],
      name: 'Manual Trigger',
      description: 'Manually trigger the workflow',
      inputSchema: {},
      defaultConfig: {},
    });

    // Actions - HTTP
    this.register({
      type: 'action',
      category: 'HTTP',
      keywords: ['http', 'request', 'api', 'call', 'fetch', 'get', 'post', 'put'],
      name: 'HTTP Request',
      description: 'Make HTTP API call',
      inputSchema: {
        url: { type: 'string', description: 'Request URL', required: true },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'object', description: 'Request body' },
        timeout: { type: 'number', description: 'Timeout in ms', default: 30000 },
      },
      defaultConfig: { method: 'GET', timeout: 30000 },
    });

    // Actions - Communication
    this.register({
      type: 'action',
      category: 'Communication',
      keywords: ['slack', 'message', 'send', 'channel', 'notify', 'team'],
      name: 'Send Slack Message',
      description: 'Send message to Slack channel or user',
      inputSchema: {
        channel: { type: 'string', description: 'Channel name or ID', required: true },
        text: { type: 'string', description: 'Message text', required: true },
        username: { type: 'string', description: 'Bot username' },
        iconEmoji: { type: 'string', description: 'Bot icon' },
      },
      defaultConfig: { channel: '#alerts', text: '{{data.message}}' },
    });

    this.register({
      type: 'action',
      category: 'Communication',
      keywords: ['teams', 'microsoft', 'message', 'channel', 'notify'],
      name: 'Send Teams Message',
      description: 'Send message to Microsoft Teams channel',
      inputSchema: {
        webhookUrl: { type: 'string', description: 'Teams webhook URL', required: true },
        title: { type: 'string', description: 'Message title' },
        text: { type: 'string', description: 'Message text', required: true },
        color: { type: 'string', description: 'Theme color (hex)' },
      },
      defaultConfig: {},
    });

    this.register({
      type: 'action',
      category: 'Communication',
      keywords: ['email', 'send', 'mail', 'smtp', 'gmail'],
      name: 'Send Email',
      description: 'Send an email',
      inputSchema: {
        to: { type: 'string', description: 'Recipients (comma separated)', required: true },
        subject: { type: 'string', description: 'Email subject', required: true },
        body: { type: 'string', description: 'Email body', required: true },
        from: { type: 'string', description: 'From address' },
        cc: { type: 'string', description: 'CC recipients' },
      },
      defaultConfig: {},
    });

    // Actions - Data
    this.register({
      type: 'action',
      category: 'Data',
      keywords: ['store', 'save', 'database', 'db', 'write', 'insert'],
      name: 'Store Data',
      description: 'Store data to file or database',
      inputSchema: {
        destination: { type: 'string', enum: ['file', 'database'], default: 'file' },
        path: { type: 'string', description: 'File path or table name' },
        data: { type: 'object', description: 'Data to store', required: true },
        mode: { type: 'string', enum: ['append', 'overwrite'], default: 'append' },
      },
      defaultConfig: { destination: 'file', mode: 'append' },
    });

    this.register({
      type: 'action',
      category: 'Data',
      keywords: ['read', 'load', 'fetch', 'get', 'database', 'file'],
      name: 'Read Data',
      description: 'Read data from file or database',
      inputSchema: {
        source: { type: 'string', enum: ['file', 'database'], default: 'file' },
        path: { type: 'string', description: 'File path or SQL query', required: true },
      },
      defaultConfig: { source: 'file' },
    });

    // Actions - Task Management
    this.register({
      type: 'action',
      category: 'Task',
      keywords: ['task', 'ticket', 'create', 'jira', 'issue'],
      name: 'Create Task',
      description: 'Create a task or ticket',
      inputSchema: {
        provider: { type: 'string', enum: ['local', 'jira', 'linear'], default: 'local' },
        title: { type: 'string', description: 'Task title', required: true },
        description: { type: 'string', description: 'Task description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        assignee: { type: 'string', description: 'Assignee email' },
      },
      defaultConfig: { provider: 'local', priority: 'medium' },
    });

    // Condition
    this.register({
      type: 'condition',
      category: 'Logic',
      keywords: ['if', 'condition', 'check', 'filter', 'branch'],
      name: 'If/Else',
      description: 'Branch based on condition',
      inputSchema: {
        expression: { type: 'string', description: 'Condition expression (JavaScript)', required: true },
      },
      defaultConfig: { expression: '{{data.value}} > 0' },
    });

    this.register({
      type: 'condition',
      category: 'Logic',
      keywords: ['switch', 'case', 'match', 'branch', 'multiple'],
      name: 'Switch',
      description: 'Multiple condition branches',
      inputSchema: {
        expression: { type: 'string', description: 'Value to evaluate', required: true },
        cases: { type: 'array', description: 'Case definitions' },
        default: { type: 'string', description: 'Default case node ID' },
      },
      defaultConfig: { cases: [] },
    });

    // Transform
    this.register({
      type: 'transform',
      category: 'Data',
      keywords: ['transform', 'map', 'convert', 'format', 'filter'],
      name: 'Transform Data',
      description: 'Transform data using JavaScript',
      inputSchema: {
        code: { type: 'string', description: 'Transformation code', required: true },
      },
      defaultConfig: { code: 'return input;' },
    });

    this.register({
      type: 'transform',
      category: 'Data',
      keywords: ['merge', 'combine', 'join', 'concat'],
      name: 'Merge Data',
      description: 'Merge multiple inputs',
      inputSchema: {
        inputs: { type: 'array', description: 'Input references' },
        strategy: { type: 'string', enum: ['merge', 'append', 'zip'] },
      },
      defaultConfig: { strategy: 'merge' },
    });

    // AI
    this.register({
      type: 'ai',
      category: 'AI',
      keywords: ['ai', 'llm', 'gpt', 'claude', 'openai', 'anthropic', 'analyze', 'summarize'],
      name: 'AI Analysis',
      description: 'Analyze or generate text using LLM',
      inputSchema: {
        provider: { type: 'string', enum: ['openai', 'anthropic', 'custom'], default: 'custom' },
        model: { type: 'string', description: 'Model to use' },
        prompt: { type: 'string', description: 'System prompt', required: true },
        inputVariable: { type: 'string', description: 'Input variable name' },
        temperature: { type: 'number', description: 'Temperature (0-2)', default: 0.7 },
        maxTokens: { type: 'number', description: 'Max tokens', default: 2048 },
      },
      defaultConfig: { prompt: 'Analyze this data and provide insights.', temperature: 0.7 },
    });

    this.register({
      type: 'ai',
      category: 'AI',
      keywords: ['summarize', 'summary', 'extract', 'key points'],
      name: 'AI Summarize',
      description: 'Summarize text using AI',
      inputSchema: {
        provider: { type: 'string', default: 'custom' },
        model: { type: 'string' },
        maxLength: { type: 'number', description: 'Max summary length', default: 200 },
      },
      defaultConfig: { maxLength: 200 },
    });

    // Notification
    this.register({
      type: 'notification',
      category: 'Notification',
      keywords: ['notify', 'alert', 'pagerduty', 'opsgenie', 'oncall'],
      name: 'PagerDuty Alert',
      description: 'Create PagerDuty alert',
      inputSchema: {
        title: { type: 'string', description: 'Alert title', required: true },
        severity: { type: 'string', enum: ['critical', 'error', 'warning', 'info'] },
        body: { type: 'string', description: 'Alert body' },
        urgency: { type: 'string', enum: ['high', 'low'] },
      },
      defaultConfig: { severity: 'warning', urgency: 'low' },
    });

    this.register({
      type: 'notification',
      category: 'Notification',
      keywords: ['wait', 'delay', 'sleep', 'pause'],
      name: 'Delay',
      description: 'Wait for specified duration',
      inputSchema: {
        duration: { type: 'number', description: 'Duration in seconds', required: true },
      },
      defaultConfig: { duration: 60 },
    });
  }

  register(descriptor: NodeDescriptor): void {
    this.nodeDescriptors.push(descriptor);
  }

  createFromDescription(description: string): NodeDescriptor[] {
    const keywords = description.toLowerCase().split(/\s+/);
    const matched: NodeDescriptor[] = [];

    for (const node of this.nodeDescriptors) {
      const score = node.keywords.reduce((acc, kw) => {
        if (keywords.some(k => k.includes(kw) || kw.includes(k))) {
          return acc + 1;
        }
        return acc;
      }, 0);

      if (score > 0) {
        matched.push({ ...node, description: `${node.description} (matched: ${score})` });
      }
    }

    return matched.sort((a, b) => {
      const scoreA = a.keywords.filter(k => keywords.some(k => k.includes(k) || k.includes(k))).length;
      const scoreB = b.keywords.filter(k => keywords.some(k => k.includes(k) || k.includes(k))).length;
      return scoreB - scoreA;
    });
  }

  getAll(): NodeDescriptor[] {
    return [...this.nodeDescriptors];
  }

  getByCategory(category: string): NodeDescriptor[] {
    return this.nodeDescriptors.filter(n => n.category === category);
  }

  getCategories(): string[] {
    return [...new Set(this.nodeDescriptors.map(n => n.category))];
  }

  createNodeInstance(descriptor: NodeDescriptor, overrides: Record<string, any> = {}): any {
    return createNode(descriptor.type, descriptor.name, {
      ...descriptor.defaultConfig,
      ...overrides,
    });
  }
}

export const nodeFactory = new NodeFactory();
