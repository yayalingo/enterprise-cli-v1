import type { PermissionMode, PermissionConfig } from '../agent/types';
export declare class PermissionGate {
    private config;
    constructor(config: PermissionConfig);
    setMode(mode: PermissionMode): void;
    getMode(): PermissionMode;
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