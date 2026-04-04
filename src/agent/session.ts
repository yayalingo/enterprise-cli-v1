import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SESSION_DIR = join(process.env.HOME || '', '.enterprise-cli', 'sessions');

export interface SessionData {
  id: string;
  messages: any[];
  permissionMode: string;
  workingDirectory: string;
  createdAt: string;
  lastActivityAt: string;
}

export class SessionManager {
  private sessionDir: string;

  constructor() {
    this.sessionDir = SESSION_DIR;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  private getSessionPath(id: string): string {
    return join(this.sessionDir, `${id}.json`);
  }

  async save(data: SessionData): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(this.getSessionPath(data.id), JSON.stringify(data, null, 2));
  }

  async load(id: string): Promise<SessionData | null> {
    const fs = await import('fs/promises');
    const path = this.getSessionPath(id);
    
    if (!existsSync(path)) {
      return null;
    }
    
    try {
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async list(): Promise<SessionData[]> {
    const fs = await import('fs/promises');
    const files = await fs.readdir(this.sessionDir);
    
    const sessions: SessionData[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(join(this.sessionDir, file), 'utf-8');
          sessions.push(JSON.parse(content));
        } catch {
        }
      }
    }
    
    return sessions.sort((a, b) => 
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
  }

  async delete(id: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = this.getSessionPath(id);
    
    if (existsSync(path)) {
      await fs.unlink(path);
    }
  }

  generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
