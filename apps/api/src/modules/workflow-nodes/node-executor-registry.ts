/**
 * Node Executor Registry
 *
 * Central registry that maps workflow node types + categories
 * to their concrete executor implementations.
 *
 * Each executor implements the INodeExecutor interface and self-registers
 * on module init. The registry also generates ConnectorRegistry entries
 * so that the frontend can discover available capabilities.
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

// ── Shared interfaces for all executors ──

export interface NodeExecutionInput {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  settings: Record<string, any>;
  /** Output from all previously completed nodes, keyed by nodeId */
  pipelineData: Record<string, NodeExecutionOutput>;
  /** Accumulated text from previous nodes for easy piping */
  previousOutput: string;
  /** Uploaded files (for file-operation input nodes) */
  uploadedFiles?: UploadedFileInfo[];
  /** Tenant + user context */
  tenantId: string;
  userId: string;
  executionSessionId: string;
}

export interface NodeExecutionOutput {
  success: boolean;
  data: Record<string, any>;
  /** Human-readable output text (piped to next node) */
  outputText: string;
  /** Generated files (for file-operation output nodes) */
  generatedFiles?: GeneratedFile[];
  /** Duration in ms */
  durationMs: number;
  error?: string;
}

export interface UploadedFileInfo {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  isArchive: boolean;
  extractedPath?: string;
}

export interface GeneratedFile {
  name: string;
  path: string;
  format: string;
  size: number;
  downloadUrl?: string;
}

/**
 * Interface all node executors must implement.
 */
export interface INodeExecutor {
  /** Unique key for this executor, e.g. 'file-upload', 'ai-analysis-sast' */
  readonly executorKey: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Node types this executor handles */
  readonly handledNodeTypes: string[];
  /** Optional: step categories this handles (e.g. 'input', 'inspection') */
  readonly handledCategories?: string[];
  /** Execute the node */
  execute(input: NodeExecutionInput): Promise<NodeExecutionOutput>;
  /** Get connector metadata for registration */
  getConnectorMetadata(): ConnectorMetadata;
}

export interface ConnectorMetadata {
  key: string;
  name: string;
  type: 'BUILT_IN' | 'MCP_SERVER' | 'REST_API' | 'WEBHOOK';
  description: string;
  category: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  capabilities: string[];
}

@Injectable()
export class NodeExecutorRegistry implements OnModuleInit {
  private readonly logger = new Logger(NodeExecutorRegistry.name);
  private executors: Map<string, INodeExecutor> = new Map();
  private typeMap: Map<string, INodeExecutor[]> = new Map();

  // Injected executors will call register() in their onModuleInit
  onModuleInit() {
    this.logger.log(`Node Executor Registry initialized with ${this.executors.size} executors`);
  }

  register(executor: INodeExecutor): void {
    this.executors.set(executor.executorKey, executor);

    // Map node types to executors
    for (const nodeType of executor.handledNodeTypes) {
      const key = executor.handledCategories
        ? executor.handledCategories.map(c => `${nodeType}:${c}`).concat([nodeType])
        : [nodeType];

      for (const k of key) {
        const existing = this.typeMap.get(k) || [];
        existing.push(executor);
        this.typeMap.set(k, existing);
      }
    }

    this.logger.log(`Registered executor: ${executor.executorKey} (${executor.displayName})`);
  }

  /**
   * Find the best executor for a given node type + category combination.
   */
  resolve(nodeType: string, category?: string): INodeExecutor | null {
    // Try specific type:category first
    if (category) {
      const specific = this.typeMap.get(`${nodeType}:${category}`);
      if (specific?.length) return specific[0];
    }
    // Fall back to type-only
    const general = this.typeMap.get(nodeType);
    return general?.[0] ?? null;
  }

  /**
   * Get all registered executors as connector metadata (for frontend discovery).
   */
  listConnectors(): ConnectorMetadata[] {
    return Array.from(this.executors.values()).map(e => e.getConnectorMetadata());
  }

  getExecutor(key: string): INodeExecutor | null {
    return this.executors.get(key) ?? null;
  }

  listAll(): INodeExecutor[] {
    return Array.from(this.executors.values());
  }
}
