import { ToolRegistry, ReadTool, GlobTool, EditTool, WriteTool, BashTool } from '../src/tools';

describe('ToolRegistry', () => {
  const cwd = process.cwd();

  beforeEach(() => {
  });

  test('should register all core tools', () => {
    const registry = new ToolRegistry(cwd);
    const names = registry.getNames();
    expect(names).toContain('Read');
    expect(names).toContain('Write');
    expect(names).toContain('Edit');
    expect(names).toContain('Bash');
    expect(names).toContain('Glob');
    expect(names).toContain('Grep');
  });

  test('should get tool definitions', () => {
    const registry = new ToolRegistry(cwd);
    const tools = registry.getAll();
    expect(tools.length).toBe(6);
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('description');
    expect(tools[0]).toHaveProperty('input_schema');
  });

  test('should get tool by name', () => {
    const registry = new ToolRegistry(cwd);
    const readTool = registry.get('Read');
    expect(readTool).toBeDefined();
  });

  test('should return undefined for unknown tool', () => {
    const registry = new ToolRegistry(cwd);
    const unknownTool = registry.get('UnknownTool');
    expect(unknownTool).toBeUndefined();
  });
});

describe('ReadTool', () => {
  const cwd = process.cwd();

  test('should have correct definition', () => {
    const tool = new ReadTool(cwd);
    const def = tool.definition;
    expect(def.name).toBe('Read');
    expect(def.input_schema.properties.filePath).toBeDefined();
  });

  test('should read package.json', async () => {
    const tool = new ReadTool(cwd);
    const pkgPath = `${cwd}/package.json`;
    const result = await tool.execute({ filePath: pkgPath });
    expect(result.content).toContain('"name"');
  });

  test('should return error for missing file', async () => {
    const tool = new ReadTool(cwd);
    const result = await tool.execute({ filePath: '/nonexistent/file.txt' });
    expect(result.is_error).toBe(true);
  });
});

describe('GlobTool', () => {
  const cwd = process.cwd();

  test('should have correct definition', () => {
    const tool = new GlobTool(cwd);
    const def = tool.definition;
    expect(def.name).toBe('Glob');
  });

  test('should find TypeScript files', async () => {
    const tool = new GlobTool(cwd);
    const result = await tool.execute({ pattern: '*.json' });
    expect(result.is_error).toBeFalsy();
  });

  test('should return error for missing pattern', async () => {
    const tool = new GlobTool(cwd);
    const result = await tool.execute({});
    expect(result.is_error).toBe(true);
  });
});

describe('EditTool', () => {
  const cwd = process.cwd();

  test('should have correct definition', () => {
    const tool = new EditTool(cwd);
    const def = tool.definition;
    expect(def.name).toBe('Edit');
  });
});

describe('WriteTool', () => {
  const cwd = process.cwd();

  test('should have correct definition', () => {
    const tool = new WriteTool(cwd);
    const def = tool.definition;
    expect(def.name).toBe('Write');
  });
});

describe('BashTool', () => {
  const cwd = process.cwd();

  test('should have correct definition', () => {
    const tool = new BashTool(cwd);
    const def = tool.definition;
    expect(def.name).toBe('Bash');
  });

  test('should execute pwd command', async () => {
    const tool = new BashTool(cwd);
    const result = await tool.execute({ command: 'pwd' });
    expect(result.is_error).toBeFalsy();
  });

  test('should handle command errors', async () => {
    const tool = new BashTool(cwd);
    const result = await tool.execute({ command: 'exit 1' });
    expect(result.is_error).toBe(true);
  });
});
