/**
 * Execution Processor — Phase 2 Capability Runtime
 *
 * Handles execution jobs dispatched by ExecutionService:
 *   1. Load execution session context
 *   2. Resolve pack manifest capabilities/workflows
 *   3. Execute steps sequentially (with cancellation checks)
 *   4. Record ExecutionStep and ExecutionTrace
 *   5. Enforce timeout from manifest runtime config
 *   6. Update final status (SUCCEEDED / FAILED / CANCELLED)
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@metis/database';

export interface ExecutionJobData {
  executionSessionId: string;
  tenantId: string;
  userId: string;
  packInstallationId?: string;
  capabilityKey?: string;
  workflowKey?: string;
  input?: Record<string, unknown>;
  timeoutMs?: number;
}

interface StepDefinition {
  key: string;
  type: string;
  handler: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * Run a single execution job.
 */
export async function runExecution(
  job: Job<ExecutionJobData>,
  prisma: PrismaClient,
): Promise<{
  sessionId: string;
  status: string;
  stepsCompleted: number;
  latencyMs: number;
}> {
  const { executionSessionId, timeoutMs = 300_000 } = job.data;
  const startTime = Date.now();

  // Update status to RUNNING
  await prisma.executionSession.update({
    where: { id: executionSessionId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  await job.updateProgress(5);

  // Load execution context
  const session = await prisma.executionSession.findUnique({
    where: { id: executionSessionId },
  });

  if (!session) {
    throw new Error(`Execution session ${executionSessionId} not found`);
  }

  // Resolve steps to execute
  const steps = resolveSteps(job.data);
  const totalSteps = steps.length;
  let completedSteps = 0;

  // Create initial trace
  await createTrace(prisma, executionSessionId, 'EXECUTION_START', {
    steps: steps.map((s) => s.key),
    input: job.data.input,
    timeoutMs,
  });

  try {
    for (let i = 0; i < totalSteps; i++) {
      const step = steps[i];
      const stepStartTime = Date.now();

      // Check cancellation before each step
      const cancelled = await isCancelled(prisma, executionSessionId);
      if (cancelled) {
        await createTrace(prisma, executionSessionId, 'CANCELLATION_DETECTED', {
          atStep: step.key,
          completedSteps,
        });
        return {
          sessionId: executionSessionId,
          status: 'CANCELLED',
          stepsCompleted: completedSteps,
          latencyMs: Date.now() - startTime,
        };
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        await markSessionFailed(prisma, executionSessionId, startTime, `Timeout after ${timeoutMs}ms`);
        await createTrace(prisma, executionSessionId, 'TIMEOUT', {
          atStep: step.key,
          elapsedMs: Date.now() - startTime,
        });
        throw new Error(`Execution timed out after ${timeoutMs}ms at step "${step.key}"`);
      }

      // Create step record (IN_PROGRESS)
      const stepRecord = await prisma.executionStep.create({
        data: {
          executionSessionId,
          stepKey: step.key,
          stepType: step.type,
          status: 'RUNNING',
          startedAt: new Date(),
          inputJson: job.data.input ? JSON.parse(JSON.stringify(job.data.input)) : {},
        },
      });

      try {
        // Execute step handler
        const output = await step.handler(job.data.input ?? {});

        const stepLatency = Date.now() - stepStartTime;

        // Update step as SUCCEEDED
        await prisma.executionStep.update({
          where: { id: stepRecord.id },
          data: {
            status: 'SUCCEEDED',
            endedAt: new Date(),
            outputJson: JSON.parse(JSON.stringify(output)) as any,
          },
        });

        completedSteps++;
        await job.updateProgress(5 + Math.round((completedSteps / totalSteps) * 90));

        // Create trace for step completion
        await createTrace(prisma, executionSessionId, 'STEP_COMPLETED', {
          stepKey: step.key,
          stepType: step.type,
          latencyMs: stepLatency,
          outputSummary: Object.keys(output),
        });
      } catch (stepError: any) {
        // Step failed
        await prisma.executionStep.update({
          where: { id: stepRecord.id },
          data: {
            status: 'FAILED',
            endedAt: new Date(),
            errorMessage: stepError.message,
          },
        });

        await createTrace(prisma, executionSessionId, 'STEP_FAILED', {
          stepKey: step.key,
          error: stepError.message,
        });

        throw stepError; // Propagate to mark session as failed
      }
    }

    // All steps completed — mark as SUCCEEDED
    const latencyMs = Date.now() - startTime;
    await prisma.executionSession.update({
      where: { id: executionSessionId },
      data: {
        status: 'SUCCEEDED',
        endedAt: new Date(),
        latencyMs,
        outputJson: JSON.parse(JSON.stringify({ stepsCompleted: completedSteps, totalSteps })) as any,
      },
    });

    await job.updateProgress(100);
    await createTrace(prisma, executionSessionId, 'EXECUTION_COMPLETED', {
      stepsCompleted: completedSteps,
      latencyMs,
    });

    return {
      sessionId: executionSessionId,
      status: 'SUCCEEDED',
      stepsCompleted: completedSteps,
      latencyMs,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;

    // Check if already cancelled
    const currentSession = await prisma.executionSession.findUnique({
      where: { id: executionSessionId },
      select: { status: true },
    });

    if (currentSession?.status !== 'CANCELLED') {
      await markSessionFailed(prisma, executionSessionId, startTime, error.message);
    }

    await createTrace(prisma, executionSessionId, 'EXECUTION_FAILED', {
      error: error.message,
      stepsCompleted: completedSteps,
      latencyMs,
    });

    throw error;
  }
}

// ── Step Resolution ──

/**
 * Resolve which steps to execute based on the job data.
 * In production, this would load step definitions from the pack manifest.
 * For Phase 2, we generate simulated steps.
 */
function resolveSteps(data: ExecutionJobData): StepDefinition[] {
  const capabilityKey = data.capabilityKey ?? 'default';
  const workflowKey = data.workflowKey;

  // Simulate different step counts based on context
  const stepCount = workflowKey ? 5 : 3;
  const steps: StepDefinition[] = [];

  for (let i = 0; i < stepCount; i++) {
    const stepKey = workflowKey
      ? `${workflowKey}:step-${i + 1}`
      : `${capabilityKey}:action-${i + 1}`;

    steps.push({
      key: stepKey,
      type: i === 0 ? 'INIT' : i === stepCount - 1 ? 'FINALIZE' : 'PROCESS',
      handler: async (input) => {
        // Simulate processing time (200-800ms per step)
        const processingTime = 200 + Math.random() * 600;
        await new Promise((r) => setTimeout(r, processingTime));

        return {
          step: stepKey,
          processedAt: new Date().toISOString(),
          processingTimeMs: Math.round(processingTime),
          inputKeys: Object.keys(input),
        };
      },
    });
  }

  return steps;
}

// ── Helpers ──

async function isCancelled(prisma: PrismaClient, sessionId: string): Promise<boolean> {
  const session = await prisma.executionSession.findUnique({
    where: { id: sessionId },
    select: { status: true, outputJson: true },
  });

  if (!session) return true;
  if (session.status === 'CANCELLED') return true;

  // Check cancellation flag set by kill switch
  const output = session.outputJson as Record<string, unknown> | null;
  if (output?._cancellationRequested) return true;

  return false;
}

async function markSessionFailed(
  prisma: PrismaClient,
  sessionId: string,
  startTime: number,
  errorMessage: string,
): Promise<void> {
  await prisma.executionSession.update({
    where: { id: sessionId },
    data: {
      status: 'FAILED',
      endedAt: new Date(),
      latencyMs: Date.now() - startTime,
      outputJson: JSON.parse(JSON.stringify({ error: errorMessage })) as any,
    },
  });
}

async function createTrace(
  prisma: PrismaClient,
  sessionId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  await prisma.executionTrace.create({
    data: {
      executionSessionId: sessionId,
      correlationId: `trace-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      traceJson: {
        event,
        ...data,
        timestamp: new Date().toISOString(),
      },
    },
  }).catch((err: any) => {
    console.error(`[execution-trace] Failed to write trace for session ${sessionId}, event=${event}: ${err.message}`);
  });
}
