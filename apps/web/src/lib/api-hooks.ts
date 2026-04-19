/**
 * ══════════════════════════════════════════════════════════════
 * React Query Hooks Layer — MIGRATION IN PROGRESS
 * ══════════════════════════════════════════════════════════════
 *
 * These hooks wrap the api-client with React Query for automatic
 * caching, refetching, and mutation invalidation.
 *
 * Current Status:
 * - Hooks are fully defined and typed
 * - Pages are being migrated from direct api.get() calls
 * - Priority migration: Monitor, Canary, Workbench pages
 *
 * Usage: import { useExecutionList, useExecutionStats } from '@/lib/api-hooks';
 * ══════════════════════════════════════════════════════════════
 */

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { api } from './api-client';
import {
  ExecutionSessionDto,
  PackDto,
  PackVersionDto,
  InstallationDto,
  ConnectorDto,
  AuditLogDto,
  PolicyDto,
  PaginatedResponse,
  CreateExecutionRequest,
  PackImportRequest,
  CreateReplayDatasetRequest,
  StartReplayRunRequest,
  CreateShadowConfigRequest,
  CreateCanaryDeploymentRequest,
  PromotionRequest,
  MarkGoldenRequest,
} from '@metis/types';

// ══════════════════════════════════════════
// Query Key Factory
// ══════════════════════════════════════════

const queryKeys = {
  // Executions
  executions: () => ['executions'],
  executionList: (filters?: unknown) => [...queryKeys.executions(), 'list', filters],
  executionStats: () => [...queryKeys.executions(), 'stats'],
  execution: (id: string) => [...queryKeys.executions(), id],
  executionTrace: (id: string) => [...queryKeys.execution(id), 'trace'],

  // Packs
  packs: () => ['packs'],
  packList: (filters?: unknown) => [...queryKeys.packs(), 'list', filters],
  pack: (id: string) => [...queryKeys.packs(), id],
  packVersions: (packId: string) => [...queryKeys.pack(packId), 'versions'],

  // Installations
  installations: () => ['installations'],
  installationList: (filters?: unknown) => [...queryKeys.installations(), 'list', filters],

  // Connectors
  connectors: () => ['connectors'],
  connectorList: (filters?: unknown) => [...queryKeys.connectors(), 'list', filters],
  connector: (id: string) => [...queryKeys.connectors(), id],
  connectorTools: (id: string) => [...queryKeys.connector(id), 'tools'],

  // Governance
  auditLogs: () => ['governance', 'audit-logs'],
  auditLogList: (filters?: unknown) => [...queryKeys.auditLogs(), 'list', filters],
  policies: () => ['governance', 'policies'],
  governanceOverview: () => ['governance', 'overview'],
  callLogs: (opts?: unknown) => ['governance', 'call-logs', opts],
  callStats: (connectorId?: string, period?: number) => ['governance', 'call-stats', connectorId, period],

  // Knowledge
  knowledge: () => ['knowledge'],
  artifacts: (filters?: unknown) => [...queryKeys.knowledge(), 'artifacts', filters],

  // Release: Replay
  replay: () => ['release', 'replay'],
  replayDatasets: (page?: number) => [...queryKeys.replay(), 'datasets', page],
  replayDataset: (id: string) => [...queryKeys.replay(), 'datasets', id],
  replayRuns: (filters?: unknown) => [...queryKeys.replay(), 'runs', filters],
  replayRun: (id: string) => [...queryKeys.replay(), 'runs', id],

  // Release: Shadow
  shadow: () => ['release', 'shadow'],
  shadowConfigs: (page?: number) => [...queryKeys.shadow(), 'configs', page],
  shadowConfig: (id: string) => [...queryKeys.shadow(), 'configs', id],
  shadowConfigMetrics: (id: string) => [...queryKeys.shadowConfig(id), 'metrics'],
  shadowPairs: (filters?: unknown) => [...queryKeys.shadow(), 'pairs', filters],

  // Release: Canary
  canary: () => ['release', 'canary'],
  canaryList: (filters?: unknown) => [...queryKeys.canary(), 'list', filters],
  canaryDeployment: (id: string) => [...queryKeys.canary(), id],

  // Release: Promotions
  promotions: () => ['release', 'promotions'],
  promotionList: (filters?: unknown) => [...queryKeys.promotions(), 'list', filters],
  promotion: (id: string) => [...queryKeys.promotions(), id],

  // Tenant
  tenant: () => ['tenants'],
  tenantContext: () => [...queryKeys.tenant(), 'current'],
  tenantMembers: () => [...queryKeys.tenantContext(), 'members'],

  // Auth
  auth: () => ['auth'],
};

