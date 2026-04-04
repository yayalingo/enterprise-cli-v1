import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ToolDefinition, ToolResult } from '../agent/types';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export class TaskTool {
  private cwd: string;
  private tasksDir: string;
  private tasks: Map<string, Task> = new Map();

  constructor(cwd: string) {
    this.cwd = cwd;
    this.tasksDir = join(cwd, '.enterprise-cli', 'tasks');
    this.loadTasks();
  }

  get definition(): ToolDefinition {
    return {
      name: 'Task',
      description: 'Create, update, list, or complete tasks. Use to track progress on multi-step implementations.',
      input_schema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'update', 'complete', 'get'],
            description: 'Action to perform',
          },
          title: {
            type: 'string',
            description: 'Task title (for create)',
          },
          description: {
            type: 'string',
            description: 'Task description',
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'Task priority',
          },
          id: {
            type: 'string',
            description: 'Task ID (for update/complete/get)',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed'],
            description: 'Task status (for update)',
          },
        },
        required: ['action'],
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const action = input.action as string;

    switch (action) {
      case 'create':
        return this.createTask(input);
      case 'list':
        return this.listTasks(input);
      case 'update':
        return this.updateTask(input);
      case 'complete':
        return this.completeTask(input);
      case 'get':
        return this.getTask(input);
      default:
        return { tool_use_id: '', content: `Unknown action: ${action}`, is_error: true };
    }
  }

  private async loadTasks(): Promise<void> {
    if (!existsSync(this.tasksDir)) return;
    try {
      const files = await readFile(join(this.tasksDir, 'tasks.json'), 'utf-8');
      const tasks: Task[] = JSON.parse(files);
      for (const task of tasks) {
        this.tasks.set(task.id, task);
      }
    } catch {}
  }

  private async saveTasks(): Promise<void> {
    await mkdir(this.tasksDir, { recursive: true });
    const tasks = Array.from(this.tasks.values());
    await writeFile(join(this.tasksDir, 'tasks.json'), JSON.stringify(tasks, null, 2));
  }

  private async createTask(input: Record<string, unknown>): Promise<ToolResult> {
    const title = input.title as string;
    const description = input.description as string || '';
    const priority = (input.priority as 'high' | 'medium' | 'low') || 'medium';

    if (!title) {
      return { tool_use_id: '', content: 'Error: title is required', is_error: true };
    }

    const id = `task_${Date.now()}`;
    const task: Task = {
      id,
      title,
      description,
      status: 'pending',
      priority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(id, task);
    await this.saveTasks();

    return {
      tool_use_id: '',
      content: `Created task ${id}: ${title} (${priority})`,
    };
  }

  private async listTasks(input: Record<string, unknown>): Promise<ToolResult> {
    const status = input.status as string;
    let tasks = Array.from(this.tasks.values());

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    if (tasks.length === 0) {
      return { tool_use_id: '', content: 'No tasks found' };
    }

    const formatted = tasks
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .map(t => `[${t.status}] ${t.id}: ${t.title} (${t.priority})`)
      .join('\n');

    return { tool_use_id: '', content: formatted };
  }

  private async updateTask(input: Record<string, unknown>): Promise<ToolResult> {
    const id = input.id as string;
    const title = input.title as string;
    const description = input.description as string;
    const status = input.status as 'pending' | 'in_progress' | 'completed';
    const priority = input.priority as 'high' | 'medium' | 'low';

    const task = this.tasks.get(id);
    if (!task) {
      return { tool_use_id: '', content: `Task ${id} not found`, is_error: true };
    }

    if (title) task.title = title;
    if (description) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    task.updatedAt = new Date().toISOString();

    await this.saveTasks();
    return { tool_use_id: '', content: `Updated task ${id}` };
  }

  private async completeTask(input: Record<string, unknown>): Promise<ToolResult> {
    const id = input.id as string;
    const task = this.tasks.get(id);

    if (!task) {
      return { tool_use_id: '', content: `Task ${id} not found`, is_error: true };
    }

    task.status = 'completed';
    task.updatedAt = new Date().toISOString();
    await this.saveTasks();

    return { tool_use_id: '', content: `Completed task ${id}: ${task.title}` };
  }

  private async getTask(input: Record<string, unknown>): Promise<ToolResult> {
    const id = input.id as string;
    const task = this.tasks.get(id);

    if (!task) {
      return { tool_use_id: '', content: `Task ${id} not found`, is_error: true };
    }

    return {
      tool_use_id: '',
      content: `Task: ${task.title}\nDescription: ${task.description}\nStatus: ${task.status}\nPriority: ${task.priority}\nCreated: ${task.createdAt}\nUpdated: ${task.updatedAt}`,
    };
  }
}
