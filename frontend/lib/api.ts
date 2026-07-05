import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  AIConversation,
  AIMessage,
  AnalysisJob,
  Architecture,
  ApiResponse,
  CycleChain,
  DependencyEdge,
  FileNode,
  MetricsHistoryPoint,
  MetricsSnapshot,
  Repository,
  User,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('archon_access_token', token);
    else localStorage.removeItem('archon_access_token');
  }
}

export function getAccessToken() {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('archon_access_token');
  }
  return accessToken;
}

const client: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends refreshToken cookie
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try one silent refresh before giving up (refresh token lives in
// an httpOnly cookie set by the backend during login/register/oauth).
let refreshPromise: Promise<string | null> | null = null;

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = client
          .post<ApiResponse<{ accessToken: string }>>('/auth/refresh')
          .then((r) => {
            const token = r.data.data?.accessToken || null;
            setAccessToken(token);
            return token;
          })
          .catch(() => {
            setAccessToken(null);
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as ApiResponse<unknown>)?.message || fallback;
  }
  return fallback;
}

// --- Auth ---
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    client.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    client.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/login', data),
  me: () => client.get<ApiResponse<{ user: User }>>('/auth/me'),
  logout: () => client.post<ApiResponse<null>>('/auth/logout'),
  googleUrl: () => `${API_URL}/auth/google`,
};

// --- Repositories ---
export const repositoryApi = {
  list: () => client.get<ApiResponse<{ repositories: Repository[] }>>('/repositories'),
  get: (id: string) => client.get<ApiResponse<{ repository: Repository }>>(`/repositories/${id}`),
  import: (githubUrl: string) =>
    client.post<ApiResponse<{ repository: Repository; analysisJob: AnalysisJob }>>('/repositories/import', {
      githubUrl,
    }),
  reanalyze: (id: string) =>
    client.post<ApiResponse<{ analysisJob: AnalysisJob }>>(`/repositories/${id}/analyze`),
  delete: (id: string) => client.delete<ApiResponse<null>>(`/repositories/${id}`),
  jobStatus: (jobId: string) => client.get<ApiResponse<{ job: AnalysisJob }>>(`/repositories/jobs/${jobId}`),
  graph: (id: string) =>
    client.get<ApiResponse<{ nodes: FileNode[]; edges: DependencyEdge[] }>>(`/repositories/${id}/graph`),
  metrics: (id: string) =>
    client.get<ApiResponse<{ metrics: MetricsSnapshot }>>(`/repositories/${id}/metrics`),
  metricsHistory: (id: string) =>
    client.get<ApiResponse<{ history: MetricsHistoryPoint[] }>>(`/repositories/${id}/metrics/history`),
  cycles: (id: string) =>
    client.get<ApiResponse<{ cycles: CycleChain[] }>>(`/repositories/${id}/cycles`),
  architecture: (id: string) =>
    client.get<ApiResponse<{ architecture: Architecture }>>(`/repositories/${id}/architecture`),
};

// --- AI (Gemini) ---
export const aiApi = {
  explain: (repositoryId: string, filePath: string) =>
    client.post<ApiResponse<{ explanation: string }>>('/ai/explain', { repositoryId, filePath }),
  chat: (repositoryId: string, message: string) =>
    client.post<ApiResponse<{ message: AIMessage; conversation: Pick<AIConversation, '_id' | 'title' | 'lastMessageAt'> }>>(
      '/ai/chat',
      { repositoryId, message }
    ),
  getChatHistory: (repositoryId: string) =>
    client.get<ApiResponse<{ conversation: AIConversation }>>(`/ai/chat/${repositoryId}`),
  resetChat: (repositoryId: string) => client.delete<ApiResponse<null>>(`/ai/chat/${repositoryId}`),
  generateReadme: (repositoryId: string) =>
    client.post<ApiResponse<{ readme: string; generatedAt: string }>>('/ai/readme', { repositoryId }),
  refineReadme: (repositoryId: string, instruction: string) =>
    client.post<ApiResponse<{ readme: string; generatedAt: string }>>('/ai/readme/refine', {
      repositoryId,
      instruction,
    }),
  explainCycle: (repositoryId: string, cycleId: string) =>
    client.post<ApiResponse<{ explanation: string }>>('/ai/explain-cycle', { repositoryId, cycleId }),
};

export default client;
