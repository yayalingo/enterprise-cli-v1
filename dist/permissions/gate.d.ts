import type { PermissionMode, PermissionConfig } from '../agent/types';
export declare class PermissionGate {
    private config;
    private protectedPaths;
    constructor(config: PermissionConfig, protectedPaths?: string[]);
    setMode(mode: PermissionMode): void;
    getMode(): PermissionMode;
    canAccessPath(path: string): {
        allowed: boolean;
        reason?: string;
    };
    canUseTool(toolName: string): {
        allowed: boolean;
        reason?: string;
    };
    private matchesPattern;
    getModeDescription(): string;
    static getAvailableModes(): PermissionMode[];
    static getModeDescription(mode: PermissionMode): string;
}
//# sourceMappingURL=gate.d.ts.map