import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { Message, SessionContext } from './types';

export interface SessionData {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  workingDirectory: string;
  messages: Message[];
  context?: SessionContext;
  permissionMode?: string;
  model?: string;
}

export interface TranscriptEntry {
  role: string;
  content: string;
  timestamp: string;
  tool_calls?: any[];
  tool_results?: any[];
}

export class SessionManager {
  private sessionsDir: string;
  private transcriptsDir: string;
  private currentSession: SessionData | null = null;
  private currentId: string | null = null;

  constructor() {
    const baseDir = join(homedir(), '.enterprise-cli');
    this.sessionsDir = join(baseDir, 'sessions');
    this.transcriptsDir = join(baseDir, 'transcripts');
  }

  async initialize(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
    await mkdir(this.transcriptsDir, { recursive: true });
  }

  generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async create(workingDirectory: string, context?: SessionContext): Promise<string> {
    const id = this.generateId();
    const now = new Date().toISOString();

    this.currentSession = {
      id,
      createdAt: now,
      lastActivityAt: now,
      workingDirectory,
      messages: [],
      context,
    };

    this.currentId = id;
    return id;
  }

  async save(): Promise<void> {
    if (!this.currentSession || !this.currentId) return;

    this.currentSession.lastActivityAt = new Date().toISOString();
    
    const sessionPath = join(this.sessionsDir, `${this.currentId}.json`);
    await writeFile(sessionPath, JSON.stringify(this.currentSession, null, 2));

    await this.saveTranscript();
  }

  private async saveTranscript(): Promise<void> {
    if (!this.currentSession || !this.currentId) return;

    const transcriptPath = join(this.transcriptsDir, `${this.currentId}.jsonl`);
    const entries: TranscriptEntry[] = this.currentSession.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        timestamp: new Date().toISOString(),
      }));

    const jsonl = entries.map(e => JSON.stringify(e)).join('\n');
    await writeFile(transcriptPath, jsonl);
  }

  async load(id: string): Promise<SessionData | null> {
    const sessionPath = join(this.sessionsDir, `${id}.json`);
    
    if (!existsSync(sessionPath)) {
      return null;
    }

    try {
      const data = await readFile(sessionPath, 'utf-8');
      const session = JSON.parse(data) as SessionData;
      
      this.currentSession = session;
      this.currentId = id;
      
      return session;
    } catch {
      return null;
    }
  }

  async loadTranscript(id: string): Promise<TranscriptEntry[]> {
    const transcriptPath = join(this.transcriptsDir, `${id}.jsonl`);
    
    if (!existsSync(transcriptPath)) {
      return [];
    }

    try {
      const data = await readFile(transcriptPath, 'utf-8');
      return data.split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as TranscriptEntry);
    } catch {
      return [];
    }
  }

  async list(): Promise<SessionData[]> {
    try {
      const files = await readdir(this.sessionsDir);
      const sessions: SessionData[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await readFile(join(this.sessionsDir, file), 'utf-8');
            sessions.push(JSON.parse(data) as SessionData);
          } catch {}
        }
      }

      return sessions.sort((a, b) => 
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );
    } catch {
      return [];
    }
  }

  async delete(id: string): Promise<boolean> {
    const sessionPath = join(this.sessionsDir, `${id}.json`);
    const transcriptPath = join(this.transcriptsDir, `${id}.jsonl`);

    try {
      if (existsSync(sessionPath)) {
        await unlink(sessionPath);
      }
      if (existsSync(transcriptPath)) {
        await unlink(transcriptPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  addMessage(message: Message): void {
    if (this.currentSession) {
      this.currentSession.messages.push(message);
    }
  }

  getMessages(): Message[] {
    return this.currentSession?.messages || [];
  }

  getCurrentId(): string | null {
    return this.currentId;
  }

  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  setPermissionMode(mode: string): void {
    if (this.currentSession) {
      this.currentSession.permissionMode = mode;
    }
  }

  setModel(model: string): void {
    if (this.currentSession) {
      this.currentSession.model = model;
    }
  }
}
