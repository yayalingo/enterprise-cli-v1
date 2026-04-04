import type { ToolDefinition, ToolResult } from '../agent/types';

export interface MCPConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  tools: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  webhookPath: string;
}

export class MCPClient {
  private configs: Map<string, MCPConfig> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  async addServer(config: MCPConfig): Promise<void> {
    this.configs.set(config.name, config);
    
    try {
      const response = await fetch(`${config.baseUrl}/tools`, {
        headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
      });
      
      if (response.ok) {
        const toolList = await response.json() as any[];
        for (const tool of toolList) {
          this.tools.set(`${config.name}__${tool.name}`, {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            webhookPath: tool.webhookPath || `/webhook/${tool.name}`,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
    }
  }

  getToolDefinitions(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    
    for (const [fullName, tool] of this.tools) {
      const config = this.configs.get(tool.name.split('__')[0]);
      defs.push({
        name: fullName,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
        },
      });
    }
    
    return defs;
  }

  async executeTool(fullName: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(fullName);
    if (!tool) {
      return { tool_use_id: '', content: `Tool ${fullName} not found`, is_error: true };
    }

    const configName = fullName.split('__')[0];
    const config = this.configs.get(configName);
    
    if (!config) {
      return { tool_use_id: '', content: `MCP server ${configName} not found`, is_error: true };
    }

    try {
      const response = await fetch(`${config.baseUrl}${tool.webhookPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        return { tool_use_id: '', content: `MCP call failed: ${response.statusText}`, is_error: true };
      }

      const result = await response.json();
      return { tool_use_id: '', content: JSON.stringify(result) };
    } catch (error: any) {
      return { tool_use_id: '', content: `Error executing tool: ${error.message}`, is_error: true };
    }
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listServers(): string[] {
    return Array.from(this.configs.keys());
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}
