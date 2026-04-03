"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAssembler = void 0;
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
class ContextAssembler {
    cwd;
    constructor(cwd) {
        this.cwd = cwd;
    }
    async loadClaudeMdFiles() {
        const entries = [];
        const globalPath = (0, path_1.join)(process.env.HOME || '', '.claude', 'CLAUDE.md');
        if ((0, fs_1.existsSync)(globalPath)) {
            entries.push({
                path: globalPath,
                content: await (0, promises_1.readFile)(globalPath, 'utf-8'),
                scope: 'global',
            });
        }
        const projectPath = (0, path_1.join)(this.cwd, 'CLAUDE.md');
        if ((0, fs_1.existsSync)(projectPath)) {
            entries.push({
                path: projectPath,
                content: await (0, promises_1.readFile)(projectPath, 'utf-8'),
                scope: 'project',
            });
        }
        const localPath = (0, path_1.join)(this.cwd, 'CLAUDE.local.md');
        if ((0, fs_1.existsSync)(localPath)) {
            entries.push({
                path: localPath,
                content: await (0, promises_1.readFile)(localPath, 'utf-8'),
                scope: 'local',
            });
        }
        let currentDir = (0, path_1.dirname)(this.cwd);
        const root = '/';
        while (currentDir && currentDir !== root && currentDir !== process.env.HOME) {
            const parentPath = (0, path_1.join)(currentDir, 'CLAUDE.md');
            if ((0, fs_1.existsSync)(parentPath)) {
                entries.push({
                    path: parentPath,
                    content: await (0, promises_1.readFile)(parentPath, 'utf-8'),
                    scope: 'parent',
                });
            }
            currentDir = (0, path_1.dirname)(currentDir);
        }
        return entries;
    }
    getSessionContext() {
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
    checkIsGitRepo() {
        try {
            (0, child_process_1.execSync)('git rev-parse --git-dir', { cwd: this.cwd, stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    }
    getGitStatus() {
        try {
            const branch = (0, child_process_1.execSync)('git branch --show-current', { cwd: this.cwd, encoding: 'utf-8' }).trim() || 'main';
            const mainBranch = (0, child_process_1.execSync)('git config init.defaultBranch', { cwd: this.cwd, encoding: 'utf-8' }).trim() || 'main';
            const status = (0, child_process_1.execSync)('git status --porcelain', { cwd: this.cwd, encoding: 'utf-8' }).trim();
            const modified = [];
            const deleted = [];
            const untracked = [];
            for (const line of status.split('\n')) {
                if (!line)
                    continue;
                const statusChar = line.substring(0, 2);
                const file = line.substring(3);
                if (statusChar.includes('M') || statusChar === ' M')
                    modified.push(file);
                if (statusChar.includes('D') || statusChar === ' D')
                    deleted.push(file);
                if (statusChar === '??')
                    untracked.push(file);
            }
            const recentCommits = (0, child_process_1.execSync)('git log -5 --oneline', { cwd: this.cwd, encoding: 'utf-8' })
                .trim()
                .split('\n')
                .filter(Boolean);
            return { branch, mainBranch, modified, deleted, untracked, recentCommits };
        }
        catch {
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
    formatContextMessage(ctx) {
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
    formatClaudeMdMessage(entries) {
        if (entries.length === 0)
            return '';
        const sections = entries.map(entry => {
            const scope = entry.scope.toUpperCase();
            return `<system-reminder>\n# Project instructions (${scope})\n${entry.content}\n</system-reminder>`;
        });
        return sections.join('\n\n');
    }
}
exports.ContextAssembler = ContextAssembler;
//# sourceMappingURL=context.js.map