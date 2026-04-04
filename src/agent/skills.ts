import { existsSync, readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface Skill {
  name: string;
  description: string;
  allowedTools?: string[];
  basePath: string;
  content: string;
}

export interface SkillInvocation {
  name: string;
  basePath: string;
  content: string;
}

function parseSkillMd(content: string): { name: string; description: string; allowedTools?: string[] } | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  const toolsMatch = frontmatter.match(/^allowedTools:\s*\[([^\]]+)\]/m);

  if (!nameMatch || !descMatch) return null;

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    allowedTools: toolsMatch ? toolsMatch[1].split(',').map(t => t.trim()) : undefined,
  };
}

function getBody(content: string): string {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  if (frontmatterMatch) {
    return content.slice(frontmatterMatch[0].length).trim();
  }
  return content;
}

export class SkillLoader {
  private skills: Map<string, Skill> = new Map();
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir || join(process.env.HOME || '', '.claude', 'skills');
  }

  async load(): Promise<void> {
    if (!existsSync(this.skillsDir)) return;

    try {
      const entries = readdirSync(this.skillsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(this.skillsDir, entry.name, 'SKILL.md');
          if (existsSync(skillPath)) {
            await this.loadSkill(skillPath, entry.name);
          }
        }
      }
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  }

  private async loadSkill(skillPath: string, name: string): Promise<void> {
    try {
      const content = await readFile(skillPath, 'utf-8');
      const metadata = parseSkillMd(content);
      
      if (!metadata) {
        console.warn(`Invalid SKILL.md in ${skillPath}`);
        return;
      }

      this.skills.set(metadata.name, {
        name: metadata.name,
        description: metadata.description,
        allowedTools: metadata.allowedTools,
        basePath: join(this.skillsDir, name),
        content: getBody(content),
      });
    } catch (error) {
      console.error(`Error loading skill ${name}:`, error);
    }
  }

  getSkillList(): { name: string; description: string }[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.name,
      description: s.description,
    }));
  }

  getSkillSummary(): string {
    const list = this.getSkillList();
    if (list.length === 0) return '';

    const skillsText = list.map(s => `  - ${s.name}: ${s.description}`).join('\n');
    return `
<available_skills>
${skillsText}
</available_skills>`;
  }

  invoke(name: string): SkillInvocation | null {
    const skill = this.skills.get(name);
    if (!skill) return null;

    return {
      name: skill.name,
      basePath: skill.basePath,
      content: skill.content,
    };
  }

  hasSkill(name: string): boolean {
    return this.skills.has(name);
  }

  loadProjectSkills(projectDir: string): void {
    const projectSkillsDir = join(projectDir, '.claude', 'skills');
    if (!existsSync(projectSkillsDir)) return;

    this.loadDirSync(projectSkillsDir);
  }

  private loadDirSync(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = join(dir, entry.name, 'SKILL.md');
          if (existsSync(skillPath)) {
            this.loadSkillSync(skillPath, entry.name);
          }
        }
      }
    } catch (error) {
      console.error('Error loading project skills:', error);
    }
  }

  private loadSkillSync(skillPath: string, name: string): void {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(skillPath, 'utf-8');
      const metadata = parseSkillMd(content);
      
      if (!metadata) return;

      this.skills.set(metadata.name, {
        name: metadata.name,
        description: metadata.description,
        allowedTools: metadata.allowedTools,
        basePath: join(this.skillsDir, name),
        content: getBody(content),
      });
    } catch (error) {
      console.error(`Error loading skill ${name}:`, error);
    }
  }
}
