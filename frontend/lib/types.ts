export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  authProvider: 'local' | 'google';
  role: 'user' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
}

export type RepositoryStatus = 'pending' | 'cloning' | 'analyzing' | 'completed' | 'failed';

export interface Repository {
  _id: string;
  owner: string;
  githubUrl: string;
  fullName: string;
  name: string;
  ownerLogin: string;
  defaultBranch?: string;
  isPrivate: boolean;
  description?: string;
  status: RepositoryStatus;
  latestAnalysisJob?: string;
  latestMetricsSnapshot?: MetricsSnapshot | string;
  analysisCount: number;
  lastAnalyzedAt?: string;
  createdAt: string;
}

export type JobStage =
  | 'queued'
  | 'cloning'
  | 'discovering_files'
  | 'parsing_ast'
  | 'building_graph'
  | 'detecting_cycles'
  | 'computing_complexity'
  | 'scoring_health'
  | 'completed'
  | 'failed';

export interface AnalysisJob {
  _id: string;
  repository: string;
  user: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  stage: JobStage;
  progressPercent: number;
  progressMessage: string;
  filesDiscovered: number;
  filesParsed: number;
  filesFailed: number;
  error?: { message: string };
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface FunctionMetric {
  name: string;
  startLine?: number;
  endLine?: number;
  cyclomaticComplexity: number;
  paramCount: number;
  isAsync: boolean;
  isExported: boolean;
}

export interface FileNode {
  _id: string;
  filePath: string;
  fileName: string;
  extension: string;
  language: 'javascript' | 'typescript' | 'python';
  linesOfCode: number;
  fileComplexity: number;
  averageComplexity: number;
  maxComplexity: number;
  inCycle: boolean;
  isEntryPoint: boolean;
  functions?: FunctionMetric[] | { length: number };
  parseError?: string;
}

export interface DependencyEdge {
  _id: string;
  sourcePath: string;
  targetPath: string;
  importedNames: string[];
  isPartOfCycle: boolean;
  cycleId?: string;
}

export interface ScoreBreakdown {
  complexityScore: number;
  cycleScore: number;
  sizeScore: number;
  structureScore: number;
}

export interface MetricsSnapshot {
  _id: string;
  totalFiles: number;
  totalLinesOfCode: number;
  totalFunctions: number;
  averageComplexity: number;
  maxComplexity: number;
  highComplexityFileCount: number;
  totalDependencyEdges: number;
  circularDependencyCount: number;
  filesInCycles: number;
  languageBreakdown: Record<string, number>;
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  scoreBreakdown: ScoreBreakdown;
  topComplexFiles: { filePath: string; complexity: number }[];
  createdAt: string;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  contextFilePath?: string;
  createdAt: string;
}

export interface AIConversation {
  _id: string;
  repository: string;
  type: 'chat' | 'file_explain' | 'readme_generate' | 'cycle_explain';
  title: string;
  messages: AIMessage[];
  lastMessageAt: string;
}

export interface CycleEdgeDetail {
  sourcePath: string;
  targetPath: string;
  importedNames: string[];
}

export interface CycleFileFact {
  filePath: string;
  linesOfCode: number | null;
  averageComplexity: number | null;
  maxComplexity: number | null;
  fileComplexity: number | null;
}

export interface CycleChain {
  cycleId: string;
  files: string[];
  length: number;
  edges: CycleEdgeDetail[];
  fileFacts: CycleFileFact[];
}

export interface MetricsHistoryPoint {
  _id: string;
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  circularDependencyCount: number;
  averageComplexity: number;
  totalFiles: number;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
}
