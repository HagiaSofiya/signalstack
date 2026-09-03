import type {
  AgentRun,
  AgentStep,
  CreateAgentRunInput,
  CreateDatasetInput,
  CreateProjectInput,
  Dataset,
  Project,
} from "@signalstack/schemas";

const now = () => new Date().toISOString();

export class InMemoryStore {
  private readonly projects: Project[] = [];
  private readonly datasets: Dataset[] = [];
  private readonly agentRuns: AgentRun[] = [];
  private readonly agentSteps: AgentStep[] = [];

  listProjects(): Project[] {
    return [...this.projects];
  }

  getProject(id: string): Project | undefined {
    return this.projects.find((project) => project.id === id);
  }

  createProject(input: CreateProjectInput): Project {
    const project: Project = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? null,
      createdAt: now(),
    };
    this.projects.push(project);
    return project;
  }

  updateProject(id: string, input: Partial<CreateProjectInput>): Project | undefined {
    const project = this.getProject(id);
    if (!project) return undefined;
    Object.assign(project, input);
    return project;
  }

  deleteProject(id: string): boolean {
    const index = this.projects.findIndex((project) => project.id === id);
    if (index === -1) return false;
    this.projects.splice(index, 1);
    return true;
  }

  listDatasets(projectId?: string): Dataset[] {
    return this.datasets.filter((dataset) => !projectId || dataset.projectId === projectId);
  }

  createDataset(input: CreateDatasetInput): Dataset {
    const dataset: Dataset = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      filename: input.filename,
      storagePath: input.storagePath,
      rowCount: input.rowCount ?? null,
      createdAt: now(),
    };
    this.datasets.push(dataset);
    return dataset;
  }

  getDataset(id: string): Dataset | undefined {
    return this.datasets.find((dataset) => dataset.id === id);
  }

  updateDataset(id: string, input: Partial<Omit<CreateDatasetInput, "projectId">>): Dataset | undefined {
    const dataset = this.getDataset(id);
    if (!dataset) return undefined;
    Object.assign(dataset, input);
    return dataset;
  }

  deleteDataset(id: string): boolean {
    const index = this.datasets.findIndex((dataset) => dataset.id === id);
    if (index === -1) return false;
    this.datasets.splice(index, 1);
    return true;
  }

  listAgentRuns(projectId?: string): AgentRun[] {
    return this.agentRuns.filter((run) => !projectId || run.projectId === projectId);
  }

  createAgentRun(input: CreateAgentRunInput): AgentRun {
    const run: AgentRun = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      datasetId: input.datasetId ?? null,
      question: input.question,
      status: "queued",
      provider: null,
      model: input.model ?? null,
      tokenUsage: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      estimatedCost: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      createdAt: now(),
    };
    this.agentRuns.push(run);
    return run;
  }

  getAgentRun(id: string): AgentRun | undefined {
    return this.agentRuns.find((run) => run.id === id);
  }

  updateAgentRun(id: string, input: Partial<Pick<AgentRun, "status" | "model" | "tokenUsage" | "estimatedCost">>): AgentRun | undefined {
    const run = this.getAgentRun(id);
    if (!run) return undefined;
    Object.assign(run, input);
    return run;
  }

  deleteAgentRun(id: string): boolean {
    const index = this.agentRuns.findIndex((run) => run.id === id);
    if (index === -1) return false;
    this.agentRuns.splice(index, 1);
    return true;
  }

  listAgentSteps(agentRunId: string): AgentStep[] {
    return this.agentSteps.filter((step) => step.agentRunId === agentRunId);
  }
}

export const store = new InMemoryStore();
