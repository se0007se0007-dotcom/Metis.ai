import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'metis1234';

async function main() {
  console.log('🌱 Seeding Metis.AI database...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // ── Tenant ──
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: { slug: 'acme-corp', name: 'ACME Corporation' },
  });
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // ── Users ──
  const users = [
    { email: 'admin@metis.ai', name: '관리자', role: 'TENANT_ADMIN' as const },
    { email: 'operator@metis.ai', name: '운영자', role: 'OPERATOR' as const },
    { email: 'auditor@metis.ai', name: '감사자', role: 'AUDITOR' as const },
    { email: 'viewer@metis.ai', name: '뷰어', role: 'VIEWER' as const },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name },
    });

    // Membership
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: {},
      create: { tenantId: tenant.id, userId: user.id, role: u.role },
    });

    // Password credential (stored in KnowledgeArtifact with category AUTH)
    await prisma.knowledgeArtifact.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: `user-credential-${user.id}` } },
      update: { contentJson: { passwordHash } },
      create: {
        tenantId: tenant.id,
        key: `user-credential-${user.id}`,
        title: `Credential: ${u.email}`,
        category: 'AUTH',
        status: 'ACTIVE',
        version: '1',
        contentJson: { passwordHash },
      },
    });

    console.log(`  User: ${u.email} (${u.role}) — password: ${DEFAULT_PASSWORD}`);
  }

  // ── Policies ──
  await prisma.policy.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'max-cost-per-exec' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'max-cost-per-exec',
      name: '실행당 최대 비용 제한',
      ruleYaml: 'condition: execution.costUsd <= 10.0\naction: BLOCK',
      isActive: true,
    },
  });

  await prisma.policy.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'require-certification' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'require-certification',
      name: '팩 인증 필수',
      ruleYaml: 'condition: pack.status == "CERTIFIED"\naction: BLOCK',
      isActive: true,
    },
  });

  await prisma.policy.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'audit-all-executions' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'audit-all-executions',
      name: '모든 실행 감사 기록',
      ruleYaml: 'condition: true\naction: AUDIT',
      isActive: true,
    },
  });

  console.log(`  Policies: max-cost, require-cert, audit-all`);

  // ── Sample Pack ──
  const pack = await prisma.pack.upsert({
    where: { key: 'email-automation' },
    update: {},
    create: {
      key: 'email-automation',
      name: 'Email Automation Agent',
      sourceType: 'INTERNAL',
      description: '이메일 자동화 에이전트 팩',
    },
  });

  const packVersion = await prisma.packVersion.upsert({
    where: { packId_version: { packId: pack.id, version: '1.0.0' } },
    update: {},
    create: {
      packId: pack.id,
      version: '1.0.0',
      manifestJson: {
        name: 'email-automation',
        version: '1.0.0',
        capabilities: ['send-email', 'parse-inbox', 'classify-intent'],
      },
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@metis.ai' } });

  await prisma.packInstallation.upsert({
    where: {
      tenantId_packId_packVersionId: {
        tenantId: tenant.id,
        packId: pack.id,
        packVersionId: packVersion.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      packId: pack.id,
      packVersionId: packVersion.id,
      status: 'INSTALLED',
      installedById: adminUser?.id,
    },
  });

  console.log(`  Pack: ${pack.name} v1.0.0 (installed)`);

  // ── Sample Connector ──
  // ── Connectors: Original ──
  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'slack-webhook' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'slack-webhook',
      name: 'Slack 알림',
      type: 'WEBHOOK',
      status: 'ACTIVE',
      configJson: {
        webhook_url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX',
        endpoint: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX',
        rateLimit: '30/min',
        timeoutSec: 10,
      },
    },
  });

  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'jira-api' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'jira-api',
      name: 'Jira 연동',
      type: 'REST_API',
      status: 'ACTIVE',
      configJson: {
        endpoint: 'https://acme.atlassian.net/rest/api/3',
        base_url: 'https://acme.atlassian.net/rest/api/3',
        authType: 'bearer',
        api_key: 'jira-api-token-placeholder',
        rateLimit: '100/min',
        timeoutSec: 30,
      },
    },
  });

  // ── Connectors: MCP Servers ──
  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'mcp-filesystem' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'mcp-filesystem',
      name: 'MCP Filesystem Server',
      type: 'MCP_SERVER',
      status: 'PENDING',
      configJson: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/metis-workspace'],
        rateLimit: '120/min',
        timeoutSec: 30,
        description: 'MCP Filesystem server for file operations',
      },
    },
  });

  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'mcp-brave-search' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'mcp-brave-search',
      name: 'MCP Brave Search',
      type: 'MCP_SERVER',
      status: 'PENDING',
      configJson: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: { BRAVE_API_KEY: 'brave-api-key-placeholder' },
        rateLimit: '30/min',
        timeoutSec: 15,
        description: 'Brave Search via MCP for web search capabilities',
      },
    },
  });

  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'mcp-postgres' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'mcp-postgres',
      name: 'MCP PostgreSQL',
      type: 'MCP_SERVER',
      status: 'PENDING',
      configJson: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost:5432/metis'],
        rateLimit: '60/min',
        timeoutSec: 30,
        description: 'PostgreSQL database access via MCP protocol',
      },
    },
  });

  // ── Connectors: Agent ──
  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'langflow-agent' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'langflow-agent',
      name: 'LangFlow Agent',
      type: 'AGENT',
      status: 'PENDING',
      configJson: {
        endpoint: 'http://localhost:7860/api/v1/run',
        base_url: 'http://localhost:7860',
        method: 'POST',
        flow_id: 'default-flow',
        rateLimit: '10/min',
        timeoutSec: 120,
        description: 'LangFlow-based agent for complex AI workflows',
      },
    },
  });

  // ── Connectors: Additional Webhooks ──
  await prisma.connector.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'github-webhook' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'github-webhook',
      name: 'GitHub Webhook',
      type: 'WEBHOOK',
      status: 'ACTIVE',
      configJson: {
        webhook_url: 'https://api.github.com/repos/acme/metis/dispatches',
        endpoint: 'https://api.github.com/repos/acme/metis/dispatches',
        secret: 'github-webhook-secret-placeholder',
        rateLimit: '20/min',
        timeoutSec: 10,
        description: 'GitHub repository dispatch webhook',
      },
    },
  });

  console.log(`  Connectors: slack-webhook, jira-api, mcp-filesystem, mcp-brave-search, mcp-postgres, langflow-agent, github-webhook`);

  // ── Audit Log entries ──
  if (adminUser) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: adminUser.id,
        action: 'LOGIN',
        targetType: 'User',
        targetId: adminUser.id,
        correlationId: 'seed-init-001',
        metadataJson: { source: 'seed', note: '초기 시드 데이터' },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: adminUser.id,
        action: 'INSTALL',
        targetType: 'PackInstallation',
        targetId: pack.id,
        correlationId: 'seed-init-002',
        metadataJson: { packName: pack.name, version: '1.0.0' },
      },
    });
  }

  console.log(`  Audit logs: 2 seed entries`);

  // ════════════════════════════════════════════════════════════
  //  Phase 5 (Redesign) — Agent Kernel / FDS / AP / AutoOps seeds
  // ════════════════════════════════════════════════════════════

  // Sample FDS Rules
  await prisma.fDSRule.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'velocity-check' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'velocity-check',
      name: '거래 속도 이상 탐지',
      description: '동일 계정에서 짧은 시간 내 다수 거래 발생 시 알림',
      enabled: true,
      severity: 'HIGH',
      weight: 1.5,
      conditionsJson: {
        logic: 'AND',
        conditions: [
          { field: 'transactionCountPerHour', operator: 'gt', value: 10 },
          { field: 'amount', operator: 'gt', value: 1000000 },
        ],
      } as any,
      actionJson: { defaultAction: 'alert', escalateAfterMin: 30 } as any,
    },
  });

  await prisma.fDSRule.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'unusual-amount' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'unusual-amount',
      name: '비정상 금액 탐지',
      description: '과거 평균 대비 10배 이상 큰 거래 발생 감지',
      enabled: true,
      severity: 'CRITICAL',
      weight: 2.0,
      conditionsJson: {
        conditions: [{ field: 'amount', operator: 'gt', value: 50000000 }],
      } as any,
    },
  });

  console.log(`  FDS Rules: velocity-check, unusual-amount`);

  // Sample AP Invoice
  await prisma.aPInvoice.upsert({
    where: { tenantId_invoiceNumber: { tenantId: tenant.id, invoiceNumber: 'INV-2026-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      invoiceNumber: 'INV-2026-001',
      vendorName: 'Acme Supply Co.',
      vendorId: 'VEN-001',
      amount: 1250000,
      currency: 'KRW',
      invoiceDate: new Date('2026-04-01'),
      dueDate: new Date('2026-04-30'),
      status: 'PENDING_APPROVAL',
      sourceUri: 's3://metis-invoices/INV-2026-001.pdf',
      parsedJson: {
        lines: [
          { description: '사무용품 일괄', qty: 50, unitPrice: 25000, total: 1250000 },
        ],
        tax: 113636,
        total: 1250000,
      } as any,
      ocrConfidence: 0.97,
      matchingResult: 'FULL_MATCH',
      poReference: 'PO-2026-123',
      grReference: 'GR-2026-042',
      aiSuggestionJson: {
        recommendation: 'approve',
        confidence: 0.95,
        summary: '3-way 매칭 성공. 금액·벤더·품목 모두 일치합니다.',
      } as any,
      correlationId: 'seed-ap-001',
    },
  });

  console.log(`  AP Invoices: INV-2026-001 (sample)`);

  // Sample Mission (PLANNING state)
  const sampleMission = await prisma.mission.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'deploy-v1.4-validation' } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'deploy-v1.4-validation',
      title: '배포 v1.4 검증 및 롤아웃',
      description: 'Shadow → Canary(5%) → 전면 배포까지 자동 조율',
      status: 'PLANNING',
      kind: 'DEPLOYMENT',
      participants: [
        { agent: 'qa-agent', role: 'validator' },
        { agent: 'canary-agent', role: 'rollout' },
        { agent: 'finops-agent', role: 'cost-monitor' },
        { agent: 'ops-agent', role: 'operator' },
      ] as any,
      plannedStepsJson: {
        steps: [
          { id: 1, agent: 'qa-agent', action: 'run-shadow-tests' },
          { id: 2, agent: 'canary-agent', action: 'start-5pct-rollout' },
          { id: 3, agent: 'finops-agent', action: 'monitor-cost-delta' },
          { id: 4, agent: 'ops-agent', action: 'promote-or-rollback' },
        ],
      } as any,
      contextJson: { targetVersion: 'v1.4', currentVersion: 'v1.3' } as any,
      correlationId: 'mission-seed-001',
    },
  });

  console.log(`  Mission: ${sampleMission.key} (PLANNING)`);

  // ════════════════════════════════════════════════════════════
  //  Phase 6 — Agent Definitions (6 local agents)
  // ════════════════════════════════════════════════════════════
  const agentDefs = [
    {
      key: 'qa-agent', name: 'QA Validator', category: 'qa',
      description: '워크플로우 및 데이터 객체의 품질 검증 수행',
      capabilities: ['validate', 'review'],
      inputSchema: { type: 'object', properties: { subject: { type: 'object' } } },
      outputSchema: { type: 'object', properties: { verdict: { type: 'string', enum: ['PASS', 'WARN', 'FAIL'] } } },
    },
    {
      key: 'canary-agent', name: 'Canary Rollout', category: 'deployment',
      description: '단계별 카나리 배포 및 게이트 평가',
      capabilities: ['rollout', 'monitor'],
      inputSchema: { type: 'object', properties: { currentPct: { type: 'number' }, targetPct: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { newPct: { type: 'number' }, reachedTarget: { type: 'boolean' } } },
    },
    {
      key: 'finops-agent', name: 'FinOps Monitor', category: 'finops',
      description: '토큰 비용 및 예산 모니터링',
      capabilities: ['cost-monitor', 'alert'],
      inputSchema: { type: 'object', properties: { dailyBudgetUsd: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { totalCostUsd: { type: 'number' }, alertTriggered: { type: 'boolean' } } },
    },
    {
      key: 'ops-agent', name: 'IT Ops', category: 'operations',
      description: '커넥터/시스템 헬스 체크 및 조치',
      capabilities: ['health-check', 'diagnose'],
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object', properties: { healthPct: { type: 'number' }, actionRequired: { type: 'boolean' } } },
    },
    {
      key: 'ap-agent', name: 'AP Processor', category: 'business',
      description: '인보이스 검증 및 3-way 매칭 조율',
      capabilities: ['validate', 'match', 'approve'],
      inputSchema: { type: 'object', properties: { action: { type: 'string' }, invoiceNumber: { type: 'string' } } },
      outputSchema: { type: 'object' },
    },
    {
      key: 'risk-agent', name: 'Risk Analyzer', category: 'compliance',
      description: 'FDS 기반 리스크 스코어링',
      capabilities: ['score', 'flag'],
      inputSchema: { type: 'object', properties: { amount: { type: 'number' }, transactionCountPerHour: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { score: { type: 'number' }, severity: { type: 'string' } } },
    },
  ];

  for (const ag of agentDefs) {
    await prisma.agentDefinition.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: ag.key } },
      update: {
        name: ag.name, description: ag.description, category: ag.category,
        inputSchemaJson: ag.inputSchema as any,
        outputSchemaJson: ag.outputSchema as any,
        capabilitiesJson: ag.capabilities as any,
      },
      create: {
        tenantId: tenant.id,
        key: ag.key, name: ag.name, description: ag.description,
        category: ag.category, version: '1.0.0',
        kernelType: 'LOCAL',
        inputSchemaJson: ag.inputSchema as any,
        outputSchemaJson: ag.outputSchema as any,
        capabilitiesJson: ag.capabilities as any,
        defaultTimeoutSec: 60,
      },
    });
  }
  console.log(`  AgentDefinitions: 6 (qa, canary, finops, ops, ap, risk)`);

  // ════════════════════════════════════════════════════════════
  //  Phase 6 — Adapter Registrations (6 adapters)
  // ════════════════════════════════════════════════════════════
  const adapterDefs = [
    { key: 'ocr-mock', name: 'OCR Mock', type: 'ocr', impl: 'mock' },
    { key: 'ocr-tesseract', name: 'OCR Tesseract', type: 'ocr', impl: 'tesseract' },
    { key: 'ocr-textract', name: 'OCR AWS Textract', type: 'ocr', impl: 'textract' },
    { key: 'fds-ml-heuristic', name: 'FDS ML Heuristic', type: 'ml-score', impl: 'heuristic' },
    { key: 'fds-ml-openai', name: 'FDS ML OpenAI', type: 'ml-score', impl: 'openai' },
    { key: 'fds-ml-http', name: 'FDS ML HTTP Model', type: 'ml-score', impl: 'http-model' },
  ];

  for (const ad of adapterDefs) {
    await prisma.adapterRegistration.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: ad.key } },
      update: {
        name: ad.name, adapterType: ad.type, implementation: ad.impl, active: true,
      },
      create: {
        tenantId: tenant.id,
        key: ad.key, name: ad.name, adapterType: ad.type, implementation: ad.impl,
        active: ad.impl === 'mock' || ad.impl === 'heuristic',
        inputSchemaJson: { type: 'object' } as any,
        outputSchemaJson: { type: 'object' } as any,
      },
    });
  }
  console.log(`  AdapterRegistrations: 6 (3 OCR + 3 FDS ML)`);

  // ════════════════════════════════════════════════════════════
  //  Phase 6 — CapabilityBinding (reconcile from above tables)
  // ════════════════════════════════════════════════════════════
  // Connectors
  const seededConnectors = await prisma.connector.findMany({ where: { tenantId: tenant.id } });
  for (const c of seededConnectors) {
    await prisma.capabilityBinding.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: `connector:${c.key}` } },
      update: {},
      create: {
        tenantId: tenant.id,
        kind: 'CONNECTOR',
        sourceType: 'Connector', sourceId: c.id,
        key: `connector:${c.key}`, label: c.name,
        category: c.type.toLowerCase().replace('_', '-'),
        tags: [c.type, c.status],
        inputSchemaJson: {} as any,
        outputSchemaJson: {} as any,
      },
    });
  }

  // Agents
  const seededAgents = await prisma.agentDefinition.findMany({ where: { tenantId: tenant.id } });
  for (const a of seededAgents) {
    await prisma.capabilityBinding.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: `agent:${a.key}` } },
      update: {},
      create: {
        tenantId: tenant.id,
        kind: 'AGENT',
        sourceType: 'AgentDefinition', sourceId: a.id,
        key: `agent:${a.key}`, label: a.name,
        category: a.category,
        tags: [a.category, a.kernelType, ...(Array.isArray(a.capabilitiesJson) ? (a.capabilitiesJson as string[]) : [])],
        inputSchemaJson: a.inputSchemaJson as any,
        outputSchemaJson: a.outputSchemaJson as any,
      },
    });
  }

  // Adapters
  const seededAdapters = await prisma.adapterRegistration.findMany({ where: { tenantId: tenant.id, active: true } });
  for (const ad of seededAdapters) {
    await prisma.capabilityBinding.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: `adapter:${ad.key}` } },
      update: {},
      create: {
        tenantId: tenant.id,
        kind: 'ADAPTER',
        sourceType: 'AdapterRegistration', sourceId: ad.id,
        key: `adapter:${ad.key}`, label: ad.name,
        category: ad.adapterType,
        tags: [ad.adapterType, ad.implementation],
        inputSchemaJson: ad.inputSchemaJson as any,
        outputSchemaJson: ad.outputSchemaJson as any,
      },
    });
  }
  console.log(`  CapabilityBindings: ${seededConnectors.length + seededAgents.length + seededAdapters.length}`);

  console.log('');
  console.log('✅ Seed completed successfully');
  console.log(`   Login: admin@metis.ai / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
