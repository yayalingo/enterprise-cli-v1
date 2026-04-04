import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface AuditEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  action: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: string;
  success: boolean;
  duration: number;
  userId?: string;
  ip?: string;
}

export interface AuditQuery {
  sessionId?: string;
  tool?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export class AuditLogger {
  private auditDir: string;
  private sessionId: string;
  private entries: AuditEntry[] = [];

  constructor(sessionId: string, cwd?: string) {
    const baseDir = cwd || join(homedir(), '.enterprise-cli');
    this.auditDir = join(baseDir, 'audit');
    this.sessionId = sessionId;
  }

  async initialize(): Promise<void> {
    await mkdir(this.auditDir, { recursive: true });
  }

  log(action: string, tool: string, input: Record<string, unknown>, output: string, success: boolean, duration: number): void {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      action,
      tool,
      input: this.sanitizeInput(input),
      output: output.substring(0, 10000),
      success,
      duration,
    };
    this.entries.push(entry);
  }

  private sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
    const sensitive = ['apiKey', 'api_key', 'password', 'token', 'secret'];
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(input)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    const filePath = join(this.auditDir, `${this.sessionId}.jsonl`);
    const lines = this.entries.map(e => JSON.stringify(e)).join('\n');
    
    const existing = existsSync(filePath) 
      ? await readFile(filePath, 'utf-8').catch(() => '')
      : '';

    await writeFile(filePath, existing + (existing ? '\n' : '') + lines);
    this.entries = [];
  }

  static async query(auditDir: string, query: AuditQuery): Promise<AuditEntry[]> {
    if (!existsSync(auditDir)) return [];

    const results: AuditEntry[] = [];
    
    try {
      const files = await readdir(auditDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        
        const content = await readFile(join(auditDir, file), 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as AuditEntry;
            
            if (query.sessionId && entry.sessionId !== query.sessionId) continue;
            if (query.tool && entry.tool !== query.tool) continue;
            if (query.startDate && entry.timestamp < query.startDate) continue;
            if (query.endDate && entry.timestamp > query.endDate) continue;
            
            results.push(entry);
          } catch {}
        }
      }
    } catch {
      return [];
    }

    const limit = query.limit || 100;
    return results.slice(-limit).reverse();
  }

  static async getSessions(auditDir: string): Promise<string[]> {
    if (!existsSync(auditDir)) return [];
    
    try {
      const files = await readdir(auditDir);
      return files.filter(f => f.endsWith('.jsonl')).map(f => f.replace('.jsonl', ''));
    } catch {
      return [];
    }
  }

  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
