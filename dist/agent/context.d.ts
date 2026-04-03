import type { ClaudeMdEntry, SessionContext } from './types';
export declare class ContextAssembler {
    private cwd;
    constructor(cwd: string);
    loadClaudeMdFiles(): Promise<ClaudeMdEntry[]>;
    getSessionContext(): SessionContext;
    private checkIsGitRepo;
    private getGitStatus;
    formatContextMessage(ctx: SessionContext): string;
    formatClaudeMdMessage(entries: ClaudeMdEntry[]): string;
}
//# sourceMappingURL=context.d.ts.map