/**
 * FinOps Controller — Phase 4: Token Optimization API Endpoints
 *
 * Endpoints:
 * - GET /finops/config — Get tenant FinOps config (upsert default if not exists)
 * - PUT /finops/config — Update tenant FinOps config
 * - GET /finops/agents — List agent configs
 * - PUT /finops/agents/:agentName — Update agent config
 * - GET /finops/skills — List skills
 * - POST /finops/skills — Register skill
 * - GET /finops/namespaces — List namespaces
 * - POST /finops/namespaces — Add namespace
 * - GET /finops/stats — Get today's stats
 * - GET /finops/stats/distribution — Get tier distribution
 * - GET /finops/token-logs — List recent token logs with pagination
 * - POST /finops/optimize — Main optimization endpoint (3-Gate pipeline)
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { FinOpsService } from './finops.service';
import { TokenOptimizerService } from './token-optimizer.service';
import { CurrentUser, RequestUser } from '../../common/decorators';
import {
  UpdateFinOpsConfigDto,
  CreateAgentConfigDto,
  UpdateAgentConfigDto,
  RegisterSkillDto,
  CreateNamespaceDto,
  OptimizeRequestDto,
  OptimizeResponseDto,
  FinOpsStatsDto,
  FinOpsDistributionDto,
  TokenLogDto,
} from './finops.dto';

@ApiTags('FinOps')
@ApiBearerAuth()
@Controller('finops')
export class FinOpsController {
  constructor(
    private readonly finOpsService: FinOpsService,
    private readonly tokenOptimizer: TokenOptimizerService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // Config Endpoints
  // ══════════════════════════════════════════════════════════════

  @Get('config')
  @ApiOperation({ summary: 'Get tenant FinOps config (upserts default)' })
  @ApiResponse({ status: 200, description: 'FinOps config' })
  async getConfig(@CurrentUser() user: RequestUser) {
    return this.finOpsService.getOrCreateConfig(user.tenantId);
  }

  @Put('config')
  @ApiOperation({ summary: 'Update tenant FinOps config' })
  @ApiResponse({ status: 200, description: 'Updated config' })
  async updateConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateFinOpsConfigDto,
  ) {
    return this.finOpsService.updateConfig(user.tenantId, dto);
  }

  // ══════════════════════════════════════════════════════════════
  // Agent Config Endpoints
  // ══════════════════════════════════════════════════════════════

  @Get('agents')
  @ApiOperation({ summary: 'List agent configs' })
  @ApiResponse({ status: 200, description: 'List of agent configs' })
  async listAgentConfigs(@CurrentUser() user: RequestUser) {
    return this.finOpsService.listAgentConfigs(user.tenantId);
  }

  @Put('agents/:agentName')
  @ApiOperation({ summary: 'Update agent config' })
  @ApiResponse({ status: 200, description: 'Updated agent config' })
  async updateAgentConfig(
    @CurrentUser() user: RequestUser,
    @Param('agentName') agentName: string,
    @Body() dto: UpdateAgentConfigDto,
  ) {
    return this.finOpsService.upsertAgentConfig(
      user.tenantId,
      agentName,
      dto,
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Skill Endpoints
  // ══════════════════════════════════════════════════════════════

  @Get('skills')
  @ApiOperation({ summary: 'List skills' })
  @ApiResponse({ status: 200, description: 'List of skills' })
  async listSkills(@CurrentUser() user: RequestUser) {
    return this.finOpsService.listSkills(user.tenantId);
  }

  @Post('skills')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register skill' })
  @ApiResponse({ status: 201, description: 'Skill registered' })
  async registerSkill(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterSkillDto,
  ) {
    return this.finOpsService.registerSkill(user.tenantId, dto);
  }

  // ══════════════════════════════════════════════════════════════
  // Namespace Endpoints
  // ══════════════════════════════════════════════════════════════

  @Get('namespaces')
  @ApiOperation({ summary: 'List namespaces' })
  @ApiResponse({ status: 200, description: 'List of namespaces' })
  async listNamespaces(@CurrentUser() user: RequestUser) {
    return this.finOpsService.listNamespaces(user.tenantId);
  }

  @Post('namespaces')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add namespace' })
  @ApiResponse({ status: 201, description: 'Namespace created' })
  async addNamespace(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateNamespaceDto,
  ) {
    return this.finOpsService.addNamespace(user.tenantId, dto);
  }

  // ══════════════════════════════════════════════════════════════
  // Statistics Endpoints
  // ══════════════════════════════════════════════════════════════

  @Get('stats')
  @ApiOperation({ summary: "Get today's FinOps statistics" })
  @ApiResponse({ status: 200, description: 'FinOps stats', type: FinOpsStatsDto })
  async getStats(@CurrentUser() user: RequestUser): Promise<FinOpsStatsDto> {
    return this.finOpsService.getStats(user.tenantId);
  }

  @Get('stats/distribution')
  @ApiOperation({ summary: 'Get tier distribution for today' })
  @ApiResponse({
    status: 200,
    description: 'Tier distribution stats',
    type: FinOpsDistributionDto,
  })
  async getDistribution(@CurrentUser() user: RequestUser): Promise<FinOpsDistributionDto> {
    return this.finOpsService.getDistribution(user.tenantId);
  }

  // ══════════════════════════════════════════════════════════════
  // Token Logs Endpoint
  // ══════════════════════════════════════════════════════════════

  @Get('token-logs')
  @ApiOperation({ summary: 'List recent token logs with pagination' })
  @ApiQuery({ name: 'agentName', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated token logs' })
  async getTokenLogs(
    @CurrentUser() user: RequestUser,
    @Query('agentName') agentName?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const pageSizeNum = pageSize ? Math.max(1, parseInt(pageSize, 10)) : 50;
    const offset = (pageNum - 1) * pageSizeNum;

    return this.finOpsService.getTokenLogs(user.tenantId, {
      agentName,
      limit: pageSizeNum,
      offset,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // Main Optimization Endpoint
  // ══════════════════════════════════════════════════════════════

  @Post('optimize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run token optimization (3-Gate pipeline)',
    description:
      'Main endpoint that intercepts LLM/AI calls and optimizes them through the 3-gate pipeline: ' +
      '(1) Semantic Cache lookup, (2) Model Router selection, (3) Skill Packer optimization',
  })
  @ApiResponse({ status: 200, description: 'Optimization result', type: OptimizeResponseDto })
  async optimize(
    @CurrentUser() user: RequestUser,
    @Body() dto: OptimizeRequestDto,
  ): Promise<OptimizeResponseDto> {
    const result = await this.tokenOptimizer.optimize({
      tenantId: user.tenantId,
      agentName: dto.agentName,
      executionSessionId: dto.executionSessionId,
      nodeId: dto.nodeId,
      prompt: dto.prompt,
      requestedModel: dto.requestedModel,
    });

    return {
      cacheHit: result.cacheHit,
      cachedResponse: result.cachedResponse,
      routedTier: result.routedTier,
      routedModel: result.routedModel,
      originalModel: result.originalModel,
      estimatedCostReduction: result.estimatedCostReduction,
      optimizationApplied: result.optimizationApplied,
      responseTimeMs: result.responseTimeMs || 0,
    };
  }
}
