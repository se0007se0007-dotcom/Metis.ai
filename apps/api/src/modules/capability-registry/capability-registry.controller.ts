import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CapabilityRegistryService, CapabilityQuery } from './capability-registry.service';
import { AgentRegistryService, RegisterAgentDto } from './agent-registry.service';
import { CurrentUser, RequestUser, Audit, Roles } from '../../common/decorators';

@ApiTags('CapabilityRegistry')
@ApiBearerAuth()
@Controller('capabilities')
export class CapabilityRegistryController {
  constructor(
    private readonly registry: CapabilityRegistryService,
    private readonly agentRegistry: AgentRegistryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List capabilities (Builder uses this for node palette)' })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('kind') kind?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
  ) {
    const items = await this.registry.list(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      { kind: kind as any, category, tag, search } as CapabilityQuery,
    );
    return { items };
  }

  @Get('facets')
  @ApiOperation({ summary: 'Get facet counts by kind/category/tag' })
  async facets(@CurrentUser() user: RequestUser) {
    return this.registry.facets({ tenantId: user.tenantId, userId: user.userId, role: user.role });
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get capability detail by key' })
  async getByKey(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
  ) {
    return this.registry.getByKey(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      key,
    );
  }

  @Post('reconcile')
  @Roles('TENANT_ADMIN')
  @HttpCode(HttpStatus.OK)
  @Audit('STATUS_TRANSITION', 'CapabilityBinding')
  @ApiOperation({ summary: 'Re-scan all source tables and sync bindings' })
  async reconcile(@CurrentUser() user: RequestUser) {
    return this.registry.reconcile({ tenantId: user.tenantId, userId: user.userId, role: user.role });
  }

  // ═══════════════ Agent Registry ═══════════════

  @Get('agents/list')
  @ApiOperation({ summary: 'List registered agents' })
  async listAgents(
    @CurrentUser() user: RequestUser,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    const items = await this.agentRegistry.list(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      { category, status },
    );
    return { items };
  }

  @Post('agents')
  @Roles('TENANT_ADMIN')
  @Audit('CREATE', 'AgentDefinition')
  @ApiOperation({ summary: 'Register a new agent' })
  async registerAgent(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterAgentDto,
  ) {
    return this.agentRegistry.register(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      dto,
    );
  }

  @Post('agents/:key/status')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'AgentDefinition')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change agent status' })
  async setAgentStatus(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Body() body: { status: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'DRAINING' },
  ) {
    return this.agentRegistry.setStatus(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      key, body.status,
    );
  }
}
