"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGate = void 0;
const PERMISSION_MODES = {
    default: { read: true, write: false, execute: false },
    acceptEdits: { read: true, write: true, execute: false },
    plan: { read: true, write: false, execute: true },
    auto: { read: true, write: true, execute: true },
    bypassPermissions: { read: true, write: true, execute: true },
};
class PermissionGate {
    config;
    constructor(config) {
        this.config = config;
    }
    setMode(mode) {
        this.config.mode = mode;
    }
    getMode() {
        return this.config.mode;
    }
    canUseTool(toolName) {
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
    matchesPattern(toolName, pattern) {
        if (pattern === '*')
            return true;
        if (pattern === toolName)
            return true;
        const baseTool = toolName.replace(/^(mcp__|skill__)/, '');
        if (pattern === baseTool)
            return true;
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(toolName);
    }
    getModeDescription() {
        const mode = this.config.mode;
        const perms = PERMISSION_MODES[mode];
        const parts = [];
        if (perms.read)
            parts.push('read');
        if (perms.write)
            parts.push('edit');
        if (perms.execute)
            parts.push('execute');
        return `${mode}: ${parts.join('+')}`;
    }
    static getAvailableModes() {
        return ['default', 'acceptEdits', 'plan', 'auto', 'bypassPermissions'];
    }
    static getModeDescription(mode) {
        const descriptions = {
            default: 'Read-only - safe for sensitive work',
            acceptEdits: 'Read + edit files, no commands',
            plan: 'Read + plan, no edits',
            auto: 'All actions with safety checks',
            bypassPermissions: 'All actions, no checks - for isolated containers only',
        };
        return descriptions[mode];
    }
}
exports.PermissionGate = PermissionGate;
//# sourceMappingURL=gate.js.map