// ══════════════════════════════════════════
// ── Execution Hooks ──
// ══════════════════════════════════════════

export function useExecutions(
  filters?: { status?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<ExecutionSessionDto>, Error> {
  return useQuery({
    queryKey: queryKeys.executionList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<ExecutionSessionDto>>(
        `/executions${qs ? '?' + qs : ''}`,
      );
    },
    refetchInterval: 10000,
  });
}

export function useExecutionStats(): UseQueryResult<
  Record<string, number>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.executionStats(),
    queryFn: () => api.get<Record<string, number>>('/executions/stats'),
    refetchInterval: 10000,
  });
}

export function useExecution(
  id: string | null,
): UseQueryResult<ExecutionSessionDto, Error> {
  return useQuery({
    queryKey: queryKeys.execution(id || ''),
    queryFn: () => api.get<ExecutionSessionDto>(`/executions/${id}`),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useExecutionTrace(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.executionTrace(id || ''),
    queryFn: () => api.get<Record<string, unknown>>(`/executions/${id}/trace`),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useCreateExecution(): UseMutationResult<
  ExecutionSessionDto,
  Error,
  CreateExecutionRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) => api.post<ExecutionSessionDto>('/executions', req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executionList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.executionStats() });
    },
  });
}

export function useKillExecution(): UseMutationResult<
  void,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<void>(`/executions/${id}/kill`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.execution(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.executionList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.executionStats() });
    },
  });
}

// ══════════════════════════════════════════
// ── Pack Hooks ──
// ══════════════════════════════════════════

export function usePacks(
  filters?: { keyword?: string; status?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<PackDto>, Error> {
  return useQuery({
    queryKey: queryKeys.packList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.keyword) params.append('keyword', filters.keyword);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<PackDto>>(
        `/packs${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function usePack(
  id: string | null,
): UseQueryResult<PackDto, Error> {
  return useQuery({
    queryKey: queryKeys.pack(id || ''),
    queryFn: () => api.get<PackDto>(`/packs/${id}`),
    enabled: !!id,
  });
}

export function usePackVersions(
  packId: string | null,
): UseQueryResult<PaginatedResponse<PackVersionDto>, Error> {
  return useQuery({
    queryKey: queryKeys.packVersions(packId || ''),
    queryFn: () =>
      api.get<PaginatedResponse<PackVersionDto>>(
        `/packs/${packId}/versions`,
      ),
    enabled: !!packId,
  });
}

export function useImportPack(): UseMutationResult<
  PackDto,
  Error,
  PackImportRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<PackDto>('/packs/import', req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.packList() });
    },
  });
}

// ══════════════════════════════════════════
// ── Installation Hooks ──
// ══════════════════════════════════════════

export function useInstallations(): UseQueryResult<
  PaginatedResponse<InstallationDto>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.installations(),
    queryFn: () =>
      api.get<PaginatedResponse<InstallationDto>>(
        '/installations',
      ),
  });
}

export function useInstallPack(): UseMutationResult<
  InstallationDto,
  Error,
  { packVersionId: string; config?: Record<string, unknown> }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<InstallationDto>('/installations', req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.installations() });
    },
  });
}

export function useUninstallPack(): UseMutationResult<
  void,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.delete<void>(`/installations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.installations() });
    },
  });
}

// ══════════════════════════════════════════
// ── Connector Hooks ──
// ══════════════════════════════════════════

export function useConnectors(): UseQueryResult<
  PaginatedResponse<ConnectorDto>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.connectorList(),
    queryFn: () =>
      api.get<PaginatedResponse<ConnectorDto>>(
        '/connectors',
      ),
  });
}

export function useConnector(
  id: string | null,
): UseQueryResult<ConnectorDto, Error> {
  return useQuery({
    queryKey: queryKeys.connector(id || ''),
    queryFn: () => api.get<ConnectorDto>(`/connectors/${id}`),
    enabled: !!id,
  });
}

export function useCreateConnector(): UseMutationResult<
  ConnectorDto,
  Error,
  Record<string, unknown>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<ConnectorDto>('/connectors', req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connectorList() });
    },
  });
}

export function useUpdateConnector(): UseMutationResult<
  ConnectorDto,
  Error,
  { id: string; data: Record<string, unknown> }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) =>
      api.put<ConnectorDto>(`/connectors/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connector(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.connectorList() });
    },
  });
}

export function useDeleteConnector(): UseMutationResult<
  void,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.delete<void>(`/connectors/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connector(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.connectorList() });
    },
  });
}

