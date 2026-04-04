import express from 'express';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { 
  Workflow, 
  WorkflowDesigner, 
  WorkflowExecutor,
  DocumentIngestion,
  WorkflowDesignRequest 
} from './index';

const workflowsDir = join(homedir(), '.enterprise-cli', 'workflows');

export class WorkflowAPI {
  private app: express.Application;
  private designer: WorkflowDesigner;
  private executor: WorkflowExecutor;
  private docs: DocumentIngestion;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.designer = new WorkflowDesigner();
    this.executor = new WorkflowExecutor();
    this.docs = new DocumentIngestion();
    this.setupRoutes();
  }

  private async initialize(): Promise<void> {
    await mkdir(workflowsDir, { recursive: true });
    await this.executor.initialize();
    await this.docs.initialize();
  }

  private setupRoutes(): void {
    this.app.post('/api/workflows/design', async (req, res) => {
      try {
        const request: WorkflowDesignRequest = req.body;
        const result = await this.designer.design(request);
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/api/workflows/nodes', (req, res) => {
      res.json({
        nodes: this.designer.getAvailableNodes(),
        categories: this.designer.getCategories(),
      });
    });

    this.app.post('/api/workflows', async (req, res) => {
      try {
        const workflow: Workflow = req.body;
        workflow.id = workflow.id || `wf_${Date.now()}`;
        workflow.createdAt = new Date().toISOString();
        workflow.updatedAt = new Date().toISOString();

        const path = join(workflowsDir, `${workflow.id}.json`);
        await writeFile(path, JSON.stringify(workflow, null, 2));
        res.json(workflow);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/api/workflows', async (req, res) => {
      try {
        const files = await import('fs').then(fs => fs.promises.readdir(workflowsDir));
        const workflows: Workflow[] = [];
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await readFile(join(workflowsDir, file), 'utf-8');
            workflows.push(JSON.parse(content));
          }
        }

        res.json(workflows);
      } catch (e: any) {
        res.json([]);
      }
    });

    this.app.get('/api/workflows/:id', async (req, res) => {
      try {
        const path = join(workflowsDir, `${req.params.id}.json`);
        if (!existsSync(path)) {
          return res.status(404).json({ error: 'Not found' });
        }
        const content = await readFile(path, 'utf-8');
        res.json(JSON.parse(content));
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/api/workflows/:id/execute', async (req, res) => {
      try {
        const path = join(workflowsDir, `${req.params.id}.json`);
        if (!existsSync(path)) {
          return res.status(404).json({ error: 'Not found' });
        }
        
        const content = await readFile(path, 'utf-8');
        const workflow: Workflow = JSON.parse(content);
        const input = req.body || {};

        const execution = await this.executor.execute(workflow, input);
        res.json(execution);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/api/workflows/:id/executions', async (req, res) => {
      try {
        const executions = await this.executor.listExecutions(req.params.id);
        res.json(executions);
      } catch (e: any) {
        res.json([]);
      }
    });

    this.app.post('/api/workflows/docs/ingest', async (req, res) => {
      try {
        const { filePath, directory } = req.body;
        
        if (directory) {
          const docs = await this.docs.ingestDirectory(directory);
          res.json({ ingested: docs.length, documents: docs });
        } else if (filePath) {
          const doc = await this.docs.ingestFile(filePath);
          res.json(doc);
        } else {
          res.status(400).json({ error: 'filePath or directory required' });
        }
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    this.app.get('/api/workflows/docs', async (req, res) => {
      try {
        const docs = await this.docs.list();
        res.json(docs);
      } catch (e: any) {
        res.json([]);
      }
    });

    this.app.get('/api/workflows/docs/search', async (req, res) => {
      try {
        const query = req.query.q as string;
        if (!query) {
          return res.json([]);
        }
        const docs = await this.docs.search(query);
        res.json(docs);
      } catch (e: any) {
        res.json([]);
      }
    });
  }

  start(port: number): void {
    this.initialize().then(() => {
      this.app.listen(port, () => {
        console.log(`Workflow API: http://localhost:${port}`);
      });
    });
  }
}
