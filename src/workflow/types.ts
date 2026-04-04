export type NodeType = 
  | 'trigger'
  | 'action'
  | 'condition'
  | 'transform'
  | 'notification'
  | 'http'
  | 'ai';

export type TriggerType = 
  | 'schedule'
  | 'webhook'
  | 'email'
  | 'manual';

export type ActionType = 
  | 'http_request'
  | 'send_message'
  | 'create_task'
  | 'update_record'
  | 'run_command'
  | 'transform_data'
  | 'store';

export interface NodeDefinition {
  type: NodeType;
  category: string;
  name: string;
  description: string;
  inputSchema: Record<string, SchemaProperty>;
  outputSchema?: Record<string, SchemaProperty>;
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: any;
  enum?: string[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
}

export interface WorkflowTrigger {
  type: TriggerType;
  config: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables: Record<string, any>;
  settings: WorkflowSettings;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSettings {
  retryOnFailure: boolean;
  maxRetries: number;
  timeout: number;
  enableAuditLog: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startedAt: string;
  completedAt?: string;
  currentNode?: string;
  input: Record<string, any>;
  output: Record<string, any>;
  error?: string;
  nodeResults: Record<string, NodeExecutionResult>;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input: any;
  output: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration: number;
}

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  workflow: Partial<Workflow>;
  tags: string[];
}

export function createNode(type: NodeType, name: string, config: Record<string, any> = {}): WorkflowNode {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    name,
    config,
    position: { x: 100, y: 100 },
  };
}

export function createWorkflow(name: string, trigger: WorkflowTrigger): Workflow {
  return {
    id: `wf_${Date.now()}`,
    name,
    version: '1.0.0',
    trigger,
    nodes: [],
    connections: [],
    variables: {},
    settings: {
      retryOnFailure: true,
      maxRetries: 3,
      timeout: 300000,
      enableAuditLog: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
