/**
 * Mission Controller — REST surface for multi-agent collaboration.
 */
import {
  Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MissionService, CreateMissionDto } from './mission.service';
import { HandoffService, CreateHandoffDto } from './handoff.service';
import { CurrentUser, RequestUser, Audit, Roles } from '../../common/decorators';

@ApiTags('Missions')
@ApiBearerAuth()
@Controller('missions')
export class MissionController {
  constructor(
    private readonly missionService: MissionService,
    private readonly handoffService: HandoffService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List missions' })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    const items = await this.missionService.list(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      status,
    );
    return { items };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mission detail' })
  async getById(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.missionService.getById(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, id,
    );
  }

  @Post()
  @Roles('OPERATOR')
  @Audit('CREATE', 'Mission')
  @ApiOperation({ summary: 'Create a new mission' })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMissionDto,
  ) {
    return this.missionService.create(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, dto,
    );
  }

  @Post(':id/start')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'Mission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a planned mission' })
  async start(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.missionService.start(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, id,
    );
  }

  @Post(':id/pause')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'Mission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause mission for human decision' })
  async pause(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.missionService.pauseForHuman(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, id, body.reason,
    );
  }

  @Post(':id/resume')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'Mission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume paused mission with a decision' })
  async resume(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { decision: string },
  ) {
    return this.missionService.resume(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, id, body.decision,
    );
  }

  @Post(':id/complete')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'Mission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete or cancel a mission' })
  async complete(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'ROLLED_BACK'; summary?: string },
  ) {
    return this.missionService.complete(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id, body.status, body.summary,
    );
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get full message history for a mission' })
  async messages(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.missionService.getMessages(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id, limit ? parseInt(limit) : 200,
    );
    return { items };
  }

  // ─── Handoffs within a mission ───
  @Get(':id/handoffs')
  @ApiOperation({ summary: 'List handoffs within a mission' })
  async handoffs(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const items = await this.handoffService.listByMission(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, id,
    );
    return { items };
  }

  @Post('handoffs')
  @Roles('OPERATOR')
  @Audit('CREATE', 'AgentHandoff')
  @ApiOperation({ summary: 'Create a new handoff' })
  async createHandoff(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateHandoffDto,
  ) {
    return this.handoffService.create(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, dto,
    );
  }

  @Post('handoffs/:handoffId/accept')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'AgentHandoff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept handoff' })
  async acceptHandoff(
    @CurrentUser() user: RequestUser,
    @Param('handoffId') handoffId: string,
  ) {
    return this.handoffService.accept(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, handoffId,
    );
  }

  @Post('handoffs/:handoffId/reject')
  @Roles('OPERATOR')
  @Audit('STATUS_TRANSITION', 'AgentHandoff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject handoff' })
  async rejectHandoff(
    @CurrentUser() user: RequestUser,
    @Param('handoffId') handoffId: string,
    @Body() body: { reason: string },
  ) {
    return this.handoffService.reject(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, handoffId, body.reason,
    );
  }

  @Post('handoffs/:handoffId/complete')
  @Roles('OPERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark handoff complete with result' })
  async completeHandoff(
    @CurrentUser() user: RequestUser,
    @Param('handoffId') handoffId: string,
    @Body() body: { result: Record<string, any> },
  ) {
    return this.handoffService.complete(
      { tenantId: user.tenantId, userId: user.userId, role: user.role }, handoffId, body.result,
    );
  }
}
