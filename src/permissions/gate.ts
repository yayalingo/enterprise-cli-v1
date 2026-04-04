import { homedir } from 'os';
import { dirname, resolve } from 'path';
import type { PermissionMode, PermissionConfig, PermissionRule } from '../agent/types';

const PERMISSION_MODES: Record<PermissionMode, { read: boolean; write: boolean; execute: boolean }> = {
  default: { read: true, write: false, execute: false },
  acceptEdits: { read: true, write: true, execute: false },
  plan: { read: true, write: false, execute: true },
  auto: { read: true, write: true, execute: true },
  bypassPermissions: { read: true, write: true, execute: true },
};

const DEFAULT_PROTECTED_PATHS = [
  '~/.ssh',
  '~/.git-credentials',
  '~/.aws',
  '~/.kube',
  '~/.gnupg',
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '/etc/group',
  '/etc/hosts',
  '/etc/hostname',
];

export class PermissionGate {
  private config: PermissionConfig;
  private protectedPaths: string[];

  constructor(config: PermissionConfig, protectedPaths?: string[]) {
    this.config = config;
    this.protectedPaths = protectedPaths || DEFAULT_PROTECTED_PATHS;
  }

  setMode(mode: PermissionMode): void {
    this.config.mode = mode;
  }

  getMode(): PermissionMode {
    return this.config.mode;
  }

  canAccessPath(path: string): { allowed: boolean; reason?: string } {
    if (this.config.mode === 'bypassPermissions') {
      return { allowed: true };
    }

    const resolved = resolve(path.replace('~', homedir()));
    const homeDir = homedir();

    for (const protectedPath of this.protectedPaths) {
      const expanded = resolve(protectedPath.replace('~', homedir()));
      if (resolved.startsWith(expanded) || resolved === expanded) {
        return {
          allowed: false,
          reason: `Path ${path} is protected`,
        };
      }
    }

    if (resolved === homeDir || resolved === dirname(homeDir)) {
      return {
        allowed: false,
        reason: `Access to home directory is restricted`,
      };
    }

    return { allowed: true };
  }

  canUseTool(toolName: string): { allowed: boolean; reason?: string } {
    const mode = this.config.mode;

    if (mode === 'bypassPermissions') {
      return { allowed: true };
    }

    if (this.config.rules?.deny) {
      for (const pattern of this.config.rules.deny) {
        if (this.matchesPattern(toolName, pattern)) {
          return { allowed: false, reason: `Tool ${toolName} is denied` };
        }
      }
    }

    if (this.config.rules?.allow) {
      let found = false;
      for (const pattern of this.config.rules.allow) {
        if (this.matchesPattern(toolName, pattern)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return { allowed: false, reason: `Tool ${toolName} not in allowed list` };
      }
    }

    const perms = PERMISSION_MODES[mode];
    const isReadTool = ['Read', 'Glob', 'Grep'].includes(toolName);
    const isWriteTool = ['Edit', 'Write'].includes(toolName);
    const isExecuteTool = ['Bash'].includes(toolName);

    if (isReadTool && !perms.read) {
      return { allowed: false, reason: `Mode ${mode} does not allow read operations` };
    }
    if (isWriteTool && !perms.write) {
      return { allowed: false, reason: `Mode ${mode} does not allow write operations` };
    }
    if (isExecuteTool && !perms.execute) {
      return { allowed: false, reason: `Mode ${mode} does not allow execute operations` };
    }

    return { allowed: true };
  }

  private matchesPattern(toolName: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === toolName) return true;

    const baseTool = toolName.replace(/^(mcp__|skill__)/, '');
    if (pattern === baseTool) return true;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(toolName);
  }

  getModeDescription(): string {
    const mode = this.config.mode;
    const perms = PERMISSION_MODES[mode];

    const parts: string[] = [];
    if (perms.read) parts.push('read');
    if (perms.write) parts.push('edit');
    if (perms.execute) parts.push('execute');

    return `${mode}: ${parts.join('+')}`;
  }

  static getAvailableModes(): PermissionMode[] {
    return ['default', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'];
  }

  static getModeDescription(mode: PermissionMode): string {
    const descriptions: Record<PermissionMode, string> = {
      default: 'Read-only - safe for sensitive work',
      acceptEdits: 'Read + edit files, no commands',
      plan: 'Read + plan, no edits',
      auto: 'All actions with safety checks',
      bypassPermissions: 'All actions, no checks - for isolated containers only',
    };
    return descriptions[mode];
  }
}
