export type UserRole = 'admin' | 'builder' | 'user' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  apiKeys: string[];
}

export interface ApprovalRequest {
  id: string;
  agentConfig: any;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolConfig {
  name: string;
  requiresApproval: boolean;
  isApproved: boolean;
  budgetLimit?: number;
  allowedRoles: UserRole[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  tool?: string;
  input?: any;
  output?: any;
  success: boolean;
  duration: number;
}

export class GovernanceService {
  private users: Map<string, User> = new Map();
  private toolConfigs: Map<string, ToolConfig> = new Map();
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.initDefaultConfigs();
  }

  private initDefaultConfigs(): void {
    const defaultTools: ToolConfig[] = [
      { name: 'Read', requiresApproval: false, isApproved: true, allowedRoles: ['admin', 'builder', 'user'] },
      { name: 'Glob', requiresApproval: false, isApproved: true, allowedRoles: ['admin', 'builder', 'user'] },
      { name: 'Grep', requiresApproval: false, isApproved: true, allowedRoles: ['admin', 'builder', 'user'] },
      { name: 'Edit', requiresApproval: true, isApproved: false, allowedRoles: ['admin', 'builder'] },
      { name: 'Write', requiresApproval: true, isApproved: false, allowedRoles: ['admin', 'builder'] },
      { name: 'Bash', requiresApproval: true, isApproved: false, allowedRoles: ['admin'] },
    ];

    for (const tool of defaultTools) {
      this.toolConfigs.set(tool.name, tool);
    }
  }

  async checkPermission(userId: string, action: string, tool: string): Promise<{ allowed: boolean; reason?: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const toolConfig = this.toolConfigs.get(tool);
    if (!toolConfig) {
      return { allowed: false, reason: `Tool ${tool} not configured` };
    }

    if (!toolConfig.allowedRoles.includes(user.role)) {
      return { allowed: false, reason: `Role ${user.role} not allowed for tool ${tool}` };
    }

    if (toolConfig.requiresApproval && !toolConfig.isApproved) {
      return { allowed: false, reason: `Tool ${tool} requires approval` };
    }

    return { allowed: true };
  }

  async approveTool(toolName: string, approvedBy: string): Promise<void> {
    const config = this.toolConfigs.get(toolName);
    if (config) {
      config.isApproved = true;
      this.toolConfigs.set(toolName, config);
    }
  }

  async logAction(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(logEntry);
  }

  async getAuditLogs(userId?: string, tool?: string, limit: number = 100): Promise<AuditLogEntry[]> {
    let logs = this.auditLogs;

    if (userId) {
      logs = logs.filter(l => l.userId === userId);
    }
    if (tool) {
      logs = logs.filter(l => l.tool === tool);
    }

    return logs.slice(-limit);
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getToolConfig(name: string): ToolConfig | undefined {
    return this.toolConfigs.get(name);
  }

  getAllToolConfigs(): ToolConfig[] {
    return Array.from(this.toolConfigs.values());
  }
}
