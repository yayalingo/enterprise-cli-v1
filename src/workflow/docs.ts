import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { homedir } from 'os';

export interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ParsedDocument {
  title: string;
  sections: DocumentSection[];
  metadata: Record<string, any>;
}

export interface DocumentSection {
  heading: string;
  content: string;
  level: number;
}

export class DocumentIngestion {
  private docsDir: string;

  constructor(cwd?: string) {
    this.docsDir = cwd || join(homedir(), '.enterprise-cli', 'docs');
  }

  async initialize(): Promise<void> {
    await mkdir(this.docsDir, { recursive: true });
  }

  async ingestFile(filePath: string): Promise<Document> {
    const content = await readFile(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();
    const name = filePath.split('/').pop() || 'untitled';

    let text = content;
    let metadata: Record<string, any> = {};

    if (ext === '.md') {
      const parsed = this.parseMarkdown(content);
      text = this.markdownToPlainText(content);
      metadata = { sections: parsed.sections.map(s => s.heading), ...parsed.metadata };
    }

    const doc: Document = {
      id: `doc_${Date.now()}`,
      name,
      type: ext.replace('.', ''),
      content: text,
      metadata,
      createdAt: new Date().toISOString(),
    };

    await this.store(doc);
    return doc;
  }

  async ingestDirectory(dirPath: string): Promise<Document[]> {
    const docs: Document[] = [];
    const files = await this.findFiles(dirPath);
    
    for (const file of files) {
      try {
        const doc = await this.ingestFile(file);
        docs.push(doc);
      } catch (e) {
        console.error(`Failed to ingest ${file}:`, e);
      }
    }

    return docs;
  }

  private async findFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const { readdirSync, statSync } = await import('fs');
    
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          const subFiles = await this.findFiles(fullPath);
          files.push(...subFiles);
        } else if (['.md', '.txt', '.pdf', '.docx'].includes(extname(fullPath).toLowerCase())) {
          files.push(fullPath);
        }
      }
    } catch {}

    return files;
  }

  private parseMarkdown(content: string): ParsedDocument {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentSection: DocumentSection = { heading: 'Introduction', content: '', level: 1 };
    let title = 'Untitled';

    for (const line of lines) {
      const hMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (hMatch) {
        if (currentSection.content) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: hMatch[2].trim(),
          content: '',
          level: hMatch[1].length,
        };
        if (currentSection.level === 1 && !title) {
          title = currentSection.heading;
        }
      } else {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection.content) {
      sections.push(currentSection);
    }

    return { title: title || 'Untitled', sections, metadata: {} };
  }

  private markdownToPlainText(md: string): string {
    return md
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/!\[.*\]\(.*\)/g, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .trim();
  }

  private async store(doc: Document): Promise<void> {
    const path = join(this.docsDir, `${doc.id}.json`);
    await writeFile(path, JSON.stringify(doc, null, 2));
  }

  async list(): Promise<Document[]> {
    if (!existsSync(this.docsDir)) return [];

    const { readdirSync } = await import('fs');
    const docs: Document[] = [];

    try {
      const files = readdirSync(this.docsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(this.docsDir, file), 'utf-8');
          docs.push(JSON.parse(content));
        }
      }
    } catch {}

    return docs;
  }

  async search(query: string): Promise<Document[]> {
    const docs = await this.list();
    const queryLower = query.toLowerCase();

    return docs.filter(doc => 
      doc.content.toLowerCase().includes(queryLower) ||
      doc.name.toLowerCase().includes(queryLower)
    );
  }

  async getById(id: string): Promise<Document | null> {
    const path = join(this.docsDir, `${id}.json`);
    if (!existsSync(path)) return null;

    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  getContextForWorkflow(workflowDescription: string, docs: Document[]): string {
    const relevant: string[] = [];
    const keywords = workflowDescription.toLowerCase().split(/\s+/);

    for (const doc of docs) {
      const score = keywords.filter(k => doc.content.toLowerCase().includes(k)).length;
      if (score > 0) {
        relevant.push(`## ${doc.name}\n${doc.content.substring(0, 2000)}`);
      }
    }

    return relevant.join('\n\n---\n\n');
  }
}
