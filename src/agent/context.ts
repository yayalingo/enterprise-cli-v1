import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { execSync } from 'child_process';
import type { ClaudeMdEntry, SessionContext, GitStatus } from './types';

export class ContextAssembler {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  async loadClaudeMdFiles(): Promise<ClaudeMdEntry[]> {
    const entries: ClaudeMdEntry[] = [];

    const globalPath = join(process.env.HOME || '', '.claude', 'CLAUDE.md');
    if (existsSync(globalPath)) {
      entries.push({
        path: globalPath,
        content: await readFile(globalPath, 'utf-8'),
        scope: 'global',
      });
    }

    const projectPath = join(this.cwd, 'CLAUDE.md');
    if (existsSync(projectPath)) {
      entries.push({
        path: projectPath,
        content: await readFile(projectPath, 'utf-8'),
        scope: 'project',
      });
    }

    const localPath = join(this.cwd, 'CLAUDE.local.md');
    if (existsSync(localPath)) {
      entries.push({
        path: localPath,
        content: await readFile(localPath, 'utf-8'),
        scope: 'local',
      });
    }

    let currentDir = dirname(this.cwd);
    const root = '/';
    while (currentDir && currentDir !== root && currentDir !== process.env.HOME) {
      const parentPath = join(currentDir, 'CLAUDE.md');
      if (existsSync(parentPath)) {
        entries.push({
          path: parentPath,
          content: await readFile(parentPath, 'utf-8'),
          scope: 'parent',
        });
      }
      currentDir = dirname(currentDir);
    }

    return entries;
  }

  getSessionContext(): SessionContext {
    const isGitRepo = this.checkIsGitRepo();
    const gitStatus = isGitRepo ? this.getGitStatus() : undefined;

    return {
      workingDirectory: this.cwd,
      isGitRepo,
      platform: process.platform,
      date: new Date().toISOString().split('T')[0],
      gitStatus,
    };
  }

  private checkIsGitRepo(): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd: this.cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private getGitStatus(): GitStatus {
    try {
      const branch = execSync('git branch --show-current', { cwd: this.cwd, encoding: 'utf-8' }).trim() || 'main';
      const mainBranch = execSync('git config init.defaultBranch', { cwd: this.cwd, encoding: 'utf-8' }).trim() || 'main';

      const status = execSync('git status --porcelain', { cwd: this.cwd, encoding: 'utf-8' }).trim();
      const modified: string[] = [];
      const deleted: string[] = [];
      const untracked: string[] = [];

      for (const line of status.split('\n')) {
        if (!line) continue;
        const statusChar = line.substring(0, 2);
        const file = line.substring(3);

        if (statusChar.includes('M') || statusChar === ' M') modified.push(file);
        if (statusChar.includes('D') || statusChar === ' D') deleted.push(file);
        if (statusChar === '??') untracked.push(file);
      }

      const recentCommits = execSync('git log -5 --oneline', { cwd: this.cwd, encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(Boolean);

      return { branch, mainBranch, modified, deleted, untracked, recentCommits };
    } catch {
      return {
        branch: 'unknown',
        mainBranch: 'main',
        modified: [],
        deleted: [],
        untracked: [],
        recentCommits: [],
      };
    }
  }

  formatContextMessage(ctx: SessionContext): string {
    let msg = `<env>\nWorking directory: ${ctx.workingDirectory}\nIs directory a git repo: ${ctx.isGitRepo}\nPlatform: ${ctx.platform}\nToday's date: ${ctx.date}\n</env>`;

    if (ctx.gitStatus) {
      msg += `\n\n<gitStatus>\nCurrent branch: ${ctx.gitStatus.branch}\nMain branch: ${ctx.gitStatus.mainBranch}`;
      
      if (ctx.gitStatus.modified.length > 0) {
        msg += `\nModified: ${ctx.gitStatus.modified.join(', ')}`;
      }
      if (ctx.gitStatus.untracked.length > 0) {
        msg += `\nUntracked: ${ctx.gitStatus.untracked.join(', ')}`;
      }
      if (ctx.gitStatus.recentCommits.length > 0) {
        msg += `\nRecent commits:\n${ctx.gitStatus.recentCommits.join('\n')}`;
      }
      msg += '\n</gitStatus>';
    }

    return msg;
  }

  formatClaudeMdMessage(entries: ClaudeMdEntry[]): string {
    if (entries.length === 0) return '';

    const sections = entries.map(entry => {
      const scope = entry.scope.toUpperCase();
      return `<system-reminder>\n# Project instructions (${scope})\n${entry.content}\n</system-reminder>`;
    });

    return sections.join('\n\n');
  }
}
