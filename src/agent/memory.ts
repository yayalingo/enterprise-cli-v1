import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicMemory {
  name: string;
  content: string;
  updatedAt: string;
}

export interface TranscriptMatch {
  sessionId: string;
  timestamp: string;
  matchedContent: string;
}

export class MemoryManager {
  private memdir: string;
  private indexPath: string;
  private topicsDir: string;
  private transcriptsDir: string;

  constructor(cwd?: string) {
    const baseDir = join(homedir(), '.enterprise-cli');
    this.memdir = cwd ? join(cwd, '.enterprise-cli', 'memdir') : join(baseDir, 'memdir');
    this.indexPath = join(this.memdir, 'MEMORY.md');
    this.topicsDir = join(this.memdir, 'topics');
    this.transcriptsDir = join(baseDir, 'transcripts');
  }

  async initialize(): Promise<void> {
    await mkdir(this.memdir, { recursive: true });
    await mkdir(this.topicsDir, { recursive: true });
    await mkdir(this.transcriptsDir, { recursive: true });

    if (!existsSync(this.indexPath)) {
      await writeFile(this.indexPath, '# Memory Index\n\n');
    }
  }

  async loadIndex(): Promise<MemoryEntry[]> {
    if (!existsSync(this.indexPath)) {
      return [];
    }

    try {
      const content = await readFile(this.indexPath, 'utf-8');
      return this.parseIndex(content);
    } catch {
      return [];
    }
  }

  private parseIndex(content: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const lines = content.split('\n');
    let currentEntry: Partial<MemoryEntry> | null = null;

    for (const line of lines) {
      const idMatch = line.match(/^##\s+(\w+)-(\d+)/);
      if (idMatch) {
        if (currentEntry?.id) {
          entries.push(currentEntry as MemoryEntry);
        }
        currentEntry = {
          id: idMatch[1],
          content: '',
          category: 'general',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      if (currentEntry && line.startsWith('- **')) {
        const keyMatch = line.match(/\*\*(\w+):\*\*\s*(.+)/);
        if (keyMatch) {
          if (keyMatch[1] === 'content') {
            currentEntry.content = keyMatch[2];
          } else if (keyMatch[1] === 'category') {
            currentEntry.category = keyMatch[2];
          }
        }
      }
    }

    if (currentEntry?.id) {
      entries.push(currentEntry as MemoryEntry);
    }

    return entries;
  }

  async loadTopic(name: string): Promise<string | null> {
    const topicPath = join(this.topicsDir, `${name}.md`);
    
    if (!existsSync(topicPath)) {
      return null;
    }

    try {
      return await readFile(topicPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async saveTopic(name: string, content: string): Promise<void> {
    const topicPath = join(this.topicsDir, `${name}.md`);
    await writeFile(topicPath, content);
  }

  async listTopics(): Promise<string[]> {
    if (!existsSync(this.topicsDir)) {
      return [];
    }

    try {
      const files = await readdir(this.topicsDir);
      return files
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''));
    } catch {
      return [];
    }
  }

  async addToIndex(content: string, category: string = 'general'): Promise<string> {
    const id = `mem_${Date.now()}`;
    const now = new Date().toISOString();

    const entry = `## ${id}
- **content**: ${content.substring(0, 150)}
- **category**: ${category}
- **created**: ${now}
`;

    const existing = await readFile(this.indexPath, 'utf-8').catch(() => '# Memory Index\n\n');
    await writeFile(this.indexPath, existing + entry);

    return id;
  }

  async searchTranscripts(query: string): Promise<TranscriptMatch[]> {
    if (!existsSync(this.transcriptsDir)) {
      return [];
    }

    const matches: TranscriptMatch[] = [];
    const queryLower = query.toLowerCase();

    try {
      const files = await readdir(this.transcriptsDir);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const transcriptPath = join(this.transcriptsDir, file);
        const content = await readFile(transcriptPath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const contentStr = typeof entry.content === 'string' ? entry.content : '';
            
            if (contentStr.toLowerCase().includes(queryLower)) {
              matches.push({
                sessionId: file.replace('.jsonl', ''),
                timestamp: entry.timestamp,
                matchedContent: contentStr.substring(0, 200),
              });
            }
          } catch {}
        }
      }
    } catch {}

    return matches.slice(0, 10);
  }

  async extractSessionMemory(messages: any[]): Promise<string> {
    const keyItems: string[] = [];

    for (const msg of messages.slice(-10)) {
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (msg.role === 'user' && content) {
        keyItems.push(`User: ${content.substring(0, 100)}`);
      }
      if (msg.role === 'assistant' && content) {
        keyItems.push(`Assistant: ${content.substring(0, 100)}`);
      }
    }

    return keyItems.join('\n');
  }

  getIndexPath(): string {
    return this.indexPath;
  }

  getMemdirPath(): string {
    return this.memdir;
  }
}