export function useHealthCheck(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  return useMutation({
    mutationFn: (id) =>
      api.post<Record<string, unknown>>(
        `/connectors/${id}/health-check`,
      ),
  });
}

// ── Connector Lifecycle ──
export function useStartConnector(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<Record<string, unknown>>(`/connectors/${id}/start`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.connectorList() }),
  });
}

export function useStopConnector(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<Record<string, unknown>>(`/connectors/${id}/stop`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.connectorList() }),
  });
}

export function useRestartConnector(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<Record<string, unknown>>(`/connectors/${id}/restart`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.connectorList() }),
  });
}

// ── Connector Schema & Test ──
export function useDiscoverSchema(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  return useMutation({
    mutationFn: (id) =>
      api.post<Record<string, unknown>>(`/connectors/${id}/discover`, {}),
  });
}

export function useConnectorTools(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.connectorTools(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(`/connectors/${id}/tools`),
    enabled: !!id,
  });
}

export function useTestConnector(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  return useMutation({
    mutationFn: (id) =>
      api.post<Record<string, unknown>>(`/connectors/${id}/test`, {}),
  });
}

// ══════════════════════════════════════════
// ── Governance Hooks ──
// ══════════════════════════════════════════

export function useAuditLogs(
  filters?: { action?: string; correlationId?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<AuditLogDto>, Error> {
  return useQuery({
    queryKey: queryKeys.auditLogList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.action) params.append('action', filters.action);
      if (filters?.correlationId) params.append('correlationId', filters.correlationId);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<AuditLogDto>>(
        `/governance/audit-logs${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function usePolicies(): UseQueryResult<
  PaginatedResponse<PolicyDto>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.policies(),
    queryFn: () =>
      api.get<PaginatedResponse<PolicyDto>>(
        '/governance/policies',
      ),
  });
}

export function useGovernanceOverview(): UseQueryResult<
  Record<string, unknown>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.governanceOverview(),
    queryFn: () =>
      api.get<Record<string, unknown>>('/governance/overview'),
    refetchInterval: 30000,
  });
}

export function useCallLogs(
  opts?: { connectorId?: string; success?: boolean; limit?: number; offset?: number },
): UseQueryResult<Record<string, unknown>, Error> {
  const params = new URLSearchParams();
  if (opts?.connectorId) params.set('connectorId', opts.connectorId);
  if (opts?.success !== undefined) params.set('success', String(opts.success));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.callLogs(opts),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/governance/call-logs${qs ? '?' + qs : ''}`,
      ),
  });
}

export function useCallStats(
  connectorId?: string,
  period?: number,
): UseQueryResult<Record<string, unknown>, Error> {
  const params = new URLSearchParams();
  if (connectorId) params.set('connectorId', connectorId);
  if (period) params.set('period', String(period));
  const qs = params.toString();
  return useQuery({
    queryKey: queryKeys.callStats(connectorId, period),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/governance/call-stats${qs ? '?' + qs : ''}`,
      ),
    refetchInterval: 30000,
  });
}

// ══════════════════════════════════════════
// ── Knowledge Hooks ──
// ══════════════════════════════════════════

export function useKnowledgeArtifacts(
  filters?: { keyword?: string; type?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.artifacts(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.keyword) params.append('keyword', filters.keyword);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/knowledge/artifacts${qs ? '?' + qs : ''}`,
      );
    },
  });
}

// ══════════════════════════════════════════
// ── Release: Replay Hooks ──
// ══════════════════════════════════════════

export function useReplayDatasets(
  page?: number,
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.replayDatasets(page),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page) params.append('page', String(page));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/release/replay/datasets${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function useReplayDataset(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.replayDataset(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/release/replay/datasets/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateReplayDataset(): UseMutationResult<
  Record<string, unknown>,
  Error,
  CreateReplayDatasetRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<Record<string, unknown>>(
        '/release/replay/datasets',
        req,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.replayDatasets() });
    },
  });
}

export function useStartReplayRun(): UseMutationResult<
  Record<string, unknown>,
  Error,
  StartReplayRunRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<Record<string, unknown>>(
        '/release/replay/runs',
        req,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.replayRuns() });
    },
  });
}

export function useReplayRuns(
  filters?: { status?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.replayRuns(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/release/replay/runs${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function useReplayRun(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.replayRun(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/release/replay/runs/${id}`,
      ),
    enabled: !!id,
  });
}

export function useMarkGolden(): UseMutationResult<
  void,
  Error,
  { datasetId: string; body: MarkGoldenRequest }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, body }) =>
      api.post<void>(
        `/release/replay/datasets/${datasetId}/golden`,
        body,
      ),
    onSuccess: (_, { datasetId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.replayDataset(datasetId) });
    },
  });
}

// ══════════════════════════════════════════
// ── Release: Shadow Hooks ──
// ══════════════════════════════════════════

export function useShadowConfigs(
  page?: number,
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.shadowConfigs(page),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page) params.append('page', String(page));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/release/shadow/configs${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function useShadowConfig(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.shadowConfig(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/release/shadow/configs/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateShadowConfig(): UseMutationResult<
  Record<string, unknown>,
  Error,
  CreateShadowConfigRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<Record<string, unknown>>(
        '/release/shadow/configs',
        req,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shadowConfigs() });
    },
  });
}

export function useToggleShadowConfig(): UseMutationResult<
  Record<string, unknown>,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.put<Record<string, unknown>>(
        `/release/shadow/configs/${id}/toggle`,
      ),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shadowConfig(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shadowConfigs() });
    },
  });
}

export function useShadowConfigMetrics(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.shadowConfigMetrics(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/release/shadow/configs/${id}/metrics`,
      ),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useShadowPairs(
  filters?: { configId?: string; status?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.shadowPairs(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.configId) params.append('configId', filters.configId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/release/shadow/pairs${qs ? '?' + qs : ''}`,
      );
    },
  });
}

// ══════════════════════════════════════════
// ── Release: Canary Hooks ──
// ══════════════════════════════════════════

export function useCanaryDeployments(
  filters?: { status?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.canaryList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/release/canary${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function useCanaryDeployment(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.canaryDeployment(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/release/canary/${id}`,
      ),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useCreateCanaryDeployment(): UseMutationResult<
  Record<string, unknown>,
  Error,
  CreateCanaryDeploymentRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<Record<string, unknown>>(
        '/release/canary',
        req,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.canaryList() });
    },
  });
}

export function useStartCanary(): UseMutationResult<
  void,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<void>(
        `/release/canary/${id}/start`,
      ),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.canaryDeployment(id) });
    },
  });
}

export function usePromoteCanary(): UseMutationResult<
  void,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<void>(
        `/release/canary/${id}/promote`,
      ),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.canaryDeployment(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.canaryList() });
    },
  });
}

export function useRollbackCanary(): UseMutationResult<
  void,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post<void>(
        `/release/canary/${id}/rollback`,
      ),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.canaryDeployment(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.canaryList() });
    },
  });
}

// ══════════════════════════════════════════
// ── Release: Promotions Hooks ──
// ══════════════════════════════════════════

export function usePromotions(
  filters?: { status?: string; page?: number; pageSize?: number },
): UseQueryResult<PaginatedResponse<Record<string, unknown>>, Error> {
  return useQuery({
    queryKey: queryKeys.promotionList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return api.get<PaginatedResponse<Record<string, unknown>>>(
        `/release/promotions${qs ? '?' + qs : ''}`,
      );
    },
  });
}

export function usePromotion(
  id: string | null,
): UseQueryResult<Record<string, unknown>, Error> {
  return useQuery({
    queryKey: queryKeys.promotion(id || ''),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        `/release/promotions/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreatePromotion(): UseMutationResult<
  Record<string, unknown>,
  Error,
  PromotionRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<Record<string, unknown>>(
        '/release/promotions',
        req,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotionList() });
    },
  });
}

// ══════════════════════════════════════════
// ── Tenant Hooks ──
// ══════════════════════════════════════════

export function useTenantContext(): UseQueryResult<
  Record<string, unknown>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.tenantContext(),
    queryFn: () =>
      api.get<Record<string, unknown>>(
        '/tenants/current',
      ),
  });
}

export function useTenantMembers(): UseQueryResult<
  PaginatedResponse<Record<string, unknown>>,
  Error
> {
  return useQuery({
    queryKey: queryKeys.tenantMembers(),
    queryFn: () =>
      api.get<PaginatedResponse<Record<string, unknown>>>(
        '/tenants/current/members',
      ),
  });
}

// ══════════════════════════════════════════
// ── Auth Hooks ──
// ══════════════════════════════════════════

export function useLogin(): UseMutationResult<
  Record<string, unknown>,
  Error,
  { email: string; password: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req) =>
      api.post<Record<string, unknown>>(
        '/auth/login',
        req,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantContext() });
    },
  });
}
